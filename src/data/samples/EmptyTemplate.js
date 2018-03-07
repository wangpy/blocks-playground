export const kSampleCodeEmptyTemplate = `
/*
 * Empty Template
 *
 * This is an empty code template to let you start developing programs for Lightpad BLOCK / Lightpad M.
 *
 * You can try touching on the Lightpad on web page or actual Lightpad device (if connected)
 *
 * MIDI event will be sent to selected MIDI output port.
 * Remember to select an output port you want to try MIDI.
 *
 * Check the API documentation in the "Supported APIs" link on the top bar.
 *
 * Check out other sample codes in "Load" menu.
 */

// Add global variables here - DO NOT CALL API FUNCTIONS HERE
var pressurePointColor = 0;

// When the device is ready to run your program,
// this function callbacks is the first one get called.
// You can do the initialisation of the global variables here.
function initialise() {
  // TODO: Insert your initialise code here
  pressurePointColor = makeARGB(255, 128, 128, 255);
}

// This function gets called when the device does the drawing on the display.
// NOTE: The drawing APIs should only get used in this repaint() function.
function repaint() {
  // Normally we need to do this in every repaint().
  // If you remove this, the last paints will not get cleared.
  // You can pass a color into the parameter to make background color
  // Ex. makeARGB(255, 64, 16, 16)
  clearDisplay();

  // TODO: Insert your drawing code here
  // Ex. fillRect(makeARGB(255, 0, 0, 128), 3, 4, 5, 6);

  // Draw and fade touch points.
  drawPressureMap();
  fadePressureMap();
}

// Touch event callbacks
// touchIndex: number, first touch = 1
// x: number 0-4095
// y: number 0-4095
// vz: number 0-255

function touchStart(touchIndex, x, y, vz) {
  // Add the touch point to pressure map to show your touch on the LED.
  // The pressure point will be drawn when calling drawPressureMap().
  addPressurePoint(pressurePointColor, x, y, vz);

  // TODO: You can do some variable assignments or use MIDI APIs to send MIDI messages here.
  // Ex. sendNoteOn(1, 60, 127);
}

function touchMove(touchIndex, x, y, vz) {
  // Add the touch point to pressure map to show your touch on the LED.
  // The pressure point will be drawn when calling drawPressureMap().
  addPressurePoint(pressurePointColor, x, y, vz);

  // TODO: You can do some variable assignments or use MIDI APIs to send MIDI messages here.
  // Ex. sendAftertouch(1, 60, vz / 2);
}

function touchEnd(touchIndex, x, y, vz) {
  // TODO: You can do some variable assignments or use MIDI APIs to send MIDI messages here.
  // Ex. sendNoteOff(1, 60, 0);
}

// Additional functions can be added here

`;

export default kSampleCodeEmptyTemplate;