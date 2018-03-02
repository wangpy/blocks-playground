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
  toString(): string;
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
    assert(endBit <= data.length * 8);
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
    return this._bits;
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

type MessageFieldDescription = {
  name: string,
  typeOrBits: string | number,
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
      if (typeof fieldDesc.typeOrBits === 'string') {
        // eslint-disable-next-line
        this._fields[fieldDesc.name] = eval(`new ${fieldDesc.typeOrBits}()`);
      } else {
        this._fields[fieldDesc.name] = new IntegerWithBitSize(fieldDesc.typeOrBits);
      }
      this._bits += this._fields[fieldDesc.name].bits;
    }
  }

  deserializeFromData(data: Uint8Array, bitPosition: number): number {
    let bitsProcessed = 0;
    for (const fieldDesc of this._messageFormat) {
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

//==============================================================================
export const DeviceCommands = {
  beginAPIMode: 0x00,
}

export const kPacketCounterMaxValue = 0x03FF; // 10 bit

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
