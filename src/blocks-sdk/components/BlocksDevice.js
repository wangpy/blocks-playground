// @flow

import * as React from 'react';
import {
  buildBlockSysExDataArrayFromDump,
  blockProgramPacketDump1,
  blockProgramPacketDump2
} from '../blocks/Block';
import {
  getBlocksMessageType,
  MessageFromDevice,
  TopologyDeviceInfo,
  TouchMessage,
  TouchWithVelocityMessage,
  DeviceAckMessage,
  kPacketCounterMaxValue,
  kMessageStartBitInDataFromDevice
} from '../protocol/BlocksProtocolDefinitions';
import { BlocksTopology } from './BlocksTopology';
import { type Color, BitmapLED, makeARGB, blendARGB } from './BitmapLED';
import { dumpUint8ArrayToHexString } from '../util/BitConversionUtils';

type CustomFunctions = {
  initialize: ?Function,
  repaint: ?Function,
  touchStart: ?Function,
  touchMove: ?Function,
  touchEnd: ?Function
};

export const kMockDeviceIndex = 0x3E;

const kCodeToExecute = `(function(env){
  var makeARGB = env.makeARGB;
  var blendARGB = env.makeARGB;
  var fillPixel = env.fillPixel;
  var blendPixel = env.blendPixel;
  var fillRect = env.fillRect;
  var blendRect = env.blendRect;
  var blendGradientRect = env.blendGradientRect;
  var addPressurePoint = env.addPressurePoint;
  var drawPressureMap = env.drawPressureMap;
  var fadePressureMap = env.fadePressureMap;
  var clearDisplay = env.clearDisplay;

  var getBatteryLevel = env.getBatteryLevel;
  var isBatteryCharging = env.isBatteryCharging;
  var isMasterBlock = env.isMasterBlock;
  var setStatusOverlayActive = env.setStatusOverlayActive;
  var getNumBlocksInTopology = env.getNumBlocksInTopology;
  var getBlockIDForIndex = env.getBlockIDForIndex;
  var getBlockIDOnPort = env.getBlockIDOnPort;
  var getPortToMaster = env.getPortToMaster;
  var getBlockTypeForID = env.getBlockTypeForID;
  var sendMessageToBlock = env.sendMessageToBlock;
  var sendMessageToHost = env.sendMessageToHost;

  var sendMIDI = env.sendMIDI;
  var sendNoteOn = env.sendNoteOn;
  var sendNoteOff = env.sendNoteOff;
  var sendAftertouch = env.sendAftertouch;
  var sendCC = env.sendCC;
  var sendPC = env.sendPC;
  var sendPitchBend = env.sendPitchBend;
  var sendChannelPressure = env.sendChannelPressure;

  var min = env.min;
  var max = env.max;
  var clamp = env.clamp;
  var abs = env.abs;
  var map = env.map;
  var mod = env.mod;
  var getRandomFloat = env.getRandomFloat;
  var getRandomInt = env.getRandomInt;
  var getMillisecondCounter = env.getMillisecondCounter;
  var getFirmwareVersion = env.getFirmwareVersion;
  var log = env.log;
  var logHex = env.logHex;
  var getTimeInCurrentFunctionCall = env.getTimeInCurrentFunctionCall;

  {{CUSTOM_CODE}}

  return {
    initialise: (typeof initialise === 'function') ? initialise : null,
    repaint: (typeof repaint === 'function') ? repaint : null,
    handleButtonDown: (typeof handleButtonDown === 'function') ? handleButtonDown: null,
    handleButtonUp: (typeof handleButtonUp === 'function') ? handleButtonUp: null,
    touchStart: (typeof touchStart === 'function') ? touchStart : null,
    touchMove: (typeof touchMove === 'function') ? touchMove : null,
    touchEnd: (typeof touchEnd === 'function') ? touchEnd: null,
    handleMessage: (typeof handleMessage === 'function') ? handleMessage: null,
    handleMIDI: (typeof handleMIDI === 'function') ? handleMIDI: null,
  }
})`;

export function getLineNumberBaseForCustomCode() {
  const str = kCodeToExecute.substring(0, kCodeToExecute.indexOf('{{CUSTOM_CODE}}'));
  return (str.match(/\n/g) || []).length;
}

export type BlocksDeviceProps = {
  code: string,
  deviceIndex: number,
  topology: BlocksTopology,
  topologyDeviceInfo: TopologyDeviceInfo,
  onCodeExecutionError(error: *): void,
};

type State = {
  enabled: boolean
};

export class BlocksDevice extends React.Component<BlocksDeviceProps, State> {
  _deviceIsReady: boolean;
  _pingIntervalID: ?IntervalID;
  _packetCounter: number;
  _ackedPacketCounter: number;
  _promiseResolverForAck: ?Function;
  _promiseRejecterForAck: ?Function;
  _isOpened: boolean;
  _isErrorReported: boolean;
  _customCode: string;
  _customFunctions: CustomFunctions;
  _sysExQueue: ?Array<Array<number>>;

  constructor(props: BlocksDeviceProps) {
    super(props);
    this._deviceIsReady = false;
    this._pingIntervalID = null;
    this._packetCounter = 0;
    this._ackedPacketCounter = 0;
    this._promiseResolverForAck = null;
    this._promiseRejecterForAck = null;
    this._isOpened = false;
    this._isErrorReported = false;
    this._customCode = '';
    this._customFunctions = {
      initialize: null,
      repaint: null,
      touchStart: null,
      touchMove: null,
      touchEnd: null,
      handleMessage: null,
      handleMIDI: null
    };
    this._sysExQueue = [];
  }

  closeDevice() {
    if (!this._isOpened) {
      return;
    }

    this.onDeviceWillClose();

    if (this._pingIntervalID != null) {
      clearInterval(this._pingIntervalID);
      this._pingIntervalID = null;
    }
    this._isOpened = false;
    this._isErrorReported = false;
    console.debug('closeDevice', this.props.deviceIndex, this._isOpened);
    this.setState({ enabled: false });
    this.sendDisableSysEx();
    this.clearPromiseForAck();
  }

  openDevice() {
    if (this._isOpened) {
      return;
    }
    this._isOpened = true;
    console.debug('openDevice', this.props.deviceIndex, this._isOpened);
    this.setState({ enabled: true });
    this.doHandshakeWithDevice();
  }

  sendSysEx(dataArr: Array<number>, checksumToVerify: ?number) {
    this.props.topology.sendSysEx(this.props.deviceIndex, dataArr, checksumToVerify);
  }

  sendMultipleSysEx(multipleDataArr: Array<Array<number>>) {
    this._sysExQueue = multipleDataArr;
    this.sendRemainingQueuedDataIfAvailable();
  }

  sendRemainingQueuedDataIfAvailable(): boolean {
    if (this._sysExQueue.length === 0) {
      return false;
    }
    this.sendSysEx(this._sysExQueue.shift());
    this.increasePacketCounter();
    return true;
  }

  isLastDataChangePacketAcked() {
    return this._packetCounter === ((this._ackedPacketCounter + 1) & kPacketCounterMaxValue);
  }

  increasePacketCounter() {
    this._packetCounter = (this._packetCounter + 1) & kPacketCounterMaxValue;
  }

  clearPromiseForAck() {
    if (this._promiseRejecterForAck != null) {
      this._promiseRejecterForAck();
    }
    this._promiseResolverForAck = null;
    this._promiseRejecterForAck = null;
  }

  waitForDeviceAck(): Promise {
    this.clearPromiseForAck();
    return new Promise((resolve, reject) => {
      if (this.props.deviceIndex === kMockDeviceIndex) {
        resolve();
      } else {
        this._promiseResolverForAck = resolve;
        this._promiseRejecterForAck = reject;
      }
    });
  }

  checkAndUpdateCustomCode(newCode: string) {
    const customFunctions = this.extractCustomFunctionsFromCode();
    if (customFunctions === null) {
      console.debug('checkAndUpdateCustomCode failed');
      return;
    }
    this._customCode = newCode;
    console.debug('checkAndUpdateCustomCode success');
  }

  processDataFromDevice(messageData: Uint8Array) {
    console.debug('processDataFromDevice', messageData.length, dumpUint8ArrayToHexString(messageData));
    let bitPosition = kMessageStartBitInDataFromDevice;
    while (bitPosition < messageData.length * 8) {
      let isProcessed = false;
      const messageType = getBlocksMessageType(messageData, bitPosition);
      const origPosition = bitPosition;
      switch (messageType) {
        case MessageFromDevice.packetACK:
          {
            const message = new DeviceAckMessage();
            const processedBits = message.deserializeFromData(messageData, bitPosition);
            if (processedBits === 0) {
              break;
            }
            const ackedPacketCounter = message.getField('packetCounter');
            console.debug('received messageAck', this.props.deviceIndex, ackedPacketCounter, this._packetCounter, (this._promiseResolverForAck != null) ? 'shouldResolvePromiseForAck!' : '');
            // check if received ACK packet counter is the same as previous.
            // If so, might need to do error recovery
            if (this._ackedPacketCounter === ackedPacketCounter) {
              this.onPacketCounterStuck(ackedPacketCounter);
              // force next packet counter to the next of ACKed packet counter
              this._packetCounter = ((this._ackedPacketCounter + 1) & kPacketCounterMaxValue);
            } else {
              this._ackedPacketCounter = ackedPacketCounter;
            }
            if (this.sendRemainingQueuedDataIfAvailable()) {
              // do nothing
            } else if (this._promiseResolverForAck != null) {
              setTimeout(this._promiseResolverForAck, 100);
              this._promiseResolverForAck = null;
              this._promiseRejecterForAck = null;
            }
            bitPosition += processedBits;
            isProcessed = true;
            break;
          }
        case MessageFromDevice.touchStartWithVelocity:
          {
            const message = new TouchWithVelocityMessage();
            const processedBits = message.deserializeFromData(messageData, bitPosition);
            if (processedBits === 0) {
              break;
            }
            this.handleTouchWithVelocityMessageFromDevice(message, 'touchStart');
            bitPosition += processedBits;
            isProcessed = true;
            break;
          }
        case MessageFromDevice.touchEndWithVelocity:
          {
            const message = new TouchWithVelocityMessage();
            const processedBits = message.deserializeFromData(messageData, bitPosition);
            if (processedBits === 0) {
              break;
            }
            this.handleTouchWithVelocityMessageFromDevice(message, 'touchEnd');
            bitPosition += processedBits;
            isProcessed = true;
            break;
          }
        case MessageFromDevice.touchMove:
          {
            const message = new TouchMessage();
            const processedBits = message.deserializeFromData(messageData, bitPosition);
            if (processedBits === 0) {
              break;
            }
            this.handleTouchMessageFromDevice(message, 'touchMove');
            bitPosition += processedBits;
            isProcessed = true;
            break;
          }
        default:
          break;
      }
      console.debug(
        'message', origPosition,
        'length', messageData.length * 8,
        'type', messageType,
        'isProcessed', isProcessed,
        'processedLength', bitPosition - origPosition);
      if (!isProcessed) {
        break;
      }
    } // while loop
  }

  handleTouchWithVelocityMessageFromDevice(message: TouchWithVelocityMessage, functionName: string) {
    const touchIndex = message.getField('touchIndex');
    const pos = message.getField('touchPosition');
    const x = pos.getField('Xcoord');
    const y = pos.getField('Ycoord');
    const z = pos.getField('Zcoord');
    const velocity = message.getField('touchVelocity');
    const vz = velocity.getField('VZcoord');

    console.debug('TouchWithVelocityMessage', functionName, touchIndex, x, y, z, vz);

    if (functionName === 'touchStart') {
      this.handleDeviceTouchStart(touchIndex, x, y, vz);
    } else if (functionName === 'touchEnd') {
      this.handleDeviceTouchEnd(touchIndex, x, y, vz);
    }
  }

  handleTouchMessageFromDevice(message: TouchMessage, functionName: string) {
    const touchIndex = message.getField('touchIndex');
    const pos = message.getField('touchPosition');
    const x = pos.getField('Xcoord');
    const y = pos.getField('Ycoord');
    const z = pos.getField('Zcoord');

    console.debug('TouchMessage', functionName, touchIndex, x, y, z);

    if (functionName === 'touchMove') {
      this.handleDeviceTouchMove(touchIndex, x, y, z);
    }
  }

  handleDeviceTouchStart(touchIndex: number, x: number, y: number, vz: number) {
    console.debug('handleDeviceTouchStart', touchIndex, x, y, vz);
    this.getCustomFunction('touchStart')(touchIndex, x, y, vz);
    this.onDeviceTouchStart(touchIndex, x, y, vz);
  }

  handleDeviceTouchMove(touchIndex: number, x: number, y: number, vz: number) {
    console.debug('handleDeviceTouchMove', touchIndex, x, y, vz);
    this.getCustomFunction('touchMove')(touchIndex, x, y, vz);
    this.onDeviceTouchMove(touchIndex, x, y, vz);
  }

  handleDeviceTouchEnd(touchIndex: number, x: number, y: number, vz: number) {
    console.debug('handleDeviceTouchEnd', touchIndex, x, y, vz);
    this.getCustomFunction('touchEnd')(touchIndex, x, y, vz);
    this.onDeviceTouchEnd(touchIndex, x, y, vz);
  }

  async doHandshakeWithDevice() {
    const { deviceIndex } = this.props;
    if (deviceIndex === 0) {
      return;
    }
    console.debug('doHandshakeWithDevice sendEnableSysEx', deviceIndex);
    this.sendSysEx([0x01, 0x02, 0x00], 0x60); // endAPIMode
    this.sendSysEx([0x01, 0x00, 0x00], 0x5A); // beginAPIMode
    await this.waitForDeviceAck();

    console.debug('doHandshakeWithDevice sendEnableSysExPart2', deviceIndex);
    this.sendSysEx([0x01, 0x00, 0x00], 0x5A); // enable API mode again
    await this.waitForDeviceAck();

    console.debug('doHandshakeWithDevice enablePing', deviceIndex);
    if (this._pingIntervalID === null) {
      this._pingIntervalID = setInterval(this.sendPingSysEx, 500);
    }
    this.sendSysEx([0x01, 0x03, 0x00], 0x63); // manually send ping
    await this.waitForDeviceAck();

    console.debug('doHandshakeWithDevice sendEnableSysExPart4', deviceIndex);
    this.sendSysEx([0x10, 0x02], 0x44); // configMessage midiUseMPE
    await this.waitForDeviceAck();

    console.debug('doHandshakeWithDevice sendProgramDataSysEx', deviceIndex);
    this.sendSysEx([0x01, 0x03, 0x00], 0x63); // manually send ping
    await this.waitForDeviceAck();

    console.debug('doHandshakeWithDevice sendProgramDataSysExPart2', deviceIndex);
    this.sendSysEx(buildBlockSysExDataArrayFromDump(blockProgramPacketDump1));
    this.sendSysEx(buildBlockSysExDataArrayFromDump(blockProgramPacketDump2));
    this._packetCounter = 3;
    await this.waitForDeviceAck();

    console.debug('doHandshakeWithDevice sendEnableSysExPart5', deviceIndex);
    this.sendSysEx([0x01, 0x05, 0x00], 0x69); // saveProgramAsDefault
    await this.waitForDeviceAck();

    console.debug('doHandshakeWithDevice setDeviceReady', deviceIndex);
    this._deviceIsReady = true;
    this.injectCustomCode();

    this.onDeviceIsReady();
  };

  handleCodeExecutionError(e: *) {
    if (!this._isErrorReported) {
      this.props.onCodeExecutionError(e);
      this._isErrorReported = true;
    }
  }

  //////////////////////////////////////
  // for overriding by children class
  //////////////////////////////////////

  onDeviceIsReady = () => { };
  onDeviceWillClose = () => { };
  onCodeExecutionError = (e: *) => { };
  onGetBitmapLED = (): ?BitmapLED => null;
  onRenderDeviceInterface = () => (<div />);
  onDeviceTouchStart = (touchIndex: number, x: number, y: number, vz: number) => { };
  onDeviceTouchMove = (touchIndex: number, x: number, y: number, vz: number) => { };
  onDeviceTouchEnd = (touchIndex: number, x: number, y: number, vz: number) => { };
  onPacketCounterStuck = (packetCounter: number) => { };

  ///////////////
  // api start
  ///////////////

  //// Controlling and repainting the Lightpad

  makeARGB = (a: number, r: number, g: number, b: number) => {
    return makeARGB(a, r, g, b);
  };

  blendARGB = (baseColor: Color, overlaidColor: Color) => {
    return blendARGB(baseColor, overlaidColor);
  };

  fillPixel = (rgb: Color, x: number, y: number) => {
    const bitmapLED = this.onGetBitmapLED();
    if (bitmapLED != null) {
      bitmapLED.fillPixel(rgb, x, y);
    }
  };

  blendPixel = (argb: Color, x: number, y: number) => {
    const bitmapLED = this.onGetBitmapLED();
    if (bitmapLED != null) {
      bitmapLED.blendPixel(argb, x, y);
    }
  };

  fillRect = (rgb: Color, x: number, y: number, width: number, height: number) => {
    const bitmapLED = this.onGetBitmapLED();
    if (bitmapLED != null) {
      bitmapLED.fillRect(rgb, x, y, width, height);
    }
  };

  blendRect = (argb: Color, x: number, y: number, width: number, height: number) => {
    const bitmapLED = this.onGetBitmapLED();
    if (bitmapLED != null) {
      bitmapLED.blendRect(argb, x, y, width, height);
    }
  };

  blendGradientRect = (colorNW: Color, colorNE: Color, colorSW: Color, colorSE: Color, x: number, y: number, width: number, height: number) => {
    const bitmapLED = this.onGetBitmapLED();
    if (bitmapLED != null) {
      bitmapLED.blendGradientRect(colorNW, colorNE, colorSW, colorSE, x, y, width, height);
    }
  };

  addPressurePoint = (argb: Color, floatX: number, floatY: number, floatZ: number) => {
    const bitmapLED = this.onGetBitmapLED();
    if (bitmapLED != null) {
      bitmapLED.addPressurePoint(argb, floatX, floatY, floatZ);
    }
  };

  drawPressureMap = () => {
    const bitmapLED = this.onGetBitmapLED();
    if (bitmapLED != null) {
      bitmapLED.drawPressureMap();
    }
  };

  fadePressureMap = () => {
    const bitmapLED = this.onGetBitmapLED();
    if (bitmapLED != null) {
      bitmapLED.fadePressureMap();
    }
  };

  clearDisplay = (rgb?: Color) => {
    const bitmapLED = this.onGetBitmapLED();
    if (bitmapLED != null) {
      bitmapLED.clearDisplay(rgb);
    }
  };

  //// Communication and configuration

  getBatteryLevel = (): number => {
    if (this.props.topologyDeviceInfo != null)
      return this.props.topologyDeviceInfo.batteryLevel / 32;
    return 0;
  };

  isBatteryCharging = (): bool => {
    if (this.props.topologyDeviceInfo != null)
      return this.props.topologyDeviceInfo.batteryCharging === 1;
    return false;
  };

  /** Returns true if this block is directly connected to the application,
    as opposed to only being connected to a different block via a connection port.
   */
  isMasterBlock = (): bool => {
    // TODO
    return false;
  };

  /** Returns true if this block is directly connected to the host computer. */
  isConnectedToHost = (): bool => {
    // TODO
    return false;
  };

  /** Called when a block receives a message.
    @see sendMessageToBlock
   */
  handleMessageFromOtherDevice(param1: number, param2: number, param3: number) {
    console.log('handleMessageFromOtherDevice', this.props.deviceIndex, param1, param2, param3);
    this.getCustomFunction('handleMessage')(param1, param2, param3);
  }

  setStatusOverlayActive = (active: bool) => {
    // TODO
  };

  /** Returns the number of blocks in the current topology. */
  getNumBlocksInTopology = (): number => {
    let topologyInfo = this.props.topology.getDeviceTopology();
    if (topologyInfo != null) {
      return topologyInfo.devices.length;
    }
    return 0;
  };

  /** Returns the ID of the block at a given index in the topology. */
  getBlockIDForIndex = (index: number): number => {
    if (index < 0 || index >= this.getNumBlocksInTopology()) {
      return 0;
    }
    let topologyInfo = this.props.topology.getDeviceTopology();
    if (topologyInfo != null) {
      return topologyInfo.devices[index].topologyIndex;
    }
    return 0;
  };

  /** Returns the ID of the block connected to a specified port. */
  getBlockIDOnPort = (index: number): number => {
    // NOTE(wangpy): different than Littlefoot: get self block ID
    if (index === 0xFF) {
      return this.props.deviceIndex;
    }
    let topologyInfo = this.props.topology.getDeviceTopology();
    if (topologyInfo != null) {
      let connections = topologyInfo.connections;
      for (var i = 0; i < connections.length; i++) {
        let connection = connections[i];
        if (connection.deviceIndex1 === this.props.deviceIndex
          && connection.portIndex1 === index) {
          return connection.deviceIndex2;
        }
        if (connection.deviceIndex2 === this.props.deviceIndex
          && connection.portIndex2 === index) {
          return connection.deviceIndex1;
        }
      }
      // not found in connections data
      return 0;
    }
    return 0;
  };

  /** Returns the port number that is connected to the master block. Returns 0xFF if there is no path. */
  getPortToMaster = (): number => {
    return 0xFF;
  };

  /** Returns the block type of the block with this ID. */
  // 0: N/A
  // 1: LightPad
  getBlockTypeForID = (blockID: number): number => {
    let topologyInfo = this.props.topology.getDeviceTopology();
    if (topologyInfo != null) {
      let devices = topologyInfo.devices;
      for (var i = 0; i < devices.length; i++) {
        let device = devices[i];
        if (device.topologyIndex === blockID) {
          // TODO: detect block type from topology info
          return 1;
        }
      }
      // not found in devices data
      return 0;
    }
    return 0;
  };

  /** Sends a message to the block with the specified ID. 
      This will be processed in the handleMessage() callback.
      
      @param blockID     the ID of the block to send this message to
      @param param1      the first chunk of data to send
      @param param2      the second chunk of data to send
      @param param3      the third chunk of data to send
  */
  sendMessageToBlock = (blockID: number, param1: number, param2: number, param3: number) => {
    this.props.topology.sendMessageToDevice(blockID, param1, param2, param3);
  };

  /** Sends a message to the host. 
      To receive this the host will need to implement the Block::ProgramEventListener::handleProgramEvent() method.
      
      @param param1      the first chunk of data to send
      @param param2      the second chunk of data to send
      @param param3      the third chunk of data to send
  */
  sendMessageToHost = (param1: number, param2: number, param3: number) => {
    // TODO
  };

  //// MIDI functions

  sendMIDI = (byte0: number, byte1: ?number, byte2: ?number) => {
    let dataArr = [byte0 & 0xFF];
    if (byte1 != null) {
      dataArr.push(byte1 & 0x7F);
    }
    if (byte2 != null) {
      dataArr.push(byte2 & 0x7F);
    }
    this.props.topology.sendMidiDataToSelectedOutputPort(new Uint8Array(dataArr));
  };

  sendNoteOn = (channel: number, noteNumber: number, velocity: number) => {
    this.sendMIDI(0x90 | (channel & 0x0F), noteNumber, velocity);
  };

  sendNoteOff = (channel: number, noteNumber: number, velocity: number) => {
    this.sendMIDI(0x80 | (channel & 0x0F), noteNumber, velocity);
  };

  sendAftertouch = (channel: number, noteNumber: number, level: number) => {
    this.sendMIDI(0xA0 | (channel & 0x0F), noteNumber, level);
  };

  sendCC = (channel: number, controller: number, value: number) => {
    this.sendMIDI(0xB0 | (channel & 0x0F), controller, value);
  };

  sendPC = (channel: number, program: number) => {
    this.sendMIDI(0xC0 | (channel & 0x0F), program);
  };

  sendPitchBend = (channel: number, position: number) => {
    const lsb = position & 0x7F;
    const msb = (position >> 7) & 0x7F;
    this.sendMIDI(0xE0 | (channel & 0x0F), lsb, msb);
  };

  sendChannelPressure = (channel: number, pressure: number) => {
    this.sendMIDI(0xD0 | (channel & 0x0F), pressure);
  };

  //// Maths

  min = (a: number, b: number): number => {
    return Math.min(a, b);
  };

  max = (a: number, b: number): number => {
    return Math.max(a, b);
  };

  clamp = (lowerLimit: number, upperLimit: number, valueToConstrain): number => {
    return Math.min(Math.max(valueToConstrain, lowerLimit), upperLimit);
  };

  abs = (arg: number): number => {
    return Math.abs(arg);
  };

  /** Remaps a value from a source range to a target range.
      
      @param value        the value within the source range to map
      @param sourceMin    the minimum value of the source range
      @param sourceMax    the maximum value of the source range
      @param destMin      the minumum value of the destination range (optional, default=0.0)
      @param destMax      the maximum value of the destination range (optional, default=1.0)
  
      @returns    the original value mapped to the destination range
  */
  map = (value: number, sourceMin: number, sourceMax: number, destMin: number, destMax: number): number => {
    if (sourceMin === sourceMax) {
      return destMin;
    }
    let clampValue = Math.min(Math.max(value, sourceMin), sourceMax);
    let sourceRangeRatio = (clampValue - sourceMin) / (sourceMax - sourceMin);
    let destValue = destMin + (destMax - destMin) * sourceRangeRatio;
    return destValue;
  };

  mod = (dividend: number, divisor: number): number => {
    return Math.mod(dividend, divisor);
  };

  getRandomFloat = (): number => {
    return Math.random();
  };

  getRandomInt = (maxValue: number): number => {
    return Math.floor(maxValue * Math.random());
  };

  getMillisecondCounter = (): number => {
    // TODO
    return 0;
  };

  getFirmwareVersion = (): number => {
    // TODO
    return 0;
  };

  log = (data: *): number => {
    console.log("BlocksDevice log", this.props.deviceIndex, data);
  };

  logHex = (data: number): number => {
    console.log("BlocksDevice logHex", this.props.deviceIndex, parseInt(data, 16));
  };

  getTimeInCurrentFunctionCall = (): number => {
    // TODO
    return 0;
  };

  ///////////////
  // api end
  ///////////////

  extractCustomFunctionsFromCode() {
    try {
      // eslint-disable-next-line
      const codeToExecute = eval(kCodeToExecute.replace('{{CUSTOM_CODE}}', this._customCode));
      console.debug('codeToExecute', codeToExecute, codeToExecute(this));
      return codeToExecute(this);
    } catch (e) {
      this.props.onCodeExecutionError(e);
      return null;
    }
  }

  getCustomFunction(functionName: string): Function {
    if (this._customFunctions[functionName] != null) {
      return this._customFunctions[functionName];
    } else {
      return () => { };
    }
  }

  injectCustomCode() {
    console.debug('customCode');
    const customFunctions = this.extractCustomFunctionsFromCode();
    console.debug('customFunctions', customFunctions);
    if (customFunctions === null) {
      return;
    }
    this._customFunctions = customFunctions;
  }

  sendPingSysEx = () => {
    this.sendSysEx([0x01, 0x03, 0x00], 0x63);
  };

  sendDisableSysEx = () => {
    if (this.props.deviceIndex === 0) {
      return
    }
    this.sendSysEx([0x01, 0x02, 0x00], 0x60);
  };

  componentWillReceiveProps(newProps: BlocksDeviceProps) {
    if (this.props.code !== newProps.code) {
      console.debug('BlocksDevice componentWillReceiveProps update code', this.props.deviceIndex, this._isOpened);
      const isOpened = this._isOpened;
      if (isOpened) {
        this.closeDevice();
      }
      this.checkAndUpdateCustomCode(newProps.code);
      if (isOpened) {
        this.openDevice();
      }
    }
  }

  componentDidMount() {
    console.debug('BlocksDevice componentDidMount', this.props.deviceIndex, this._isOpened)
    this.checkAndUpdateCustomCode(this.props.code);
    if (this.props.topology.props.enabled) {
      this.openDevice();
    }
  }

  componentWillUnmount() {
    console.debug('BlocksDevice componentWillUnmount', this.props.deviceIndex, this._isOpened)
    this.closeDevice();
  }

  render() {
    return (
      <div>
        {this.onRenderDeviceInterface()}
      </div>
    );
  }
}

export default BlocksDevice;