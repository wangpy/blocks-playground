// @flow

import { assert } from '../base/assert';

/** This value is incremented when the format of the API changes in a way which
    breaks compatibility.
*/

export const currentProtocolVersion = 1;

interface BitSerializedMessage {
  deserializeFromData(data: Uint8Array, bitPosition: number): number;
  bitSize(): number;
  toObject(): *;
  value(): *;
}

class IntegerWithBitSize implements BitSerializedMessage {
  _bits: number;
  _value: number;

  constructor(bits: number) {
    this._bits = bits;
    this._value = 0;
  }

  deserializeFromData(data: Uint8Array, bitPosition: number): number {
    const startBit = bitPosition;
    const endBit = bitPosition + this._bits;
    assert(endBit <= data.length * 8, 'endBit exceeds range of data length', startBit, endBit, data.length);
    if (endBit > data.length * 8) {
      this._value = 0;
      return 0;
    }

    let bitsReadInCurrentByte = startBit % 7;

    let numBits = this._bits;
    let value = 0;
    let bitsSoFar = 0;

    while (numBits > 0) {
      const byteIndex = Math.floor((startBit + bitsSoFar) / 7);
      const currentByte = data[byteIndex];
      const valueInCurrentByte = (currentByte >> bitsReadInCurrentByte);
      //console.debug('readByte', startBit+bitsSoFar, byteIndex, bitsReadInCurrentByte, currentByte.toString(16), valueInCurrentByte);

      const bitsAvailable = 7 - bitsReadInCurrentByte;

      if (bitsAvailable > numBits) {
        value |= ((valueInCurrentByte & ((1 << numBits) - 1)) << bitsSoFar);
        bitsReadInCurrentByte += numBits;
        break;
      }

      value |= (valueInCurrentByte << bitsSoFar);
      numBits -= bitsAvailable;
      bitsSoFar += bitsAvailable;
      bitsReadInCurrentByte = 0;
    }

    this._value = value;
    return this.bitSize();
  }

  bitSize(): number {
    return this._bits;
  }

  toObject(): number {
    return this._value;
  }

  value(): number {
    return this._value;
  }
}

class AsciiStringWithFixedLength implements BitSerializedMessage {
  _length: number;
  _value: string;

  constructor(length: number) {
    this._length = length;
    this._value = 0;
  }

  deserializeFromData(data: Uint8Array, bitPosition: number): number {
    const endBit = bitPosition + this._length * 7;
    assert(endBit <= data.length * 8);
    if (endBit > data.length * 8) {
      this._value = '';
      return 0;
    }

    const charValueField = new IntegerWithBitSize(7);
    let numChars = this._length;
    let pos = bitPosition;
    let strValue = '';
    while (numChars > 0) {
      pos += charValueField.deserializeFromData(data, pos);
      assert(pos !== 0);
      if (pos === 0) {
        return 0;
      }
      strValue += String.fromCharCode(charValueField.value());
      numChars--;
    }

    this._value = strValue;
    return this.bitSize();
  }

  bitSize(): number {
    return this._length * 7;
  }

  toObject(): string {
    return this._value;
  }

  value(): string {
    return this._value;
  }
}
type MessageFieldDescription = {
  name: string,
  typeOrBits: string | number,
  serializedInData: ?boolean, // default true
};

type MessageFormat = Array<MessageFieldDescription>;

type MessageFields = { [string]: BitSerializedMessage };

/*
class MessageList implements BitSerializedMessage {
  _list: Array<BitSerializedMessage>;
  _bits: number;

  constructor(messageFormat: MessageFormat) {
    this._list = [];
    this._bits = 0;
  }

  deserializeFromData(data: Uint8Array, bitPosition: number = 0): number {
    return 0;
  }

  bitSize(): number {
    return this._list.map(message => message.bitSize()).reduce((sum, value) => sum + value);
  }

  toObject(): Array<*> {
    return this._list.map(message => message.toObject());
  }

  value(): BitSerializedMessage {
    return this;
  }

  append(message: BitSerializedMessage): number {
    return message.bitSize();
  }
}
*/

class CompoundMessage implements BitSerializedMessage {
  _messageFormat: MessageFormat;
  _fields: MessageFields;
  _bits: number;

  constructor(messageFormat: MessageFormat) {
    this._messageFormat = messageFormat;
    this._initCompoundMessageFields();
  }

  _initCompoundMessageFields() {
    this._fields = {};
    this._bits = 0;
    for (const fieldDesc of this._messageFormat) {
      if (fieldDesc.serializedInData === false) {
        continue;
      }
      if (typeof fieldDesc.typeOrBits === 'string') {
        // eslint-disable-next-line
        this._fields[fieldDesc.name] = eval(`new ${fieldDesc.typeOrBits}()`);
      } else {
        this._fields[fieldDesc.name] = new IntegerWithBitSize(fieldDesc.typeOrBits);
      }
      this._bits += this._fields[fieldDesc.name].bitSize();
    }
  }

  deserializeFromData(data: Uint8Array, bitPosition: number): number {
    let bitsProcessed = 0;
    for (const fieldDesc of this._messageFormat) {
      if (fieldDesc.serializedInData === false) {
        continue;
      }
      bitsProcessed += this._fields[fieldDesc.name].deserializeFromData(data, bitPosition + bitsProcessed);
    }
    return bitsProcessed;
  }

  bitSize(): number {
    return this._bits;
  }

  getField(fieldName: string): * {
    if (fieldName in this._fields) {
      return this._fields[fieldName].value();
    }
    return null;
  }

  toObject(): Object {
    let obj = {};
    for (const fieldDesc of this._messageFormat) {
      obj[fieldDesc.name] = this._fields[fieldDesc.name].toObject();
    }
    return obj;
  }

  value(): BitSerializedMessage {
    return this;
  }
}

export const MessageFromDevice = {
  deviceTopology: 0x01,
  packetACK: 0x02,
  touchMove: 0x11,
  touchStartWithVelocity: 0x13,
  touchEndWithVelocity: 0x15,
};

export const MessageFromHost = {
  deviceCommandMessage: 0x01,
};


// eslint-disable-next-line
export class TouchPosition extends CompoundMessage {
  constructor() {
    super([
      { name: 'Xcoord', typeOrBits: 12 },
      { name: 'Ycoord', typeOrBits: 12 },
      { name: 'Zcoord', typeOrBits: 8 },
    ]);
  }
}

/** The velocities for each dimension of a touch. */
// eslint-disable-next-line
export class TouchVelocity extends CompoundMessage {
  constructor() {
    super([
      { name: 'VXcoord', typeOrBits: 8 },
      { name: 'VYcoord', typeOrBits: 8 },
      { name: 'VZcoord', typeOrBits: 8 },
    ]);
  }
}

export class BlockSerialNumber extends AsciiStringWithFixedLength {
  constructor() {
    super(16);
  }
}

//==============================================================================
export const DeviceCommands = {
  beginAPIMode: 0x00,
}

export const kPacketCounterMaxValue = 0x03FF; // 10 bit

export class TopologyMessageHeader extends CompoundMessage {
  constructor() {
    super([
      { name: 'messageType', typeOrBits: 7 },
      { name: 'protocolVersion', typeOrBits: 8 },
      { name: 'deviceCount', typeOrBits: 7 },
      { name: 'connectionCount', typeOrBits: 8 },
    ]);
  }
}

export class TopologyDeviceInfo extends CompoundMessage {
  constructor() {
    super([
      { name: 'blockSerialNumber', typeOrBits: 'BlockSerialNumber' },
      { name: 'topologyIndex', typeOrBits: 7 },
      { name: 'batteryLevel', typeOrBits: 5 },
      { name: 'batteryCharging', typeOrBits: 1 },
    ]);
  }
}

export class TopologyConnectionInfo extends CompoundMessage {
  constructor() {
    super([
      { name: 'deviceIndex1', typeOrBits: 7 },
      { name: 'portIndex1', typeOrBits: 5 },
      { name: 'deviceIndex2', typeOrBits: 7 },
      { name: 'portIndex2', typeOrBits: 5 },
    ]);
  }
}

export class DeviceTopologyMessage implements BitSerializedMessage {
  _messageHeader: TopologyMessageHeader;
  _topologyDevices: [TopologyDeviceInfo];
  _topologyConnections: [TopologyConnectionInfo];

  constructor() {
    this.init();
  }

  init() {
    this._messageHeader = new TopologyMessageHeader();
    this._topologyDevices = [];
    this._topologyConnections = [];
  }

  deserializeFromData(data: Uint8Array, bitPosition: number): number {
    this.init();
    let bitsProcessed = 0;
    bitsProcessed += this._messageHeader.deserializeFromData(data, bitPosition + bitsProcessed);
    console.debug('messageHeader', this._messageHeader);
    for (let i = 0; i < this._messageHeader.getField('deviceCount'); i++) {
      const deviceInfo = new TopologyDeviceInfo();
      bitsProcessed += deviceInfo.deserializeFromData(data, bitPosition + bitsProcessed);
      this._topologyDevices.push(deviceInfo);
      console.debug('deviceInfo', i, deviceInfo);
    }
    for (let i = 0; i < this._messageHeader.getField('connectionCount'); i++) {
      const connectionInfo = new TopologyConnectionInfo();
      bitsProcessed += connectionInfo.deserializeFromData(data, bitPosition + bitsProcessed);
      this._topologyConnections.push(connectionInfo);
      console.debug('connectionInfo', i, connectionInfo);
    }
    return bitsProcessed;
  }

  bitSize(): number {
    let len = this._messageHeader.bitSize();
    if (this._topologyDevices.length > 0)
      len += this._topologyDevices[0].bitSize() * this._topologyDevices.length;
    if (this._topologyConnections.length > 0)
      len += this._topologyConnections[0].bitSize() * this._topologyConnections.length;
    return len;
  }

  toObject(): Object {
    return {
      devices: this._topologyDevices.map(message => message.toObject()),
      connections: this._topologyConnections.map(message => message.toObject()),
      ...this._messageHeader.toObject()
    }
  }

  value(): BitSerializedMessage {
    return this;
  }
}

export class DeviceAckMessage extends CompoundMessage {
  constructor() {
    super([
      { name: 'messageType', typeOrBits: 7 },
      { name: 'packetCounter', typeOrBits: 10 },
    ]);
  }
}

export class TouchMessage extends CompoundMessage {
  constructor() {
    super([
      { name: 'messageType', typeOrBits: 7 },
      { name: 'deviceIndex', typeOrBits: 5 },
      { name: 'touchIndex', typeOrBits: 5 },
      { name: 'touchPosition', typeOrBits: 'TouchPosition' },
    ]);
  }
}

export class TouchWithVelocityMessage extends CompoundMessage {
  constructor() {
    super([
      { name: 'messageType', typeOrBits: 7 },
      { name: 'deviceIndex', typeOrBits: 5 },
      { name: 'touchIndex', typeOrBits: 5 },
      { name: 'touchPosition', typeOrBits: 'TouchPosition' },
      { name: 'touchVelocity', typeOrBits: 'TouchVelocity' },
    ]);
  }
}

export const kMessageStartBitInDataFromDevice = 39;

export function getBlocksMessageType(messageData: Uint8Array, bitPosition: number): number {
  const messageType = new IntegerWithBitSize(7);
  messageType.deserializeFromData(messageData, bitPosition);
  return messageType.value();
}
