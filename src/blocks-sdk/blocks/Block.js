// @flow

// FIXME: move this file to util
import { assert } from '../base/assert';
import { dumpUint8ArrayToHexString } from '../util/BitConversionUtils';

function calculatePacketChecksum(arr: Uint8Array) {
  assert(arr.length > 8);
  let checksum = (arr.length - 8) & 0xFF;
  for (let i = 6; i < arr.length - 2; i++) {
    checksum += checksum * 2 + arr[i];
    checksum = checksum & 0xFF;
  }
  return checksum & 0x7F;
}

// FIXME: move this function to BlockDevice
export function buildBlockSysExData(deviceIndex: number, arr: Array<number>, checksumToVerify: ?number = null): Uint8Array {
  const data = new Uint8Array(arr.length + 8);
  data.set([0xF0, 0x00, 0x21, 0x10, 0x77]);
  data.set([deviceIndex], 5);
  data.set(arr, 6);
  data.set([0x00, 0xF7], arr.length + 6);
  const checksum = calculatePacketChecksum(data);
  data[data.length - 2] = checksum;
  if (checksumToVerify != null) {
    assert(checksum === checksumToVerify);
  }
  console.debug('buildBlockSysExData for messageAck', data.length, dumpUint8ArrayToHexString(data));
  return data;
}

export function buildBlockSysExDataArrayFromDump(dumpStr: string): Array<number> {
  const data = getPacketDataFromDumpString(dumpStr);
  return Array.from(data.subarray(6, data.length - 2));
}

// dump of bitmap LED program
export const blockProgramPacketDump1 = `
00  F0 00 21 10 77 32 02 01  00 30 5A 3E 47 0B 20 01
10  3A 00 10 71 01 12 4B 31  09 08 60 46 5F 25 11 40
20  05 02 28 61 01 17 54 11  40 10 36 78 21 12 6D 1C
30  30 5B 00 2E 28 63 00 23  6C 70 43 24 5A 39 60 32
40  01 28 09 41 0D 3E 28 24  10 1B 04 51 48 1A 0A 08
50  22 09 1B 2C 30 45 0D 2E  08 24 20 1B 1C 00 5B 6C
60  50 41 16 36 58 20 10 01  6D 50 40 2D 36 58 60 0B
70  01 6D 70 40 2D 3A 78 3F  00 0F 1C 78 4F 07 2E 28
80  78 08 19 04 52 06 15 01  48 24 00 21 64 10 48 1A
90  02 18 60 0C 01 4C 70 40  05 7C 3F 00 7F 0F 60 7F
A0  03 78 7F 00 7E 1F 40 7F  07 70 7F 01 7C 3F 00 7F
B0  0F 60 7F 03 78 7F 00 7E  1F 40 7F 07 70 7F 01 7C
C0  3F 00 7F 0F 00 00 7D F7
`;
export const blockProgramPacketDump2 = `
00  F0 00 21 10 77 32 02 02  00 0C 5C 7F 07 70 7F 01
10  7C 3F 00 7F 0F 60 7F 03  78 7F 00 7E 1F 40 7F 07
20  70 7F 01 7C 3F 00 7F 0F  60 7F 03 78 7F 00 7E 1F
30  40 7F 07 70 7F 01 7C 3F  00 7F 0F 60 7F 03 78 7F
40  00 7E 1F 40 7F 07 70 7F  01 7C 3F 00 7F 0F 60 7F
50  03 78 7F 00 1E 19 00 4B  00 00 F7
`;

export function getPacketDataFromDumpString(dumpStr: string): Uint8Array {
  const hexStr = dumpStr.split('\n')
    .map(line => line.trim())
    .map(line => line.length > 4 ? line.substr(4) : line)
    .join(' ').replace(/ {2}/g, ' ').trim();
  const length = Math.ceil(hexStr.length / 3);
  console.debug('hexStr', length, hexStr);
  const result = new Uint8Array(length);
  for (let i = 0; i < length; i++) {
    result[i] = parseInt(hexStr.substr(i * 3, 2), 16);
  }
  return result;
}


export class BlockLED {
  _ledData: Uint16Array;

}