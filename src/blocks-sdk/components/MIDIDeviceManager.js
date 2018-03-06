// @flow

import * as React from 'react';
import {
  Dropdown,
  DropdownToggle,
  DropdownMenu,
  DropdownItem
} from 'reactstrap';

import './MIDIDeviceManager.css';

export type MIDIDevice = {
  inputPort: *,
  outputPort: *,
};

type Props = {
  onMIDIFailure(error: any): void,
  onMIDISuccess(): void,
  onMIDIStateChange(event: *): void,
  onMIDIMessage(message: *): void,
  sysex: boolean,
};

type State = {
  isInputDropdownOpen: boolean,
  isOutputDropdownOpen: boolean,
  selectedInputPort: *,
  selectedOutputPort: *,
};

export class MIDIDeviceManager extends React.Component<Props, State> {
  _midi: any;
  _devices: { [string]: MIDIDevice };

  constructor(props: Props) {
    super(props);
    this._midi = null;
    this._devices = {};
    this.state = {
      isInputDropdownOpen: false,
      isOutputDropdownOpen: false,
      selectedInputPort: null,
      selectedOutputPort: null,
    }
    this.requestMidiAccess();
  }

  handleMIDISuccess = (midiAccess: any) => {
    console.debug("onMIDISuccess", midiAccess);
    midiAccess.onstatechange = this.handleMIDIStateChange;
    for (const port of midiAccess.inputs.values()) {
      if (this.isBlocksDevice(port)) {
        port.open();
      }
    }
    for (const port of midiAccess.outputs.values()) {
      if (this.isBlocksDevice(port)) {
        port.open();
      }
    }
    this._midi = midiAccess;

    this.props.onMIDISuccess();

    this.forceUpdate();
  };

  isBlocksDevice(port: *): boolean {
    console.debug('isBlockDevice', port.name, port);
    return (port.name.indexOf('Lightpad BLOCK ') >= 0) ? true : false;
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

  requestMidiAccess() {
    if (navigator.requestMIDIAccess) {
      navigator.requestMIDIAccess({
        sysex: this.props.sysex
      }).then(this.handleMIDISuccess.bind(this), this.handleMIDIFailure.bind(this));
    } else {
      alert("No MIDI support in your browser.");
    }
  }

  sendMidiDataToSelectedOutputPort(data: Uint8Array) {
    if (this.state.selectedOutputPort != null) {
      this.state.selectedOutputPort.send(data);
    }
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

    this.forceUpdate();
  };

  handleMIDIFailure = (error: any) => {
    console.debug("onMIDIFailure", error);

    this.props.onMIDIFailure(error);
  };

  handleToggleInputPortDropdown = () => {
    this.setState({ isInputDropdownOpen: !this.state.isInputDropdownOpen });
  };

  handleToggleOutputPortDropdown = () => {
    this.setState({ isOutputDropdownOpen: !this.state.isOutputDropdownOpen });
  };

  handlePortSelected = (port: *, portType: string) => {
    if (portType === 'input') {
      this.setState({ selectedInputPort: port });
    } else { // (portType === 'output')
      this.setState({ selectedOutputPort: port });
    }
  };

  renderDropdownMenuForPorts(ports: *, portType: string) {
    console.debug('renderDropdownMenuForPorts', ports, portType);
    const items = [];
    for (const port of ports.values()) {
      if (!this.isBlocksDevice(port)) {
        const isSelected = (this.state.selectedInputPort === port
          || this.state.selectedOutputPort === port);
        items.push(
          <DropdownItem
            className={isSelected ? 'selected-port' : ''}
            onClick={this.handlePortSelected.bind(this, port, portType)}>
            {port.name}
          </DropdownItem>
        );
      }
    }
    const isOffSelected = ((portType === 'input' && this.state.selectedInputPort == null)
      || (portType === 'output' && this.state.selectedOutputPort == null))
    return (
      <DropdownMenu>
        {items}
        <DropdownItem divider />
        <DropdownItem
          className={isOffSelected ? 'selected-port' : ''}
          onClick={this.handlePortSelected.bind(this, null, portType)}>
          Off
        </DropdownItem>
      </DropdownMenu>
    )
  };

  render() {
    if (this._midi == null) {
      return (<div className="midi-device-manager"></div>);
    }
    const midi = this._midi;
    return (
      <div className="midi-device-manager">
        <Dropdown
          className="ports-dropdown"
          isOpen={this.state.isInputDropdownOpen}
          toggle={this.handleToggleInputPortDropdown}>
          <DropdownToggle caret>
            MIDI Input: {this.state.selectedInputPort != null ? this.state.selectedInputPort.name : 'Off'}
          </DropdownToggle>
          {this.renderDropdownMenuForPorts(midi.inputs, 'input')}
        </Dropdown>
        <Dropdown
          className="ports-dropdown"
          isOpen={this.state.isOutputDropdownOpen}
          toggle={this.handleToggleOutputPortDropdown}>
          <DropdownToggle caret>
            MIDI Output: {this.state.selectedOutputPort != null ? this.state.selectedOutputPort.name : 'Off'}
          </DropdownToggle>
          {this.renderDropdownMenuForPorts(midi.outputs, 'output')}
        </Dropdown>
      </div>
    );
  }
}

export default MIDIDeviceManager;