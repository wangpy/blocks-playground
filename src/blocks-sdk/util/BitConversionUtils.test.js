import { Packed7BitArrayBuilder } from "./BitConversionUtils";

/*
  bitwise data by fields:
  0000
  0010 011
  000
  merged bits =>
  011 0000
  000 0010
  merged hex answer => 30 02
*/
test('Packed7BitArrayBuilderTestSimple', () => {
  const builder = new Packed7BitArrayBuilder();
  builder.writeBits(0x00, 4);
  builder.writeBits(0x13, 7);
  builder.writeBits(0x00, 3);
  expect(builder.size()).toEqual(2);
  const resultArr = builder.getData();
  expect(resultArr).toEqual([0x30, 0x02]);
});

/*
  bitwise data by fields:
  0000002 
  00 0000000 0000001
  011
  011100 01
  11 1
  010 00000
  1111 1111
  001
  merged bits =>
  0000002
  0000001
  0000000
  01 011 00
  1 011100
  00000 11
  1111 010
  001 1111
  merged hex answer => 02 01 00 2C 5C 03 7A 1F
*/
test('Packed7BitArrayBuilderTestComplex', () => {
  const builder = new Packed7BitArrayBuilder();
  builder.writeBits(0x02, 7);
  builder.writeBits(0x01, 16);
  builder.writeBits(0x03, 3);
  builder.writeBits(0x71, 8);
  builder.writeBits(0x07, 3);
  builder.writeBits(0x40, 8);
  builder.writeBits(0xFF, 8);
  builder.writeBits(0x01, 3);
  expect(builder.size()).toEqual(8);
  const resultArr = builder.getData();
  expect(resultArr).toEqual([0x02, 0x01, 0x00, 0x2C, 0x5C, 0x03, 0x7A, 0x1F]);
});