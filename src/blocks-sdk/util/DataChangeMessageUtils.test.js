import { computeDataChangeListMessage } from "./DataChangeMessageUtils";

/*
  bitwise data by fields:
  0000002 
  00 0000000 0000001
  011
  011100 01
  10 0
  111 11111
  1
  11111 111
  0
  00 1
  merged bits =>
  0000002
  0000001
  0000000
  01 011 00
  0 011100
  11111 10
  111 1 111
  1 0 11111
  00
  merged hex answer => 02 01 00 2C 1C 7E 7F 5F 00
*/
test('Packed7BitArrayBuilderTestShort', () => {
  const message = computeDataChangeListMessage(new Uint8Array([0xFF, 0xFF]), new Uint8Array([0x00, 0x00]), 113, 2, 1);
  expect(message).toEqual([0x02, 0x01, 0x00, 0x2C, 0x1C, 0x7E, 0x7F, 0x5F, 0x00]);
});

// should be the same data as Packed7BitArrayBuilderTestShort
test('Packed7BitArrayBuilderTestLong', () => {
  let arr1 = new Uint8Array(450);
  let arr2 = new Uint8Array(450);
  arr1.fill(0xFF, 0, 2);
  const message = computeDataChangeListMessage(arr1, arr2, 113, 450, 1);
  expect(message).toEqual([0x02, 0x01, 0x00, 0x2C, 0x1C, 0x7E, 0x7F, 0x5F, 0x00]);
});