// @flow

import { assert } from '../base/assert';

export function to2DigitHex(value: number): string {
  return (value < 16 ? "0" : "") + value.toString(16).toUpperCase();
}

export function dumpUint8ArrayToHexString(arr: Uint8Array): string {
  var result = "";
  for (var i = 0; i < arr.length; i++) {
    result += (i > 0 ? " " : "") + to2DigitHex(arr[i]);
  }
  return result;
}

type Packed7BitArrayBuilderState = {
  bytesWritten: number,
  bitsInCurrentByte: number
};

/*
Ex1:
bitwise data by fields:
0000
0010 011
000
merged bits =>
011 0000
000 0010
merged hex answer => 30 02
 
Ex2:
*/
export class Packed7BitArrayBuilder {
  _data: Array<number>;
  _allocatedBytes: number; // not used now
  _bytesWritten: number;
  _bitsInCurrentByte: number;

  constructor(allocateBytes: number = 0) {
    this._data = [];
    this._allocatedBytes = allocateBytes;
    this._bytesWritten = 0;
    this._bitsInCurrentByte = 0;
  }

  clone(): Packed7BitArrayBuilder {
    const result = new Packed7BitArrayBuilder(this._allocatedBytes);
    result._data = this._data;
    result._bytesWritten = this._bytesWritten;
    result._bitsInCurrentByte = this._bitsInCurrentByte;
    return result;
  }

  getData(): Array<number> {
    return this._data.slice(0, this.size());
  }

  size(): number {
    return this._bytesWritten + (this._bitsInCurrentByte > 0 ? 1 : 0);
  }

  hasCapacity(bitsNeeded: number): boolean {
    if (this._allocatedBytes === 0) {
      return true;
    }
    return ((this._bytesWritten + 2) * 7 + this._bitsInCurrentByte + bitsNeeded) <= this._allocatedBytes * 7;

  }

  writeBits(value: number, numBits: number) {
    assert(numBits <= 32);
    assert(this.hasCapacity(numBits));
    assert(numBits === 32 || (value >> numBits) === 0);

    while (numBits > 0) {
      if (this._bitsInCurrentByte === 0) {
        if (numBits < 7) {
          this._data[this._bytesWritten] = value & 0x7F;
          this._bitsInCurrentByte = numBits;
          return;
        }

        if (numBits === 7) {
          this._data[this._bytesWritten++] = value & 0x7F;
          return;
        }

        this._data[this._bytesWritten++] = (value & 0x7F);
        value >>= 7;
        numBits -= 7;
      } else {
        const bitsToDo = Math.min(7 - this._bitsInCurrentByte, numBits);

        this._data[this._bytesWritten] |= ((value & ((1 << bitsToDo) - 1)) << this._bitsInCurrentByte);
        value >>= bitsToDo;
        numBits -= bitsToDo;
        this._bitsInCurrentByte += bitsToDo;

        if (this._bitsInCurrentByte === 7) {
          this._bitsInCurrentByte = 0;
          this._bytesWritten++;
        }
      }
    }
  }

  getState(): Packed7BitArrayBuilderState {
    const bytesWritten = this._bytesWritten;
    const bitsInCurrentByte = this._bitsInCurrentByte;
    return { bytesWritten, bitsInCurrentByte };
  }

  restore(state: Packed7BitArrayBuilderState) {
    this._bytesWritten = state.bytesWritten;
    this._bitsInCurrentByte = state.bitsInCurrentByte;
  }
}