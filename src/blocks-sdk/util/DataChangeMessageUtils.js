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
class DataChangeListBuilder extends Packed7BitArrayBuilder {
  constructor(packetIndex: number) {
    super();
    // write command message type
    this.writeBits(2, 7);
    // write packet index
    this.writeBits(packetIndex & kPacketCounterMaxValue, 16);
  }

  appendEndOfPacket() {
    this.writeBits(0, 3);
  }

  appendEndOfChanges() {
    //console.debug('DataChangeListBuilder.appendEndOfChanges');
    this.writeBits(1, 3);
  }

  appendSkipBytes(skipCount: number) {
    while (skipCount > 0) {
      if (skipCount > 255) {
        // skipBytesMany
        //console.debug('DataChangeListBuilder.appendSkipBytes skip many', 255);
        this.writeBits(3, 3);
        this.writeBits(255, 8);
        skipCount -= 255;
      } else if (skipCount > 15) {
        // skipBytesMany
        //console.debug('DataChangeListBuilder.appendSkipBytes skip many', skipCount);
        this.writeBits(3, 3);
        this.writeBits(skipCount, 8);
        skipCount = 0;
      } else {
        // skipBytesFew
        //console.debug('DataChangeListBuilder.appendSkipBytes skip few', skipCount);
        this.writeBits(2, 3);
        this.writeBits(skipCount, 4);
        skipCount = 0;
      }
    }
  }

  appendSetSequenceOfBytes(byteSequence: Uint8Array) {
    //console.debug('DataChangeListBuilder.appendSetSequenceOfBytes length', byteSequence.length);
    this.writeBits(4, 3);
    for (let i=0; i<byteSequence.length; i++) {
      //console.debug('DataChangeListBuilder.appendSetSequenceOfBytes byte', i, byteSequence[i], (i + 1) < byteSequence.length);
      this.writeBits(byteSequence[i], 8);
      this.writeBits((i + 1) < byteSequence.length ? 1 : 0, 1);
    }
  }

  getFinalizedData(): Array<number> {
    const finalizedBuilder = this.clone();
    this.appendEndOfChanges.apply(finalizedBuilder);
    return finalizedBuilder.getData();
  }

  writeBits(value:number, bits:number) {
    super.writeBits(value, bits);
    //console.debug('DataChangeListBuilder.writeBits', value, bits);
  }  
}

export function computeDataChangeListMessage(newData: Uint8Array, oldData: Uint8Array, skipBase: number, length: number, packetIndex: number): Array<number> {
  const builder = new DataChangeListBuilder(packetIndex);
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
      builder.appendSkipBytes(count);
    } else if (!isSkipping) {
      //console.debug('computeDataChangeListMessage', 'fromPos', i, 'toPos', toPos, 'appendSetSequenceOfBytes', newData.subarray(i, toPos));
      builder.appendSetSequenceOfBytes(newData.subarray(i, toPos));
    }

    isSkipping = !isSkipping;
    i = toPos;
    count = 0;
  }
  
  return builder.getFinalizedData();
}