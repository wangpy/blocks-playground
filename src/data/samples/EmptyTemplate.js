export const kSampleCodeEmptyTemplate = `
/*
 * Empty Template
 * 
 * This is an empty code template to let you start developing programs for Lightpad BLOCK / Lightpad M.
 * 
 * You can try touching on the Lightpad on web page or actual Lightpad device (if connected)
 * 
 */
 
// Add global variables here - DO NOT CALL API FUNCTIONS HERE
var pressurePointColor = 0;

function initialise() {
  // TODO: Insert your initialise code here
  pressurePointColor = makeARGB(255, 128, 128, 255);
}

function repaint() {
  clearDisplay();

  // TODO: Insert your repaint code here

  // draw and fade touch points
  drawPressureMap();
  fadePressureMap();
}

// Touch event callbacks
// touchIndex: number, first touch = 1
// x: number 0-4095
// y: number 0-4095
// vz: number 0-255

function touchStart(touchIndex, x, y, vz) {
  addPressurePoint(pressurePointColor, x, y, vz);
  // TODO
}

function touchMove(touchIndex, x, y, vz) {
  addPressurePoint(pressurePointColor, x, y, vz);
  // TODO
}

function touchEnd(touchIndex, x, y, vz) {
  // TODO
}

// Additional functions can be added here

`;

export default kSampleCodeEmptyTemplate;