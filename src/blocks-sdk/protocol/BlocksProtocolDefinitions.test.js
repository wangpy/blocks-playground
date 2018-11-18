import { DeviceTopologyMessage } from './BlocksProtocolDefinitions';
import { getPacketDataFromDumpString } from '../blocks/Block';

// Device Topology message: (2 lightpads, host: lightpad block, south: lightpad M)
test('DeviceTopologyMessageForTwoLightpadUSB', () => {
  const dumpStr = `
  00  F0 00 21 10 77 41 00 00  00 00 10 10 40 40 00 26
  10  28 21 59 1A 66 2A 6D 29  65 21 6B 1A 61 26 67 40
  20  1F 13 34 33 6E 6D 34 16  54 75 6D 33 13 34 51 0C
  30  52 6C 1F 40 48 05 01 45  0C 30 08 30 00 73 22 73
  40  12 03 30 10 33 00 73 22  73 12 03 38 08 08 00 38
  50  10 0B 00 00 16 F7
`;
  const parsedObject = {
    devices:
      [{
        blockSerialNumber: 'LPB25LUZSJCV5BMN',
        topologyIndex: 1,
        batteryLevel: 31,
        batteryCharging: 1
      },
      {
        blockSerialNumber: 'LPM97SYPV7OMPE2H',
        topologyIndex: 50,
        batteryLevel: 31,
        batteryCharging: 1
      }],
    connections:
      [{
        deviceIndex1: 1,
        portIndex1: 4,
        deviceIndex2: 50,
        portIndex2: 1
      },
      {
        deviceIndex1: 1,
        portIndex1: 5,
        deviceIndex2: 50,
        portIndex2: 0
      }],
    messageType: 1,
    protocolVersion: 1,
    deviceCount: 2,
    connectionCount: 2
  };
  console.debug(dumpStr);
  const data = getPacketDataFromDumpString(dumpStr).subarray(5);
  let pos = 39;
  const topologyMessage = new DeviceTopologyMessage();
  pos += topologyMessage.deserializeFromData(data, pos);
  console.debug(topologyMessage.toObject());
  expect(topologyMessage.toObject()).toEqual(parsedObject);
});
