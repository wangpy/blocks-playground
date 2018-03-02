// @flow

import * as React from 'react';
import { assert } from '../base/assert';
import { computeDataChangeListMessage } from '../util/DataChangeMessageUtils';
import { BlocksDevice } from './BlocksDevice';
import { to2DigitHex } from '../util/BitConversionUtils';

import './BitmapLED.css';

export opaque type Color = number; // 32-bit color

const kPressurePointRange = 5;
type ColorElement = {
  alpha: number,
  red: number,
  green: number,
  blue: number
};

type PressurePoint = {
  floatX: number,
  floatY: number,
  floatZ: number,
  argb: Color,
  age: number,
};

function toHTMLColor(argb: Color): string {
  const ce = toColorElement(argb);
  return `#${to2DigitHex(ce.red)}${to2DigitHex(ce.green)}${to2DigitHex(ce.blue)}`;
}

function toColorElement(argb: Color): ColorElement {
  return {
    alpha: (argb >> 24) & 0xFF,
    red: (argb >> 16) & 0xFF,
    green: (argb >> 8) & 0xFF,
    blue: argb & 0xFF
  };
}

function colorElementToString(ce: ColorElement) {
  return `Color(${ce.alpha}, ${ce.red}, ${ce.green}, ${ce.blue})`;
}

function to16bitColor(argb: Color): number {
  const ce = toColorElement(argb);
  const a = ce.alpha / 255;
  const r = ((ce.red * a) >> 3) & 0x1F;
  const g = ((ce.green * a) >> 2) & 0x3F;
  const b = ((ce.blue * a) >> 3) & 0x1F;
  return (b << 11) | (g << 5) | r;
}

function to16bitColorArray(arr32bit: Uint32Array): Uint16Array {
  const result = new Uint16Array(arr32bit.length);
  for (let i = 0; i < arr32bit.length; i++) {
    result[i] = to16bitColor(arr32bit[i]);
  }
  return result;
}

export function makeARGB(alpha: number, red: number, green: number, blue: number): Color {
  return ((alpha & 0xFF) << 24) | ((red & 0xFF) << 16) | ((green & 0xFF) << 8) | (blue & 0xFF);
}

export function blendARGB(baseColor: Color, overlaidColor: Color): Color {
  const ce1 = toColorElement(overlaidColor);
  const ce2 = toColorElement(baseColor);
  const a1 = ce1.alpha / 255;
  const a2 = ce2.alpha / 255;
  const newAlpha = a1 + a2 * (1 - a1);
  const rc = {
    alpha: Math.round(255 * newAlpha),
    red: Math.round((ce1.red * a1 + ce2.red * a2 * (1 - a1)) / newAlpha),
    green: Math.round((ce1.green * a1 + ce2.green * a2 * (1 - a1)) / newAlpha),
    blue: Math.round((ce1.blue * a1 + ce2.blue * a2 * (1 - a1)) / newAlpha),
  };
  console.log('blendARGB', colorElementToString(ce1), colorElementToString(ce2), colorElementToString(rc));
  return makeARGB(rc.alpha, rc.red, rc.green, rc.blue);
}

function mixARGB(c1: Color, c2: Color, ratio1: number, ratio2: number): Color {
  const ce1 = toColorElement(c1);
  const ce2 = toColorElement(c2);
  const totalRatio = ratio1 + ratio2;
  return makeARGB(
    Math.round((ce1.alpha * ratio1 + ce2.alpha * ratio2) / totalRatio),
    Math.round((ce1.red * ratio1 + ce2.red * ratio2) / totalRatio),
    Math.round((ce1.green * ratio1 + ce2.green * ratio2) / totalRatio),
    Math.round((ce1.blue * ratio1 + ce2.blue * ratio2) / totalRatio),
  );
}

type Props = {
  device: BlocksDevice,
  dataOffset: number,
  numColumns: number,
  numRows: number
};

type State = {
}

export class BitmapLED extends React.Component<Props, State> {
  _colorArr: Uint32Array;
  _dataArr: Uint16Array;
  _baseDataArr: Uint16Array;
  _pressureMap: Array<PressurePoint>;
  _isInUpdate: boolean;

  constructor(props: Props) {
    super(props);
    this.resetState();
  }

  resetState() {
    const { numColumns, numRows } = this.props;
    this._colorArr = new Uint32Array(numColumns * numRows);
    this._dataArr = new Uint16Array(numColumns * numRows);
    this._baseDataArr = new Uint16Array(numColumns * numRows);
    this._pressureMap = [];
  }

  beginUpdate(shouldUpdateBaseData: boolean) {
    assert(!this._isInUpdate);
    if (shouldUpdateBaseData) {
      this._baseDataArr = this._dataArr;
    }
    this._isInUpdate = true;
  }

  getIndex(x: number, y: number): number {
    return x + y * this.props.numColumns;
  }

  getPixel(x: number, y: number): Color {
    if (x < 0 || x >= this.props.numColumns || y < 0 || y >= this.props.numRows) {
      return 0;
    }
    return this._colorArr[this.getIndex(x, y)];
  }

  endUpdate() {
    assert(this._isInUpdate);
    this._isInUpdate = false;
    this.forceUpdate();
  }

  endUpdateAndGetDataChangeListMessage(): ?Array<number> {
    this.endUpdate();
    this._dataArr = to16bitColorArray(this._colorArr);
    let hasDiff = false;
    for (let i = 0; i < this._dataArr.length; i++) {
      if (this._dataArr[i] !== this._baseDataArr[i]) {
        hasDiff = true;
        break;
      }
    }
    if (!hasDiff) {
      return null;
    }

    return computeDataChangeListMessage(
      new Uint8Array(this._dataArr.buffer),
      new Uint8Array(this._baseDataArr.buffer),
      this.props.dataOffset,
      this._dataArr.byteLength,
      this.props.device._packetCounter
    );
  }

  ///////////////
  // api start
  ///////////////

  fillPixel(rgb: Color, x: number, y: number) {
    if (x < 0 || x >= this.props.numColumns || y < 0 || y >= this.props.numRows) {
      return;
    }
    const argb = rgb | 0xFF0000000;
    this._colorArr[this.getIndex(x, y)] = argb;
  }

  blendPixel(argb: Color, x: number, y: number) {
    this.fillPixel(blendARGB(this.getPixel(x, y), argb), x, y);
  }

  fillRect(rgb: Color, x: number, y: number, width: number, height: number) {
    const argb = rgb | 0xFF0000000;
    for (let j = y; j < (y + height); j++) {
      for (let i = x; i < (x + width); i++) {
        this.fillPixel(argb, i, j);
      }
    }
  }

  blendRect(argb: Color, x: number, y: number, width: number, height: number) {
    for (let j = y; j < (y + height); j++) {
      for (let i = x; i < (x + width); i++) {
        this.blendPixel(argb, i, j);
      }
    }
  }

  blendGradientRect(colorNW: Color, colorNE: Color, colorSW: Color, colorSE: Color, x: number, y: number, width: number, height: number) {
    for (let j = y; j < (y + height); j++) {
      const colorW = mixARGB(colorNW, colorSW, y + height - 1 - j, j - y);
      const colorE = mixARGB(colorNE, colorSE, y + height - 1 - j, j - y);
      for (let i = x; i < (x + width); i++) {
        const argb = mixARGB(colorW, colorE, x + width - 1 - i, i - x);
        this.blendPixel(argb, i, j);
      }
    }
  }

  addPressurePoint(argb: Color, floatX: number, floatY: number, floatZ: number) {
    this._pressureMap.push({ floatX, floatY, floatZ, argb, age: 0 });
    //console.debug('addPressurePoint', this._pressureMap);
  }

  drawPressureMap() {
    this._pressureMap.forEach((pp) => {
      const x = Math.floor(15 * pp.floatX / 4095);
      const y = Math.floor(15 * pp.floatY / 4095);
      const z = pp.floatZ / 255;
      const argb = toColorElement(pp.argb);
      const offset = (kPressurePointRange - 1) / 2;
      this.blendRect(
        makeARGB(Math.floor(argb.alpha * z / (pp.age + 1)), argb.red, argb.green, argb.blue),
        x - offset, y - offset, kPressurePointRange, kPressurePointRange);
    });
    //console.debug('drawPressureMap', this._pressureMap);
  }

  fadePressureMap() {
    this._pressureMap.forEach((pressurePoint) => {
      pressurePoint.age++;
    });
    this._pressureMap = this._pressureMap.filter(pressurePoint => pressurePoint.age <= 10);
    //console.debug('fadePressureMap', this._pressureMap);
  }

  clearDisplay(rgb: Color = 0) {
    const argb = rgb | 0xFF000000;
    this._colorArr.fill(argb, this.getIndex(0, 0), this.getIndex(this.props.numColumns, this.props.numRows));
  }

  ///////////////
  // api end
  ///////////////

  renderBitmapLED() {
    let rows = [];
    for (let j = 0; j < this.props.numRows; j++) {
      let dots = [];
      for (let i = 0; i < this.props.numColumns; i++) {
        let style = {};
        const pixelValue = this.getPixel(i, j);
        if (pixelValue !== 0) {
          style.backgroundColor = toHTMLColor(this.getPixel(i, j));
        }
        dots.push(<div className="bitmap-led-dot" key={`bitmap-led-${i}-${j}`} style={style}></div>);
      }
      rows.push(<div className="bitmap-led-row" key={`bitmap-led-row-${j}`} >{dots}</div>);
    }
    return (
      <div className="bitmap-led">
        {rows}
      </div>
    );
  }

  render() {
    return (
      <div className="lightpad">
        {this.renderBitmapLED()}
      </div>
    );
  }
}

export default BitmapLED;