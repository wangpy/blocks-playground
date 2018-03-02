// @flow

import * as React from 'react';
import { assert } from '../base/assert';
import {
  buildBlockSysExDataArrayFromDump,
  blockProgramPacketDump1,
  blockProgramPacketDump2
} from '../blocks/Block';
import {
  getBlocksMessageType,
  MessageFromDevice,
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

export const kMockDeviceIndex = 0x3F;

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
  
  {{CUSTOM_CODE}}

  return {
    initialise: (typeof initialise === 'function') ? initialise : null,
    repaint: (typeof repaint === 'function') ? repaint : null,
    touchStart: (typeof touchStart === 'function') ? touchStart : null,
    touchMove: (typeof touchMove === 'function') ? touchMove : null,
    touchEnd: (typeof touchEnd === 'function') ? touchEnd: null,
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
  onCodeExecutionError(error: *): void,
};

type State = {
  enabled: boolean
};

export class BlocksDevice extends React.Component<BlocksDeviceProps, State> {
  _ackCallback: ?Function;
  _deviceIsReady: boolean;
  _heartbeatIntervalID: ?IntervalID;
  _packetCounter: number;
  _ackedPacketCounter: number;
  _isOpened: boolean;
  _isErrorReported: boolean;
  _customCode: string;
  _customFunctions: CustomFunctions;

  constructor(props: BlocksDeviceProps) {
    super(props);
    this._ackCallback = null;
    this._deviceIsReady = false;
    this._heartbeatIntervalID = null;
    this._packetCounter = 0;
    this._ackedPacketCounter = 0;
    this._isOpened = false;
    this._isErrorReported = false;
    this._customCode = '';
    this._customFunctions = {
      initialize: null,
      repaint: null,
      touchStart: null,
      touchMove: null,
      touchEnd: null
    };
  }

  closeDevice() {
    if (!this._isOpened) {
      return;
    }

    this.onDeviceWillClose();

    if (this._heartbeatIntervalID != null) {
      clearInterval(this._heartbeatIntervalID);
      this._heartbeatIntervalID = null;
    }
    this._isOpened = false;
    this._isErrorReported = false;
    console.debug('closeDevice');
    this.setState({ enabled: false });
    this.sendDisableSysEx();
    this.setAckCallback(null);
  }

  openDevice() {
    if (this._isOpened) {
      return;
    }
    this._isOpened = true;
    console.debug('openDevice');
    this.setState({ enabled: true });
    this.sendEnableSysEx();
  }

  sendSysEx(dataArr: Array<number>, checksumToVerify: ?number) {
    this.props.topology.sendSysEx(this.props.deviceIndex, dataArr, checksumToVerify);
  }

  isLastDataChangePacketAcked() {
    return this._packetCounter === ((this._ackedPacketCounter + 1) & kPacketCounterMaxValue);
  }

  increasePacketCounter() {
    this._packetCounter = (this._packetCounter + 1) & kPacketCounterMaxValue;
  }

  setAckCallback(cb: ?Function, cbName: ?string) {
    setTimeout(() => {
      if (this.props.deviceIndex === kMockDeviceIndex) {
        if (cb != null) {
          cb.apply(this);
        }
      }
      this._ackCallback = cb;
      assert(this._ackCallback != null);
      if (cbName != null) {
        console.debug('setAckCallback', cbName);
      }
    }, 0);
  }

  checkAndUpdateCustomCode(newCode: string) {
    const customFunctions = this.extractCustomFunctionsFromCode();
    if (customFunctions === null) {
      console.debug('update code failed', newCode);
      return;
    }
    this._customCode = newCode;
    console.debug('update code success', newCode);
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
            console.debug('received ack', ackedPacketCounter, (this._ackCallback != null) ? 'hasAckCallback!' : '');
            this._ackedPacketCounter = ackedPacketCounter;
            if (this._ackCallback != null) {
              setTimeout(this._ackCallback, 100);
              this._ackCallback = null;
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

  sendEnableSysEx = () => {
    const { deviceIndex } = this.props;
    if (deviceIndex === 0) {
      return;
    }
    console.debug('sendEnableSysEx');
    this.sendSysEx([0x01, 0x02, 0x00], 0x60);
    this.sendSysEx([0x01, 0x00, 0x00], 0x5A);
    this.setAckCallback(this.sendEnableSysExPart2, 'sendEnableSysExPart2');
  };

  sendEnableSysExPart2 = () => {
    if (this.props.deviceIndex === 0) {
      return;
    }
    console.debug('sendEnableSysExPart2');
    this.sendSysEx([0x01, 0x00, 0x00], 0x5A);
    this.setAckCallback(this.enableHeartbeat, 'enableHeartbeat');
  };

  enableHeartbeat = () => {
    if (this.props.deviceIndex === 0) {
      return;
    }
    console.debug('enableHeartbeat');
    if (this._heartbeatIntervalID === null) {
      this._heartbeatIntervalID = setInterval(this.sendHeartbeatSysEx, 500);
    }
    this.sendSysEx([0x01, 0x03, 0x00], 0x63);
    this.setAckCallback(this.sendEnableSysExPart4, 'sendEnableSysExPart4');
  };

  sendEnableSysExPart4 = () => {
    if (this.props.deviceIndex === 0) {
      return;
    }
    console.debug('sendEnableSysExPart4');
    this.sendSysEx([0x10, 0x02], 0x44);
    this.setAckCallback(this.sendProgramDataSysEx, 'sendProgramDataSysEx');
  };

  sendProgramDataSysEx = () => {
    if (this.props.deviceIndex === 0) {
      return;
    }
    console.debug('sendProgramDataSysEx');
    this.sendSysEx([0x01, 0x03, 0x00], 0x63);
    setTimeout(this.sendProgramDataSysExPart2, 100);
  };

  sendProgramDataSysExPart2 = () => {
    if (this.props.deviceIndex === 0) {
      return;
    }
    console.debug('sendProgramDataSysExPart2');
    this.sendSysEx(buildBlockSysExDataArrayFromDump(blockProgramPacketDump1));
    this.sendSysEx(buildBlockSysExDataArrayFromDump(blockProgramPacketDump2));
    this._packetCounter = 3;
    this.setAckCallback(this.sendEnableSysExPart5, 'sendEnableSysExPart5');
  };

  sendEnableSysExPart5 = () => {
    if (this.props.deviceIndex === 0) {
      return;
    }
    console.debug('sendEnableSysExPart5');
    this.sendSysEx([0x01, 0x05, 0x00], 0x69);
    this.setAckCallback(this.handleDeviceIsReady, 'handleDeviceIsReady');
  };

  handleDeviceIsReady = () => {
    console.debug('handleDeviceIsReady');
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

  ///////////////
  // api start
  ///////////////

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
    console.debug('customCode', this._customCode);
    const customFunctions = this.extractCustomFunctionsFromCode();
    console.debug('customFunctions', customFunctions);
    if (customFunctions === null) {
      return;
    }
    this._customFunctions = customFunctions;
  }

  sendHeartbeatSysEx = () => {
    this.sendSysEx([0x01, 0x03, 0x00], 0x63);
  };

  sendDisableSysEx = () => {
    if (this.props.deviceIndex === 0) {
      return
    }
    this.sendSysEx([0x01, 0x02, 0x00], 0x60);
  };

  componentWillReceiveProps(newProps: BlocksDeviceProps) {
    console.debug('BlocksDevice componentWillReceiveProps')
    if (this.props.code !== newProps.code) {
      console.debug('update code', newProps.code);
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
    console.debug('BlocksDevice componentDidMount', this.props.code)
    this.checkAndUpdateCustomCode(this.props.code);
    if (this.props.topology.props.enabled) {
      this.openDevice();
    }
  }

  componentWillUnmount() {
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