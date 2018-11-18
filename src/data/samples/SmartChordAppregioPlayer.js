export const kSampleCodeSmartChordAppregioPlayer = `
/*
 * Smart Chord Appregio Player
 * 
 * This code works on 1 or 2 Lightpad Blocks. 
 * Put the second lightpad on bottom of first (master) block to make combined play surface with doubled length.
 *
 * Usage: 
 * 1. Create IAC (or virtual MIDI port) to connect Playground with your software synth
 * 2. Select the IAC port in "MIDI Output" drop-down button on left side.
 * 3. On your software synth, enable MIDI input from IAC (virtual MIDI) port.
 * 4. Play on the Lightpad blocks (Watch demo at: https://www.youtube.com/watch?v=zVoINpIdIns)
 */

// Add global variables here - DO NOT CALL API FUNCTIONS HERE
var relRootMap = [
  [ -1, 0, 0, 2, 2, 4, 4, 5, 5, 7, 7, 9, 9, 11, 11, -1 ],
  [ -1, -1, 1, 1, 3, 3, -1, -1, 6, 6, 8, 8, 10, 10, -1, -1 ]
];
var relRootChordNotes = [
  [ 0, 4, 7 ],
  [ 0, 4, 7, 10 ], // Ab/Db7
  [ 0, 3, 7 ],
  [ 0, 2, 4, 5, 8, 10 ], // Eb13(sus4)
  [ 0, 3, 7 ],
  [ 0, 4, 7 ],
  [ 0, 2, 4, 6, 10 ], // F#9(b5)
  [ 0, 4, 7 ],
  [ 0, 4, 9, 10 ], // Ab13
  [ 0, 3, 7 ],
  [ 0, 2, 4, 9, 10 ], // Bb13
  [ 0, 1, 4, 7, 10 ] // B7(b9)
];
var MESSAGE_EXPOSE_DEVICE_ID = 1;			// deviceId, isPrimaryDevice
var MESSAGE_SET_SELECTED_REL_ROOT = 2;		// relRoot
var MESSAGE_SET_KEY_INDEX_AND_OFFSET = 3;	// keyIndex, keyOffset
var MESSAGE_SET_OCTAVE_SHIFT = 4;			// octaveShift
var MESSAGE_SET_CHORD_EDIT_ON_REL_ROOT = 5; // relRoot
var MESSAGE_SET_NOTE_IN_CHORD = 6;			// index, noteType
var MESSAGE_TOGGLE_NOTE_IN_CHORD = 7;		// relNote
var MESSAGE_SET_EDITED_CHORD_NOTE_ARRAY = 8;	// index, relNote

var primaryDeviceID = 0x01;
var slaveDeviceID = 0x2e;
var deviceID = 0;
var keyOffset = 0;
var keyIndex = 0;
var selectedRelRoot = 0;
var octaveShift = 0;
var touchActiveNoteNum = [-1, -1, -1, -1, -1, -1, -1, -1, -1, -1];
var touchActiveNoteNumToPlay = [-1, -1, -1, -1, -1, -1, -1, -1, -1, -1];
var touchStartX = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
var touchStartY = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
var touchInMoveMode = [false, false, false, false, false, false, false, false, false, false];
var chordNoteOffsetToPlay = [0, -1, -2, 1, 0, -1, 1, 0, -1, -2, 2, 1];
var noteInChordMap = [-1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1];
var chordButtonTouchIndex = -1;
var chordButtonTouchPlayingNote = -1;
var chordButtonTouchStartX = 0;
var chordButtonTouchStartY = 0;
var isStrummingMode = true;
var sustainingOnTouchIndex = -1;
var chordEditingModeOnTouchIndex = -1;
var chordEditingModeOnRelRoot = -1;

function initialise() {
  deviceID = getBlockIDOnPort(0xFF);
  log("deviceID ="+deviceID);
  for (var i=0; i<getNumBlocksInTopology(); i++) {
    var deviceTopologyIndex = getBlockIDForIndex(i);
    log("deviceTopologyIndex["+i+"]="+deviceTopologyIndex);
    if (i === 0) {
      primaryDeviceID = deviceTopologyIndex;
    } else if (i === 1) {
      slaveDeviceID = deviceTopologyIndex;
    }
  }
}

function repaint() {
  clearDisplay();
  var deviceIndex = getDeviceIndex();
  if (deviceIndex < 0) {
    return;
  }
  
  fillRect(AHSVtoARGB(255, (1.0 - keyOffset/12.0 + 1/3.0) % 1.0, 1.0, 0.1), 0, 0, 10, 15);
  fillRect(getKeyColor(selectedRelRoot), 10, 0, 5, 15);

  var numBlocks = getNumBlocksInTopology();
  for (var j=0; j<2; j++) {
    for (var i=0; i<16; i++) {
      var relNote = relRootMap[j][i];
      if (relNote !== -1) {
        drawKey(relNote, j*3, i-deviceIndex, 3, 1, noteInChordMap[relNote]);
      }
    }
  }
  {
    var colors = [
      makeARGB(255, 128, 128, 128),
      makeARGB(255, 128, 128, 128),
      makeARGB(255, 128, 128, 128),
      makeARGB(255, 255, 255, 0),
      makeARGB(255, 255, 0, 0)
    ];
    if (deviceIndex === 0) {
      var isSustaining = sustainingOnTouchIndex !== -1;
      fillRect(AHSVtoARGB(255, (1.0 - keyOffset/12.0 + 1/3.0) % 1.0, 1.0, isSustaining ? 1.0 : 0.5), 6, 0, 4, 3);
      
      var nextColor = AHSVtoARGB(255, (1.0 - (keyOffset - 7)/12.0 + 1/3.0) % 1.0, 1.0, 1.0);
      drawCharacter('>', nextColor, 7, 2);
      var prevColor = AHSVtoARGB(255, (1.0 - (keyOffset - 5)/12.0 + 1/3.0) % 1.0, 1.0, 1.0);
      drawCharacter('<', prevColor, 6, 2);
      
      var color = makeARGB(255, 255, 128, 0);
      if (isStrummingMode) {
        color = makeARGB(255, 0, 128, 255);
      }
      if (chordEditingModeOnTouchIndex !== -1) {
        color = makeARGB(255, 255, 0, 0);
      }
      fillRect(color, 6, 6, 4, 4);
    }
    if (deviceIndex === numBlocks - 1) {
      drawCharacter('^', colors[2+octaveShift], 7, 8);
      drawCharacter('v', colors[2-octaveShift], 7, 12);
    }
  }
}

function getNoteName(relRoot, isMajor) {
  var noteNameListIndex;
  if (keyIndex >= 6) {
    noteNameListIndex = 0;
  } else if (keyIndex >= 0) {
    noteNameListIndex = 1;
  } else if (keyIndex >= -5) {
    noteNameListIndex = 2;
  } else {
    noteNameListIndex = 3; 
  }
  var noteName = noteNames[noteNameListIndex][(keyOffset + relRoot) % 12];
  if (!isMajor) {
    return noteName.toLowerCase();
  } else {
    return noteName;
  }
}

function getChordNameIndex(chordName) {
  for (var i=0; i<chordNamesMap.length; i++) {
    if (chordName === chordNamesMap[i]) {
      return i;
    }
  }
  return -1;
}
function getKeyColor(relRoot) {
  var noteHue = (keyOffset+relRoot)/12.0;

  var colorSat = 0.5;
  var colorBrightness = 1.3 - colorSat;
  
  return AHSVtoARGB(255, noteHue, colorSat, colorBrightness);
}

function drawKey(relRoot, x, y, width, height, editState) {
  var isSelected = chordEditingModeOnRelRoot !== -1 ? false : selectedRelRoot == relRoot;
  
  var color = getKeyColor(relRoot);
  if (editState === 0) {
    color = makeARGB(255, 255, 0, 0);
  } else if (editState === 1) {
    color = makeARGB(255, 255, 255, 0);
  } else if (isSelected) {
    color = makeARGB(255, 255, 255, 255);
  }

  fillRect(color, x, y, width, height);
}

// Draw 3x5 character
function drawCharacter(char, color, x, y) {
  switch (char) {
    case '+':
      fillRect(color, x, y+2, 3, 1);
      fillRect(color, x+1, y+1, 1, 3);
      break;
    case '-':
      fillRect(color, x, y+2, 3, 1);
      break;
    case '|':
      fillRect(color, x+1, y+1, 1, 3);
      break;
    case '^':
      fillRect(color, x+1, y+2, 1, 1);
      fillRect(color, x, y+3, 3, 1);
      break;
    case 'v':
      fillRect(color, x+1, y+2, 1, 1);
      fillRect(color, x, y+1, 3, 1);
      break;
    case '<':
      fillRect(color, x+1, y+1, 1, 1);
      fillRect(color, x, y+2, 1, 1);
      fillRect(color, x+1, y+3, 1, 1);
      break;
    case '>':
      fillRect(color, x+1, y+1, 1, 1);
      fillRect(color, x+2, y+2, 1, 1);
      fillRect(color, x+1, y+3, 1, 1);
      break;
    default:
      break;
  }
}

function switchToChord(relRoot) {
  selectedRelRoot = relRoot;
  calculateChordNoteOffsetToPlay();
  sendMessageToBlock(getOtherDeviceID(), MESSAGE_SET_SELECTED_REL_ROOT, selectedRelRoot, 0);
}

function calculateChordNoteOffsetToPlay() {
  var noteIndex = (keyOffset + selectedRelRoot) % 12;
  var chordNotes = relRootChordNotes[selectedRelRoot].slice(0);
  // rearrange all chord notes to be sorted non-negative
  while (chordNotes[0] < 0) {
    chordNotes.push(chordNotes[0]+12);
    chordNotes.shift();
  }
  // add octave of first note
  chordNotes.push(chordNotes[0]+12);
  for (var i=0; i<12; i++) {
    if (chordNotes.length > 1 && i - chordNotes[0] > chordNotes[1] - i) {
      chordNotes.shift();
    }
    chordNoteOffsetToPlay[noteIndex] = chordNotes[0] - i;
    noteIndex = (noteIndex + 1) % 12;
  }
  log('calculateChordNoteOffsetToPlay ' + selectedRelRoot + ' ' + JSON.stringify(chordNoteOffsetToPlay));
}

function getNoteNumToPlay(touchIndex, noteNum) {
  var noteNumOffset = chordNoteOffsetToPlay[noteNum % 12];
  var noteNumToPlay = noteNum + noteNumOffset;
  return 48 + 12 * octaveShift + noteNumToPlay;
}

function noteStart(touchIndex, noteNum, velocity) {
  var activeNote = touchActiveNoteNum[touchIndex];
  var activeNoteNumToPlay = touchActiveNoteNumToPlay[touchIndex];
  var noteNumToPlay = getNoteNumToPlay(touchIndex, noteNum, activeNoteNumToPlay);
  if (activeNoteNumToPlay === noteNumToPlay) {
    sendAftertouch(1 + touchIndex, activeNoteNumToPlay, velocity);
  } else {
    if (activeNoteNumToPlay !== 0) {
	  sendNoteOff(1 + touchIndex, activeNoteNumToPlay, velocity);
    }
    if (noteNumToPlay !== 0) {
      sendNoteOn(1 + touchIndex, noteNumToPlay, velocity);
    }
    touchActiveNoteNum[touchIndex] = noteNum;
    touchActiveNoteNumToPlay[touchIndex] = noteNumToPlay;
    touchInMoveMode[touchIndex] = false;
  }
}

function noteEnd(touchIndex, velocity) {
  var activeNoteNumToPlay = touchActiveNoteNumToPlay[touchIndex];
  if (activeNoteNumToPlay > 0) {
    sendNoteOff(1 + touchIndex, activeNoteNumToPlay, velocity);
  }
  touchActiveNoteNum[touchIndex] = -1;
  touchActiveNoteNumToPlay[touchIndex] = -1;
}

function deviceTouchXtoNoteNum(deviceIndex, x) {
  var noteStart = 24;
  var noteOctaveRange = 24;
  noteStart -= noteOctaveRange * deviceIndex;
  return noteStart + Math.floor(noteOctaveRange * x / 4096);
}

function getVelocity(vz) {
  return 128 + vz >> 1;
}

function startChordEdit(relRoot) {
  chordEditingModeOnRelRoot = relRoot;
  sendMessageToBlock(getOtherDeviceID(), MESSAGE_SET_CHORD_EDIT_ON_REL_ROOT, relRoot, 0);
  var chordNotes = relRootChordNotes[chordEditingModeOnRelRoot].slice(0);
  for (var i=0; i<chordNotes.length; i++) {
    var index = (relRoot + chordNotes[i]) % 12;
    var value = (i === 0) ? 0 : 1;
    noteInChordMap[index] = value;
    sendMessageToBlock(getOtherDeviceID(), MESSAGE_SET_NOTE_IN_CHORD, index, value);
  }
  log('startChordEdit ' + relRoot + ' ' + JSON.stringify(noteInChordMap));
}

function toggleNoteInChord(relNote) {
  if (getDeviceIndex() !== 0) {
    sendMessageToBlock(getOtherDeviceID(), MESSAGE_TOGGLE_NOTE_IN_CHORD, relNote, 0);
    return;
  }
  var hasRoot = false;
  for (var i=0; i<12; i++) {
    if (noteInChordMap[i] === 0) {
      hasRoot = true;
      break;
    }
  }  
  var value = noteInChordMap[relNote];
  if (value >= 0) {
    value = -1;
  } else {
    value = hasRoot ? 1 : 0;
    hasRoot = true;
  }
  noteInChordMap[relNote] = value;
  sendMessageToBlock(getOtherDeviceID(), MESSAGE_SET_NOTE_IN_CHORD, relNote, value);
  if (!hasRoot) {
    return;
  }
  calculateNewChordNotes();
}

function setEditedChordNoteArray(index, relNote) {
  log("setEditedChordNoteArray" + ' ' + index + ' ' + relNote);
  if (chordEditingModeOnRelRoot === -1) {
    return;
  }
  if (relNote !== -1) {
    relRootChordNotes[selectedRelRoot][index] = relNote;
  } else {
    // end of chord note array at index
    if (relRootChordNotes[selectedRelRoot].length > index) {
      relRootChordNotes[selectedRelRoot].splice(index, relRootChordNotes[selectedRelRoot].length - index);
    }
  	calculateChordNoteOffsetToPlay();
  }
}

function calculateNewChordNotes() {
  if (chordEditingModeOnRelRoot === -1) {
    return;
  }
  var rootIndex = -1;
  for (var i=0; i<12; i++) {
    if (noteInChordMap[i] === 0) {
      rootIndex = i;
      break;
    }
  }  
  if (rootIndex === -1) {
    return;
  }
  var chordNotes = [];
  var noteIndex = rootIndex;
  var firstNote = rootIndex - chordEditingModeOnRelRoot;
  for (var i=0; i<12; i++) {
    if (noteInChordMap[noteIndex] >= 0) {
      chordNotes.push(firstNote + i);
    }
    noteIndex = (noteIndex + 1) % 12;
  }
  for (var i=0; i<chordNotes.length; i++) {
    setEditedChordNoteArray(i, chordNotes[i]);
    sendMessageToBlock(getOtherDeviceID(), MESSAGE_SET_EDITED_CHORD_NOTE_ARRAY, i, chordNotes[i]);
  }
  setEditedChordNoteArray(chordNotes.length, -1);
  sendMessageToBlock(getOtherDeviceID(), MESSAGE_SET_EDITED_CHORD_NOTE_ARRAY, chordNotes.length, -1);
}

function endChordEdit() {
  for (var i=0; i<12; i++) {
    noteInChordMap[i] = -1;
    sendMessageToBlock(getOtherDeviceID(), MESSAGE_SET_NOTE_IN_CHORD, i, -1);
  }
  chordEditingModeOnRelRoot = -1;
  sendMessageToBlock(getOtherDeviceID(), MESSAGE_SET_CHORD_EDIT_ON_REL_ROOT, -1, 0);
}

// Message callback
function handleMessage(param1, param2, param3) {
  log('handleMessage' + ' ' + param1 + ' ' + param2 + ' ' + param3);
  switch (param1) {
    case MESSAGE_SET_SELECTED_REL_ROOT: 
      selectedRelRoot = param2;
      calculateChordNoteOffsetToPlay();
      break;
    case MESSAGE_SET_KEY_INDEX_AND_OFFSET:
      keyIndex = param2;
      keyOffset = param3;
      calculateChordNoteOffsetToPlay();
      break;
    case MESSAGE_SET_OCTAVE_SHIFT:
      octaveShift = param2;
      break;
    case MESSAGE_SET_CHORD_EDIT_ON_REL_ROOT:
      chordEditingModeOnRelRoot = param2;
      break;
    case MESSAGE_SET_NOTE_IN_CHORD:
      noteInChordMap[param2] = param3;
      break;
    case MESSAGE_TOGGLE_NOTE_IN_CHORD:
      toggleNoteInChord(param2);
      break;
    case MESSAGE_SET_EDITED_CHORD_NOTE_ARRAY:
      setEditedChordNoteArray(param2, param3);
      break;
    default:
      break;
  }
}

// Touch event callbacks
// touchIndex: number, first touch = 1
// x: number 0-4095
// y: number 0-4095
// vz: number 0-255

function touchStart(ti, x, y, vz) {
  // TODO: You can do some variable assignments or use MIDI APIs to send MIDI messages here.
  // Ex. sendNoteOn(1, 60, 127);
  var deviceIndex = getDeviceIndex();
  if (deviceIndex < 0) {
    return;
  }
  var touchIndex = 5 * deviceIndex + ti;
  var xDotPos = 15.0 * x / 4096.0;
  var yDotPos = 15.0 * y / 4096.0;
  var numBlocks = getNumBlocksInTopology();
  if (xDotPos >= 10) {
    // note playing area
    var noteNum = deviceTouchXtoNoteNum(deviceIndex, 4096-y);
    noteStart(touchIndex, noteNum, getVelocity(vz));
    sendCC(1 + touchIndex, 74, 127-(xDotPos-10)/5.0*127.0);
    touchStartX[touchIndex] = x;
    touchStartY[touchIndex] = y;
  } else if (deviceIndex === 0 && xDotPos >= 6 && yDotPos >= 0 && yDotPos < 3) {
    sustainingOnTouchIndex = touchIndex;
    sendCC(0, 64, 127);
  } else if (deviceIndex === 0 && xDotPos >= 6 && yDotPos >= 3 && yDotPos < 6) {
    if (xDotPos >= 8) {
      keyOffset = (keyOffset + 7) % 12;
      keyIndex++;
      if (keyIndex > 7) {
        keyIndex -= 12;
      }
    } else {
      keyOffset = (12 + keyOffset - 7) % 12;
      keyIndex--;
      if (keyIndex < -7) {
        keyIndex += 12;
      }
    }
    sendMessageToBlock(getOtherDeviceID(), MESSAGE_SET_KEY_INDEX_AND_OFFSET, keyIndex, keyOffset);
    calculateChordNoteOffsetToPlay();
  } else if (deviceIndex === numBlocks-1 && xDotPos >= 6 && yDotPos >= 10) {
    if (yDotPos < 12.5) {
      octaveShift = Math.max(Math.min(octaveShift+1, 2), -2);
    } else {
      octaveShift = Math.max(Math.min(octaveShift-1, 2), -2);
    }
    sendMessageToBlock(getOtherDeviceID(), MESSAGE_SET_OCTAVE_SHIFT, octaveShift, 0);
  } else if (deviceIndex === 0 && xDotPos >= 6 && yDotPos >= 6 && yDotPos < 10) {
    if (chordButtonTouchIndex !== -1) {
      chordEditingModeOnTouchIndex = touchIndex;
      startChordEdit(selectedRelRoot);
    } else {
	  isStrummingMode = !isStrummingMode;
    }
  } else {
    var numBlocks = getNumBlocksInTopology();
    var j = Math.floor(xDotPos/3);
    var i = 1+Math.floor(yDotPos-1+deviceIndex);
    var relRoot = relRootMap[j][i];
    if (relRoot >= 0) {
      if (chordEditingModeOnRelRoot !== -1) {
        toggleNoteInChord(relRoot);
      } else {
        switchToChord(relRoot);
        if (chordButtonTouchIndex !== -1 && chordButtonTouchPlayingNote !== -1) {
          sendNoteOff(1 + chordButtonTouchIndex, chordButtonTouchPlayingNote, 0);
        }
        chordButtonTouchIndex = touchIndex;
        chordButtonTouchStartX = x;
        chordButtonTouchStartY = y;
        chordButtonTouchPlayingNote = 24 + deviceIndex * 12 + keyOffset + selectedRelRoot + relRootChordNotes[selectedRelRoot][0];
        sendCC(1 + chordButtonTouchIndex, 74, 127);
        sendNoteOn(1 + chordButtonTouchIndex, chordButtonTouchPlayingNote, getVelocity(vz) * 2);
      }
    }
  }
}

function touchMove(ti, x, y, vz) {
  // TODO: You can do some variable assignments or use MIDI APIs to send MIDI messages here.
  // Ex. sendAftertouch(1, 60, vz / 2);
  var deviceIndex = getDeviceIndex();
  if (deviceIndex < 0) {
    return;
  }
  var touchIndex = 5 * deviceIndex + ti;
  if (touchActiveNoteNum[touchIndex] !== -1) {
    var xDotPos = 15.0 * x / 4096.0;
    sendCC(1 + touchIndex, 74, 127-(xDotPos-10)/5.0*127.0);
    var inMoveMode = touchInMoveMode[touchIndex];
    var touchDiffX = y - touchStartY[touchIndex];
    if (!inMoveMode && Math.abs(touchDiffX) > getTouchXmoveThreshold()) {
      inMoveMode = touchInMoveMode[touchIndex] = true;
    }
    if (inMoveMode) {
      if (isStrummingMode) {
        // strumming mode
        var noteNum = deviceTouchXtoNoteNum(deviceIndex, 4096-y);
        noteStart(touchIndex, noteNum, getVelocity(vz));
      } else {
        // send aftertouch
        sendPitchBend(1 + touchIndex, 8192 - touchDiffX);
      }
    }
  }
}

function touchEnd(ti, x, y, vz) {
  // TODO: You can do some variable assignments or use MIDI APIs to send MIDI messages here.
  // Ex. sendNoteOff(1, 60, 0);
  var deviceIndex = getDeviceIndex();
  if (deviceIndex < 0) {
    return;
  }
  var touchIndex = 5 * deviceIndex + ti;
  if (touchIndex === sustainingOnTouchIndex) {
    sustainingOnTouchIndex = -1;
    sendCC(0, 64, 0);
  } else if (touchIndex === chordEditingModeOnTouchIndex) {
    chordEditingModeOnTouchIndex = -1;
    endChordEdit();
  } else if (touchIndex == chordButtonTouchIndex) {
    if (chordButtonTouchPlayingNote !== -1) {
      sendNoteOff(1 + chordButtonTouchIndex, chordButtonTouchPlayingNote, 0);
    }
    chordButtonTouchIndex = -1;
  } else if (touchActiveNoteNum[touchIndex] !== -1) {
    noteEnd(touchIndex, 0);
  }
}

// Additional functions

function getTouchXmoveThreshold() {
  return isStrummingMode ? 512 : 128;
}
  
function getDeviceIndex() {
  if (deviceID === primaryDeviceID) {
    return 0;
  } else if (deviceID === slaveDeviceID) {
    return 1;
  }
  return -1;
}

function getOtherDeviceID() {
  if (deviceID === primaryDeviceID) {
    return slaveDeviceID;
  } else if (deviceID === slaveDeviceID) {
    return primaryDeviceID;
  }
  return -1;
}
function randomInt(max) {
  return Math.floor(Math.random() * max);
}

function AHSVtoARGB(a, h, s, v) {
  var c = HSVtoRGB(h, s, v);
  return makeARGB(a, c.r, c.g, c.b);
}

function HSVtoRGB(h, s, v) {
    var r, g, b, i, f, p, q, t;
    if (arguments.length === 1) {
        s = h.s, v = h.v, h = h.h;
    }
    i = Math.floor(h * 6);
    f = h * 6 - i;
    p = v * (1 - s);
    q = v * (1 - f * s);
    t = v * (1 - (1 - f) * s);
    switch (i % 6) {
        case 0: r = v, g = t, b = p; break;
        case 1: r = q, g = v, b = p; break;
        case 2: r = p, g = v, b = t; break;
        case 3: r = p, g = q, b = v; break;
        case 4: r = t, g = p, b = v; break;
        case 5: r = v, g = p, b = q; break;
    }
    return {
        r: Math.round(r * 255),
        g: Math.round(g * 255),
        b: Math.round(b * 255)
    };
}
`;

export default kSampleCodeSmartChordAppregioPlayer;