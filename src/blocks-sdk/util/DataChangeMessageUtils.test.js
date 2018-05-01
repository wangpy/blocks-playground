import { computeDataChangeListMessage } from "./DataChangeMessageUtils";

/*
  bitwise data by fields:
  0000002 
  00 0000000 0000001
  011
  011100 01   # 113 (0x71)
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
  expect(message).toEqual([[0x02, 0x01, 0x00, 0x2C, 0x1C, 0x7E, 0x7F, 0x5F, 0x00]]);
});


test('Packed7BitArrayBuilderTestShortWithShortSize', () => {
  const message = computeDataChangeListMessage(new Uint8Array([0xFF, 0xFF]), new Uint8Array([0x00, 0x00]), 113, 2, 1);
  expect(message).toEqual([[0x02, 0x01, 0x00, 0x2C, 0x1C, 0x7E, 0x7F, 0x5F, 0x00]]);
});

// should be the same data as Packed7BitArrayBuilderTestShort
test('Packed7BitArrayBuilderTestLong', () => {
  let arr1 = new Uint8Array(450);
  let arr2 = new Uint8Array(450);
  arr1.fill(0xFF, 0, 2);
  const message = computeDataChangeListMessage(arr1, arr2, 113, 450, 1);
  expect(message).toEqual([[0x02, 0x01, 0x00, 0x2C, 0x1C, 0x7E, 0x7F, 0x5F, 0x00]]);
});

/*
test('Packed7BitArrayBuilderTestSplitSimple', () => {
  let arr1 = new Uint8Array(450);
  let arr2 = new Uint8Array(450);
  arr1.fill(0xFF, 0, 2);
  for (let i = 0; i < 256; i++) {
    arr1[i] = i;
  }
  const message = computeDataChangeListMessage(arr1, arr2, 113, 450, 1);
  expect(message).toEqual([[]]);
});
*/

/*
  PACKET 1
  bitwise data by fields:
  0000010
  00 0000000 0000001
  011
  011100 01   # 113 (0x71)
  10 0
  000 00001
  0
  00 0
  merged bits =>
  0000010
  0000001
  0000000
  01 011 00
  0 011100
  000001 10
  000 0 000
  merged hex answer => 02 01 00 2C 1C 06 00
*/
/*
  PACKET 2
  bitwise data by fields:
  0000010
  00 0000000 0000010
  011
  011100 10   # 114 (0x72)
  10 0
  000 00010
  0
  00 0
  merged bits =>
  0000010
  0000001
  0000000
  10 011 00
  0 011100
  000010 10
  000 0 000
  merged hex answer => 02 02 00 4C 1C 0A 00
*/
/*
  PACKET 3
  bitwise data by fields:
  0000010
  00 0000000 00000011
  011
  011100 11   # 115 (0x73)
  10 0
  000 00011
  0
  000
  merged bits =>
  0000010
  0000010
  0000000
  11 011 00
  0 011100
  00011 10
  001 0 000
  merged hex answer => 02 03 00 6C 1C 0E 10
*/

// FIXME: each of packet should represent an atomic change to heap.
// The 2nd packet should prepend skip bytes to where update ends.
test('Packed7BitArrayBuilderTestShortWithShortSize', () => {
  const message = computeDataChangeListMessage(new Uint8Array([0x01, 0x02, 0x03]), new Uint8Array([0x00, 0x00, 0x00]), 113, 3, 1, 7);
  expect(message).toEqual([
    [0x02, 0x01, 0x00, 0x2C, 0x1C, 0x06, 0x00],
    [0x02, 0x02, 0x00, 0x4C, 0x1C, 0x0A, 0x00],
    [0x02, 0x03, 0x00, 0x6C, 0x1C, 0x0E, 0x10]
  ]);
});
