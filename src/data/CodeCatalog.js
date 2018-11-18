// @flow

import { kSampleCodeEmptyTemplate } from './samples/EmptyTemplate';
import { kSampleCodeTestDrawingAPI } from './samples/TestDrawingAPI';
import { kSampleCodeTestMIDIEvents } from './samples/TestMIDIEvents';
import { kSampleCodeSnakeGame } from './samples/SnakeGame';
import { kSampleCodeDrawImageOrVideo } from './samples/DrawImageOrVideo';
import { kSampleCodeSmartChordAppregioPlayer } from './samples/SmartChordAppregioPlayer';

const kSampleCodes: { [string]: string } = {
  EmptyTemplate: kSampleCodeEmptyTemplate,
  TestDrawingAPI: kSampleCodeTestDrawingAPI,
  TestMIDIEvents: kSampleCodeTestMIDIEvents,
  SnakeGame: kSampleCodeSnakeGame,
  DrawImageOrVideo: kSampleCodeDrawImageOrVideo,
  SmartChordAppregioPlayer: kSampleCodeSmartChordAppregioPlayer,
};

export class CodeCatalog {
  getCode(codeName: string): ?string {
    if (codeName in kSampleCodes) {
      return kSampleCodes[codeName];
    }
    return null;
  }

  getEmptyTemplate(): string {
    return kSampleCodeEmptyTemplate;
  }

  getCatalog(): Array<string> {
    return Object.keys(kSampleCodes).filter((key) => key !== 'EmptyTemplate');
  }
}

export default CodeCatalog;