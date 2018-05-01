// @flow

import { Packed7BitArrayBuilder } from "../util/BitConversionUtils";
import { kPacketCounterMaxValue } from "../protocol/BlocksProtocolDefinitions";

/*
  enum DataChangeCommands
  {
      endOfPacket                 = 0, isLastChange is false
      endOfChanges                = 1, isLastChange is true
      skipBytesFew                = 2, -> ByteCountFew
      skipBytesMany               = 3, -> ByteCountMany
      setSequenceOfBytes          = 4, -> ByteValue -> ByteSequenceContinues (1)-> ... -> ByteValue -> ByteSequenceContinues (0)
      setFewBytesWithValue        = 5, -> ByteCountFew -> ByteValue
      setFewBytesWithLastValue    = 6, -> ByteCountFew
      setManyBytesWithValue       = 7  -> ByteCountMany -> ByteValue
  };

  using PacketIndex            = IntegerWithBitSize<16>;
  using DataChangeCommand      = IntegerWithBitSize<3>;
  using ByteCountFew           = IntegerWithBitSize<4>;
  using ByteCountMany          = IntegerWithBitSize<8>;
  using ByteValue              = IntegerWithBitSize<8>;
  using ByteSequenceContinues  = IntegerWithBitSize<1>;

  MessageType(0x02) -> PacketIndex
  -> DataChangeCommand 
  -> ...
  -> ( endOfPacket | endOfChanges ) 
*/
class DataChangeListBuilder {
  _builder: Packed7BitArrayBuilder;
  _queuedData: Array<Array<number>>;
  _packetIndex: number;
  _maxPacketSize: number;
  constructor(startPacketIndex: number, maxPacketSize: ?number) {
    this._queuedData = [];
    this._packetIndex = startPacketIndex;
    if (maxPacketSize != null) {
      this._maxPacketSize = maxPacketSize;
    } else {
      this._maxPacketSize = 200;
    }
    this.initBuilder();
  }

  initBuilder() {
    this._builder = new Packed7BitArrayBuilder();
    // write command message type
    this._builder.writeBits(2, 7);
    // write packet index
    this._builder.writeBits(this._packetIndex & kPacketCounterMaxValue, 16);
  }

  appendEndOfPacket(builder: ?Packed7BitArrayBuilder) {
    //console.debug('DataChangeListBuilder.appendEndOfPacket');
    const b = builder || this._builder;
    b.writeBits(0, 3);
  }

  appendEndOfChanges(builder: ?Packed7BitArrayBuilder) {
    //console.debug('DataChangeListBuilder.appendEndOfChanges');
    const b = builder || this._builder;
    b.writeBits(1, 3);
  }

  appendSkipBytes(startIndex: number, skipCount: number): number {
    //console.debug('DataChangeListBuilder.appendSkipBytes startIndex', startIndex);
    let i = startIndex;
    while (skipCount > 0) {
      i = this.queueDataAndCreateNewPacketIfNecessary(i, 3);
      if (skipCount > 255) {
        // skipBytesMany
        //console.debug('DataChangeListBuilder.appendSkipBytes skip many', 255, 'index', i);
        this._builder.writeBits(3, 3);
        this._builder.writeBits(255, 8);
        i += 255;
        skipCount -= 255;
      } else if (skipCount > 15) {
        // skipBytesMany
        //console.debug('DataChangeListBuilder.appendSkipBytes skip many', skipCount, 'index', i);
        this._builder.writeBits(3, 3);
        this._builder.writeBits(skipCount, 8);
        i += skipCount;
        skipCount = 0;
      } else {
        // skipBytesFew
        //console.debug('DataChangeListBuilder.appendSkipBytes skip few', skipCount, 'index', i);
        this._builder.writeBits(2, 3);
        this._builder.writeBits(skipCount, 4);
        i += skipCount;
        skipCount = 0;
      }
    }
    return i;
  }

  appendSetSequenceOfBytes(startIndex: number, byteSequence: Uint8Array): number {
    console.debug('DataChangeListBuilder.appendSetSequenceOfBytes length', byteSequence.length);
    let bytesWritten = 0;
    let i = startIndex;
    while (bytesWritten < byteSequence.length) {
      const packetSizeToAdd = Math.ceil(3 / 8 + (byteSequence.length - bytesWritten) * (9 / 7));
      const availablePacketSize = this.getAvailableDataSizeForCurrentPacket();
      //console.log('DataChangeListBuilder.appendSetSequenceOfBytes split', sizeToAdd, availableSize)
      let bytesToAdd = byteSequence.length - bytesWritten;
      if (availablePacketSize < packetSizeToAdd) {
        bytesToAdd = Math.floor((availablePacketSize - 3 / 8) / (9 / 7));
      }
      let bytesLeftToAdd = bytesToAdd;
      this._builder.writeBits(4, 3); // setSequenceOfBytes
      for (let i = bytesWritten; i < byteSequence.length && bytesLeftToAdd > 0; i++ , bytesWritten++ , bytesLeftToAdd--) {
        //console.debug('DataChangeListBuilder.appendSetSequenceOfBytes byte', i, byteSequence[i], bytesLeftToAdd);
        this._builder.writeBits(byteSequence[i], 8);
        this._builder.writeBits((bytesLeftToAdd > 1 && i < (byteSequence.length - 1)) ? 1 : 0, 1);
      }
      i += bytesToAdd;
      if (availablePacketSize < packetSizeToAdd) {
        this.queueDataAndCreateNewPacket(i);
      }
    }
    return i;
  }

  appendSetBytesWithCountAndValue(startIndex: number, bytesCount: number, value: number): number {
    let useLastValue = false;
    let i = startIndex;
    while (bytesCount > 0) {
      this.queueDataAndCreateNewPacketIfNecessary(i, 3);
      if (bytesCount > 255) {
        // setManyBytesWithValue
        this._builder.writeBits(7, 3);
        this._builder.writeBits(255, 8);
        this._builder.writeBits(value, 8);
        i += 255;
        bytesCount -= 255;
      } else if (bytesCount > 15) {
        // setManyBytesWithValue
        this._builder.writeBits(7, 3);
        this._builder.writeBits(bytesCount, 8);
        this._builder.writeBits(value, 8);
        i += bytesCount;
        bytesCount = 0;
      } else if (useLastValue) {
        // setFewBytesWithLastValue
        this._builder.writeBits(6, 3);
        this._builder.writeBits(bytesCount, 4);
        i += bytesCount;
        bytesCount = 0;
      } else {
        // setFewBytesWithValue
        this.writeBits(5, 3);
        this.writeBits(bytesCount, 4);
        this.writeBits(value, 8);
        i += bytesCount;
        bytesCount = 0;
      }
      useLastValue = true;
    }
    return i;
  }

  getAvailableDataSizeForCurrentPacket(sizeToAdd: number) {
    const availableSize = this._maxPacketSize - this._builder.size();
    return availableSize;
  }

  queueDataAndCreateNewPacketIfNecessary(startIndex: number, sizeToAdd: number): number {
    const availableSize = this.getAvailableDataSizeForCurrentPacket();
    if (availableSize < sizeToAdd) {
      this.queueDataAndCreateNewPacket(startIndex);
      return this._maxPacketSize;
    }
    return availableSize;
  }

  queueDataAndCreateNewPacket(skipBase: number) {
    const finalizedBuilder = this._builder.clone();
    this.appendEndOfPacket(finalizedBuilder);
    this._queuedData.push(finalizedBuilder.getData());
    this._packetIndex++;
    this.initBuilder();
    this.appendSkipBytes(skipBase, skipBase);
  }

  getFinalizedQueuedData() {
    const finalizedBuilder = this._builder.clone();
    this.appendEndOfChanges(finalizedBuilder);
    this._queuedData.push(finalizedBuilder.getData());
    //console.debug("DataChangeListBuilder.getFinalizedQueuedData", this._queuedData);
    return this._queuedData;
  }
}

export function computeDataChangeListMessage(newData: Uint8Array, oldData: Uint8Array, skipBase: number, length: number, packetIndex: number, maxPacketSize: ?number): Array<Array<number>> {
  const builder = new DataChangeListBuilder(packetIndex, maxPacketSize);
  let count = skipBase;
  let isSkipping = true;
  let i = 0;
  while (i < length) {
    let toPos = i;
    while (toPos < length &&
      ((isSkipping && newData[toPos] === oldData[toPos])
        || (!isSkipping && newData[toPos] !== oldData[toPos]))) {
      toPos++;
      count++;
    }

    // add message
    if (isSkipping && (toPos < length)) {
      //console.debug('computeDataChangeListMessage', 'fromPos', i, 'toPos', toPos, 'appendSkipBytes', count);
      builder.appendSkipBytes(skipBase + i, count);
    } else if (!isSkipping) {
      //console.debug('computeDataChangeListMessage', 'fromPos', i, 'toPos', toPos, 'appendSetSequenceOfBytes', newData.subarray(i, toPos));
      builder.appendSetSequenceOfBytes(skipBase + i, newData.subarray(i, toPos));
    }

    isSkipping = !isSkipping;
    i = toPos;
    count = 0;
  }

  return builder.getFinalizedQueuedData();
}