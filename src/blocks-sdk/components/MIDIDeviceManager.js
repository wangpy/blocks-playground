// @flow

import * as React from 'react';

type Props = {
  onMIDIFailure(error: any): void,
  onMIDISuccess(): void,
  onMIDIStateChange(event: *): void,
  onMIDIMessage(message: *): void,
  sysex: boolean,
};

export type MIDIDevice = {
  inputPort: *,
  outputPort: *,
};

export class MIDIDeviceManager extends React.Component<Props> {
  _midi: any;
  _devices: { [string]: MIDIDevice };

  constructor(props: Props) {
    super(props);
    this._midi = null;
    this._devices = {};
    this.requestMidiAccess();
  }

  handleMIDISuccess = (midiAccess: any) => {
    console.debug("onMIDISuccess", midiAccess);
    this._midi = midiAccess;
    this._midi.onstatechange = this.handleMIDIStateChange;
    this._midi.inputs.forEach(port => this.isBlocksDevice(port) ? port.open() : null);
    this._midi.outputs.forEach(port => this.isBlocksDevice(port) ? port.open() : null);

    this.props.onMIDISuccess();
  };

  isBlocksDevice(port: *): boolean {
    console.debug('isBlockDevice', port.name, port);
    return (port.name === 'Lightpad BLOCK '
      || port.name === 'ROLI Lightpad BLOCK ') ? true : false;
  }

  addPortToDeviceMap(port: *) {
    const deviceName = port.name;
    if (!(deviceName in this._devices)) {
      this._devices[deviceName] = {};
    }
    if (port.type === 'input') {
      this._devices[deviceName].inputPort = port;
      port.onmidimessage = this.props.onMIDIMessage;
    } else if (port.type === 'output') {
      this._devices[deviceName].outputPort = port;
    }

    console.debug('addDevicePort', port, this._devices);
  }

  getMIDIDevice(deviceName: string): ?MIDIDevice {
    if (deviceName in this._devices) {
      return this._devices[deviceName];
    }
    return null;
  }

  handleMIDIStateChange = (event: *) => {
    console.debug('midiAccess onstatechange', event);

    if (event.port.connection === 'open') {
      if (event.port.type === 'input') {
        this.addPortToDeviceMap(event.port);
      } else if (event.port.type === 'output') {
        this.addPortToDeviceMap(event.port);
      }
    } else {
      if (this.isBlocksDevice(event.port)) {
        event.port.open();
      }
    }
    this.props.onMIDIStateChange(event);
  };

  handleMIDIFailure = (error: any) => {
    console.debug("onMIDIFailure", error);

    this.props.onMIDIFailure(error);
  };

  requestMidiAccess() {
    if (navigator.requestMIDIAccess) {
      navigator.requestMIDIAccess({
        sysex: this.props.sysex
      }).then(this.handleMIDISuccess.bind(this), this.handleMIDIFailure.bind(this));
    } else {
      alert("No MIDI support in your browser.");
    }
  }

  render() {
    return (
      <div></div>
    );
  }
}

export default MIDIDeviceManager;