import { arrayEquals } from "./ArrayUtil";

test('arrayEqualsWithSameContentArray', () => {
  expect(arrayEquals([0x30, 0x02], [0x30, 0x02])).toEqual(true);
});

test('arrayEqualsWithDifferentContentArray', () => {
  expect(arrayEquals([0x30, 0x02], [0x30, 0x03])).toEqual(false);
});

test('arrayEqualsWithDifferentLengthArray', () => {
  expect(arrayEquals([0x30, 0x02], [0x30, 0x03, 0x00])).toEqual(false);
});