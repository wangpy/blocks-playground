// @flow

import * as React from 'react';
import { BitmapLED } from './BitmapLED';
import { BlocksDevice, type BlocksDeviceProps } from './BlocksDevice';

import './Lightpad.css';

export class Lightpad extends BlocksDevice {
  _bitmapLED: ?BitmapLED;
  _element: *;
  _isMouseDown: boolean;
  _simulatedTouches: Array<*>;
  _repaintIntervalID: ?IntervalID;
  _touches: {}

  constructor(props: BlocksDeviceProps) {
    super(props);
    this._bitmapLED = null;
    this._element = null;
    this._isMouseDown = false;
    this._simulatedTouches = [];
    this._repaintIntervalID = null;
    this._touches = {};
  }

  onDeviceIsReady = () => {
    console.debug('Lightpad is ready');

    if (this._bitmapLED != null) {
      this._bitmapLED.resetState();
    }
    this._touches = {};
    this._simulatedTouches = [];
    this._isMouseDown = false;

    try {
      this.getCustomFunction('initialise')();

      if (this._repaintIntervalID === null) {
        this._repaintIntervalID = setInterval(this.handleRepaint, 40);
      }
    } catch (e) {
      this.handleCodeExecutionError(e);
    }
  };

  onDeviceWillClose = () => {
    if (this._repaintIntervalID != null) {
      clearInterval(this._repaintIntervalID);
      this._repaintIntervalID = null;
    }
  }

  onGetBitmapLED = (): ?BitmapLED => {
    return this._bitmapLED;
  };

  onRenderDeviceInterface = () => this.renderDeviceInterface();

  onDeviceTouchStart = (touchIndex: number, x: number, y: number, vz: number) => {
    console.debug('onDeviceTouchStart', touchIndex, x, y, vz);
    this._touches[touchIndex] = { x, y, vz };
    this.forceUpdate();
  };

  onDeviceTouchMove = (touchIndex: number, x: number, y: number, vz: number) => {
    console.debug('onDeviceTouchMove', touchIndex, x, y, vz);
    this._touches[touchIndex] = { x, y, vz };
    this.forceUpdate();
  };

  onDeviceTouchEnd = (touchIndex: number, x: number, y: number, vz: number) => {
    console.debug('onDeviceTouchEnd', touchIndex, x, y, vz);
    delete this._touches[touchIndex];
    this.forceUpdate();
  };

  handleRepaint = () => {
    const bitmapLED = this._bitmapLED;
    if (bitmapLED != null) {
      const isLastDataChangePacketAcked = this.isLastDataChangePacketAcked();
      console.debug('handleRepaint', isLastDataChangePacketAcked);
      bitmapLED.beginUpdate(isLastDataChangePacketAcked);
      console.profile('updateBitmapData');

      try {
        this.getCustomFunction('repaint')();
      } catch (e) {
        this.handleCodeExecutionError(e);

        if (this._repaintIntervalID != null) {
          clearInterval(this._repaintIntervalID);
        }
      }

      console.profileEnd('updateBitmapData');
      if (isLastDataChangePacketAcked) {
        console.profile('getDataChangeListMessage');
        const message = bitmapLED.endUpdateAndGetDataChangeListMessage();
        console.profileEnd('getDataChangeListMessage');

        if (message != null) {
          this.sendSysEx(message);
          this.increasePacketCounter();
        }
      } else {
        bitmapLED.endUpdate();
      }
    }
  }

  handleMouseDown = (e: MouseEvent) => {
    if (this._element === null) {
      return;
    }
    const rect = this._element.getBoundingClientRect();
    const ex = e.pageX - rect.left;
    const ey = e.pageY - rect.top;
    const x = 4096 * ex / 364;
    const y = 4096 * ey / 364;
    this.handleDeviceTouchStart(1, parseInt(x, 10), parseInt(y, 10), 200);
    this._isMouseDown = true;
  };

  handleMouseMove = (e: MouseEvent) => {
    if (this._element === null || !this._isMouseDown) {
      return;
    }
    const rect = this._element.getBoundingClientRect();
    const ex = e.pageX - rect.left;
    const ey = e.pageY - rect.top;
    const x = 4096 * ex / 364;
    const y = 4096 * ey / 364;
    this.handleDeviceTouchMove(1, parseInt(x, 10), parseInt(y, 10), 200);
  };

  handleMouseUp = (e: MouseEvent) => {
    if (this._element === null) {
      return;
    }
    const rect = this._element.getBoundingClientRect();
    const ex = e.pageX - rect.left;
    const ey = e.pageY - rect.top;
    const x = 4096 * ex / 364;
    const y = 4096 * ey / 364;
    this.handleDeviceTouchEnd(1, parseInt(x, 10), parseInt(y, 10), 200);
    this._isMouseDown = false;
  };

  getSimulatedTouchIndexById(idToFind: number): number {
    for (let i = 0; i < this._simulatedTouches.length; i++) {
      if (i === this._simulatedTouches[i].identifier) {
        return i;
      }
    }
    return -1;
  }

  handleTouchStart = (e: TouchEvent) => {
    if (this._element === null) {
      return;
    }
    const rect = this._element.getBoundingClientRect();
    const touches = e.changedTouches;
    for (let i = 0; i < touches.length; i++) {
      const touch = touches[i];
      this._simulatedTouches.push(touch);
      const touchIndex = this.getSimulatedTouchIndexById(touch.identifier);
      const ex = touch.pageX - rect.left;
      const ey = touch.pageY - rect.top;
      const ez = 0.8; //const ez = (touch.force != null) ? parseFloat(touch.force) : 0.8;
      const x = 4096 * ex / 364;
      const y = 4096 * ey / 364;
      const z = 255 * ez;
      this.handleDeviceTouchStart(1 + touchIndex, parseInt(x, 10), parseInt(y, 10), parseInt(z, 10));
    }
    e.preventDefault();
  };

  handleTouchMove = (e: TouchEvent) => {
    if (this._element === null) {
      return;
    }
    const rect = this._element.getBoundingClientRect();
    const touches = e.changedTouches;
    for (let i = 0; i < touches.length; i++) {
      const touch = touches[i];
      const touchIndex = this.getSimulatedTouchIndexById(touch.identifier);
      const ex = touch.pageX - rect.left;
      const ey = touch.pageY - rect.top;
      const ez = 0.8; //const ez = (touch.force != null) ? parseFloat(touch.force) : 0.8;
      const x = 4096 * ex / 364;
      const y = 4096 * ey / 364;
      const z = 255 * ez;
      this.handleDeviceTouchMove(1 + touchIndex, parseInt(x, 10), parseInt(y, 10), parseInt(z, 10));
    }
    e.preventDefault();
  };

  handleTouchEnd = (e: TouchEvent) => {
    if (this._element === null) {
      return;
    }
    const rect = this._element.getBoundingClientRect();
    const touches = e.changedTouches;
    for (let i = 0; i < touches.length; i++) {
      const touch = touches[i];
      const touchIndex = this.getSimulatedTouchIndexById(touch.identifier);
      const ex = touch.pageX - rect.left;
      const ey = touch.pageY - rect.top;
      const ez = 0.8; //const ez = (touch.force != null) ? parseFloat(touch.force) : 0.8;
      const x = 4096 * ex / 364;
      const y = 4096 * ey / 364;
      const z = 255 * ez;
      this.handleDeviceTouchEnd(1 + touchIndex, parseInt(x, 10), parseInt(y, 10), parseInt(z, 10));
      // remove touch
      this._simulatedTouches.splice(touchIndex, 1);
    }
    e.preventDefault();
  };

  componentDidMount() {
    console.debug('Lightpad componentDidMount');
    super.componentDidMount();
  }

  componentWillReceiveProps(newProps: BlocksDeviceProps) {
    console.debug('Lightpad componentWillReceiveProps');
    super.componentWillReceiveProps(newProps);
  }

  componentWillUnmount() {
    super.componentWillUnmount();
  }

  renderActiveTouches() {
    const touches = []
    for (const key in this._touches) {
      const touch = this._touches[key];
      const padding = 80 * touch.vz / 255;
      const x = 374 * touch.x / 4096;
      const y = 374 * touch.y / 4096;
      const style = {
        left: x - padding,
        top: y - padding,
        padding
      };
      touches.push(<div className="touch" key={key} style={style}></div>);
    }
    return touches;
  }

  renderDeviceInterface = () => (
    <div
      className="lightpad"
      onMouseDown={this.handleMouseDown}
      onMouseMove={this.handleMouseMove}
      onMouseUp={this.handleMouseUp}
      onMouseLeave={this.handleMouseUp}
      onTouchStart={this.handleTouchStart}
      onTouchMove={this.handleTouchMove}
      onTouchEnd={this.handleTouchEnd}
      onTouchCancel={this.handleTouchEnd}
      ref={(c) => this._element = c}>
      <BitmapLED device={this}
        dataOffset={113} numColumns={15} numRows={15}
        ref={(c) => this._bitmapLED = c}
      />
      {this.renderActiveTouches()}
      <div className="device-name">{this.props.deviceIndex === 0x3F ? 'Simulated Lightpad' : 'Lightpad Device'}</div>
    </div>
  )
}

export default Lightpad;