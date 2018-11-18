export const kSampleCodeTestMIDIEvents = `
/*
 * Test MIDI Events
 * 
 * This sample code shows the usage of APIS to send MIDI events
 *
 * First row: Pitch bend wheel, press to send channel pressure to all channels
 * Second row: Send program change 0-4 to all channels
 * Bottom Area: Send note messages, aftertouch and CC 74 (slide)
 */
 
// Add global variables here - DO NOT CALL API FUNCTIONS HERE
var pressurePointColor = 0;
var touchStartPos = [];
var touchNoteOnNumber = [];
var pitchBendPos = 0;
var selectedProgram = 0;
var ccValue = [0, 0, 0, 0, 0];
var numChannels = 15;

function initialise() {
  pressurePointColor = makeARGB(16, 128, 128, 255);
  pitchBendPos = 0x2000;
}

function repaint() {
  clearDisplay();

  // pitchBendArea
  var x = Math.floor(15 * pitchBendPos / 16384);
  fillRect(makeARGB(255, 255, 255, 255), x, 0, 1, 3);

  // program change
  for (var i=0; i<5; i++) {
    var s = (i === selectedProgram) ? 1.0 : 0.1;
    var colorNW = AHSVtoARGB(255, 0, s, 0.05);
    var colorNE = AHSVtoARGB(255, 0, s, 0.25);
    var colorSW = AHSVtoARGB(255, 0, s, 0.1);
    var colorSE = AHSVtoARGB(255, 0, s, 0.3);
    blendGradientRect(colorNW, colorNE, colorSW, colorSE, i*3, 3, 3, 3);
  }

  // note on/off area
  {
    var colorNW = AHSVtoARGB(255, 2.0 / 3.0, 0, 0.2);
    var colorNE = AHSVtoARGB(255, 2.0 / 3.0, 1, 0.6);
    var colorSW = AHSVtoARGB(255, 2.0 / 3.0, 0, 0.1);
    var colorSE = AHSVtoARGB(255, 2.0 / 3.0, 1, 0.3);
    blendGradientRect(colorNW, colorNE, colorSW, colorSE, 0, 6, 15, 9);
  }

  // draw and fade touch points
  drawPressureMap();
  fadePressureMap();
}

// Touch event callbacks

function touchStart(touchIndex, x, y, vz) {
  addPressurePoint(pressurePointColor, x, y, vz);

  touchStartPos[touchIndex] = [ x, y ];
  console.log('touchStart', touchStartFunctionType(touchIndex), touchFunctionTypeFromPos(x, y));
  switch (touchStartFunctionType(touchIndex)) {
    case 0:
      doPitchBend(Math.floor(16384 * x / 4096));
      break;
    case 1:
      setProgram(Math.floor(5 * x / 4096));
      break;
    case 2:
      var noteNum = noteNumberFromPos(x, y);
	  sendNoteOn(touchIndex, noteNum, vz / 2);
      touchNoteOnNumber[touchIndex] = noteNum;
      sendCC(touchIndex, 74, 127 - Math.floor(127 * (y / 4096 - 0.4) / 0.6));
      break;
  }
}

function touchMove(touchIndex, x, y, vz) {
  addPressurePoint(pressurePointColor, x, y, vz);
  console.log('touchMove', touchStartFunctionType(touchIndex), touchFunctionTypeFromPos(x, y));
  if (touchStartFunctionType(touchIndex) !== touchFunctionTypeFromPos(x, y)) {
	handleTouchLeaveZone(touchIndex);
    return;
  }
  switch (touchStartFunctionType(touchIndex)) {
    case 0:
      doPitchBend(Math.floor(16384 * x / 4096));
      for (var i=1; i<=numChannels; i++) {
		  sendChannelPressure(i, vz / 2);
      }
      break;
    case 1:
      // do nothing
      break;
    case 2:
      var noteNum = noteNumberFromPos(x, y);
      if (noteNum !== touchNoteOnNumber[touchIndex]) {
        sendNoteOff(touchIndex, touchNoteOnNumber[touchIndex], 0);
  	    sendNoteOn(touchIndex, noteNum, vz / 2);
        touchNoteOnNumber[touchIndex] = noteNum;
      } else {
	    sendAftertouch(touchIndex, noteNum, vz / 2);
      }
      sendCC(touchIndex, 74, 127 - Math.floor(127 * (y / 4096 - 2457.6)));
      break;
  }
}

function touchEnd(touchIndex, x, y, vz) {
  console.log('touchEnd', touchStartFunctionType(touchIndex), touchFunctionTypeFromPos(x, y));
  handleTouchLeaveZone(touchIndex);
}

// Additional functions can be added here

function handleTouchLeaveZone(touchIndex) {
  switch (touchStartFunctionType(touchIndex)) {
    case 0:
      doPitchBend(0x2000);
      break;
    case 1:
      break;
    case 2:
	  sendNoteOff(touchIndex, touchNoteOnNumber[touchIndex], 0);
      break;
  }
  delete touchStartPos[touchIndex];
}

function doPitchBend(value) {
  pitchBendPos = value;
  console.log('sendPitchBend', value);
  for (var i=1; i<=numChannels; i++) {
    sendPitchBend(i, pitchBendPos);
  }
}

function setProgram(program) {
  selectedProgram = program;
  for (var i=1; i<=numChannels; i++) {
    sendPC(i, selectedProgram);
  }
}

function noteNumberFromPos(x, y) {
  return Math.floor(60 + 24 * x / 4096);
}

function touchFunctionTypeFromPos(x, y) {
  return Math.min(2, Math.floor(5 * y / 4096));
}

function touchStartFunctionType(touchIndex) {
  if (!(touchIndex in touchStartPos)) {
    return -1;
  }
  return touchFunctionTypeFromPos(touchStartPos[touchIndex][0], touchStartPos[touchIndex][1]);
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

export default kSampleCodeTestMIDIEvents;