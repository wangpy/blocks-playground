export const kSampleCodeTestDrawingAPI = `// Global variables - DO NOT CALL API FUNCTIONS HERE
var backgroundHue = 0;
var pressurePointColor = 0;
var orSize = 0;
var orPos = 0;
var grSize = 0;
var grPos = 0;

function initialise() {
  backgroundHue = Math.random();
  pressurePointColor = makeARGB(255, 128, 128, 255);
  orSize = 3 + randomInt(5);
  orPos = randomInt(13);
  grSize = 5 + randomInt(5);
  grPos = randomInt(10);
}

function repaint() {
  // get and update background color hue
  var hue = backgroundHue;
  backgroundHue = (backgroundHue + 0.01) % 1.0;

  // paint background using clearDisplay()
  clearDisplay(AHSVtoARGB(255, hue, 0.3, 0.3));
  
  // draw a random point using fillPixel()
  fillPixel(AHSVtoARGB(255, hue+0.9, 1.0, 1.0), 14 - Math.floor((hue + 0.3) * 15) % 15, 15 - grPos);

  // draw a random rect using fillRect()
  {
    var x = (Math.floor((hue + 0.3) * (15 + orSize + orSize)) % (15 + orSize + orSize)) - orSize;
    fillRect(AHSVtoARGB(255, hue+0.1, 0.7, 0.7),  x, orPos, orSize, orSize);
  }

  // draw a random rect using blendRect()
  {
    var size = 15 - orSize;
    var y = 15 + size - (Math.floor((hue + 0.6) * (15 + size + size)) % (15 + size + size)) ;
    blendRect(AHSVtoARGB(64, hue+0.3, 1.0, 1.0),  15 - orPos - size, y, size, size);
  }

  // draw a random rect using blendGradientRect()
  {
    var y = Math.floor((hue + 0.7) * 15) % 15;
    var colorNW = AHSVtoARGB(64, hue+0.2, 1.0, 1.0);
    var colorNE = AHSVtoARGB(64, hue+0.4, 1.0, 1.0);
    var colorSW = AHSVtoARGB(64, hue+0.6, 1.0, 1.0);
    var colorSE = AHSVtoARGB(64, hue+0.8, 1.0, 1.0);
    blendGradientRect(colorNE, colorNW, colorSW, colorSE,  grPos, y, grSize, grSize);
  }

  // draw and fade touch points
  drawPressureMap();
  fadePressureMap();
}

// Touch event callbacks

function touchStart(touchIndex, x, y, vz) {
  addPressurePoint(pressurePointColor, x, y, vz);
}

function touchMove(touchIndex, x, y, vz) {
  addPressurePoint(pressurePointColor, x, y, vz);
}

function touchEnd(touchIndex, x, y, vz) {
}

// Additional functions

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

export default kSampleCodeTestDrawingAPI;