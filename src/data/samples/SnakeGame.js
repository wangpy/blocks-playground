export const kSampleCodeSnakeGame = `
/*
 * SnakeGame
 *
 * This is a classic 'Snake' Game to play on Lightpads.
 *
 * Swipe to change snake direction.
 * Pressing harder when swiping can make snake move slowly.
 */

// Global variables - DO NOT CALL API FUNCTIONS HERE

// constants
var kStartCounter = 5;
var kMaxCounterToMove = 5;
var kCounterToReset = 50;
// states
var snake = [];
var counter = 0;
var counterToMove = 0;
var dir = [0, 0];
var newDir = [0, 0];
var foodPos = [0, 0];
var isNewDirPending = false;
var isNewDirDecided = false;
var touchStartPos = [0, 0];
var touchMovePos = [0, 0];
var isDead = false;

function initialise() {
  reset();
}

function repaint() {
  // paint background using clearDisplay()

  if (isDead) {
    clearDisplay(makeARGB(255, 255, 0, 0));
  } else {
    var v = -counterToMove * 10;
    clearDisplay(makeARGB(255, v, v, 0));
  }

  // draw dir hint if necessary
  if (isNewDirPending) {
    drawMoveHint();
  }

  if (isDead && counter <= 0) {
    reset();
    return;
  } else if (!isDead && counter <= counterToMove) {
    moveSnake();
    if (isDead) {
      counter = kCounterToReset;
    } else {
      counter = kStartCounter;
    }
  }

  // draw snake
  snake.forEach(function (snakePos, i) {
    fillPixel(makeARGB(255, 0, 128 + 127 * i / snake.length, 0), snakePos[0], snakePos[1]);
  });

  // draw food
  fillPixel(makeARGB(255, randomInt(127) + 128, randomInt(127) + 128, randomInt(127) + 128), foodPos[0], foodPos[1]);

  counter--;
}

// Touch event callbacks

function touchStart(touchIndex, x, y, vz) {
  if (touchIndex === 1) {
    touchStartPos = [toLEDPos(x), toLEDPos(y)];
    touchMovePos = [toLEDPos(x), toLEDPos(y)];
    newDir = [0, 0];
    isNewDirPending = true;
    isNewDirDecided = false;
    counterToMove = -Math.floor(kMaxCounterToMove * vz / 255);
  }
}

function touchMove(touchIndex, x, y, vz) {
  if (touchIndex === 1) {
    touchMovePos = [toLEDPos(x), toLEDPos(y)];
    counterToMove = -Math.floor(kMaxCounterToMove * vz / 255);
  }
}

function touchEnd(touchIndex, x, y, vz) {
  touchMovePos = [toLEDPos(x), toLEDPos(y)];
  counterToMove = 0;
  isNewDirDecided = true;
}

// Additional functions can be added here

function randomInt(max) {
  return Math.floor(Math.random() * max);
}

function toLEDPos(touchPos) {
  return Math.round(15 * touchPos / 4096);
}

function reset() {
  snake = [[7, 13], [7, 12], [7, 11]];
  counter = kStartCounter;
  counterToMove = 0;
  dir = [0, -1];
  newDir = [0, -1];
  generateFoodPos();
  isNewDirPending = false;
  isNewDirDecided = false;
  touchStartPos = [0, 0];
  touchMovePos = [0, 0];
  isDead = false;
}

function generateFoodPos() {
  // decide new food pos, need to avoid snake body
  var hitSnake = false;
  while (true) {
    foodPos = [randomInt(15), randomInt(15)];
    hitSnake = false;
    for (var i = 0; i < snake.length; i++) {
      if (foodPos[0] === snake[i][0] && foodPos[1] === snake[i][1]) {
        hitSnake = true;
        break;
      }
    }
    if (!hitSnake)
      break;
  }
}

function moveSnake() {
  if (isNewDirPending) {
    var touchDeltaX = touchMovePos[0] - touchStartPos[0];
    var touchDeltaY = touchMovePos[1] - touchStartPos[1];

    console.log('isNewDirPending',
      'touchStartPos', touchStartPos,
      'touchMovePos', touchMovePos,
      'touchDelta', [touchDeltaX, touchDeltaY]);

    if (touchDeltaX > touchDeltaY && touchDeltaY >= 0) {
      newDir = [1, 0];
    } else if (touchDeltaX < touchDeltaY && touchDeltaY <= 0) {
      newDir = [-1, 0];
    } else if (touchDeltaY > touchDeltaX && touchDeltaX >= 0) {
      newDir = [0, 1];
    } else if (touchDeltaY < touchDeltaX && touchDeltaX <= 0) {
      newDir = [0, -1];
    }

    if (isNewDirDecided) {
      if (newDir[0] + newDir[1] !== 0 && // avoid zero newDir
        (newDir[0] + dir[0] !== 0 || newDir[1] + dir[1] !== 0) // avoid opposite dir
      ) {
        dir = newDir;
      }
      isNewDirDecided = false;
      isNewDirPending = false;
    }
  }
  var newSnakePos = [snake[snake.length - 1][0], snake[snake.length - 1][1]];
  newSnakePos[0] = (newSnakePos[0] + dir[0] + 15) % 15;
  newSnakePos[1] = (newSnakePos[1] + dir[1] + 15) % 15;

  // check for hit snake body
  for (var i = 0; i < snake.length - 1; i++) {
    if (newSnakePos[0] === snake[i][0] && newSnakePos[1] === snake[i][1]) {
      isDead = true;
      return;
    }
  }

  // check for hit food
  if (newSnakePos[0] === foodPos[0] && newSnakePos[1] === foodPos[1]) {
    // just append new pos to snake body
    snake.push(newSnakePos);
    generateFoodPos();
    return;
  }

  // move snake
  snake.shift();
  snake.push(newSnakePos);
}

function drawMoveHint() {
  // draw touch start pos
  {
    var pos = touchStartPos;
    var c = makeARGB(255, 64, 64, 64);
    for (var d = -1; d <= 1; d++) {
      fillPixel(c, pos[0] - 2, pos[1] + d);
      fillPixel(c, pos[0] + 2, pos[1] + d);
      fillPixel(c, pos[0] + d, pos[1] - 2);
      fillPixel(c, pos[0] + d, pos[1] + 2);
    }
  }

  // draw touch move pos
  {
    var pos = touchMovePos;
    var c = makeARGB(255, 128, 128, 128);
    for (var d = -1; d <= 1; d++) {
      fillPixel(c, pos[0] - 2, pos[1] + d);
      fillPixel(c, pos[0] + 2, pos[1] + d);
      fillPixel(c, pos[0] + d, pos[1] - 2);
      fillPixel(c, pos[0] + d, pos[1] + 2);
    }
  }

  var rgb = makeARGB(255, 0, 64, 128);
  var pendingRgb = makeARGB(255, 255, 128, 0);

  // draw arrows, highlight new dir

  {
    var c = (newDir[0] === -1) ? pendingRgb : rgb;
    for (var d = 0; d <= 2; d++) {
      fillPixel(c, 0 + d, 7 - d);
      fillPixel(c, 0 + d, 7 + d);
    }
  }

  {
    var c = (newDir[0] === 1) ? pendingRgb : rgb;
    for (var d = 0; d <= 2; d++) {
      fillPixel(c, 14 - d, 7 - d);
      fillPixel(c, 14 - d, 7 + d);
    }
  }

  {
    var c = (newDir[1] === -1) ? pendingRgb : rgb;
    for (var d = 0; d <= 2; d++) {
      fillPixel(c, 7 - d, 0 + d);
      fillPixel(c, 7 + d, 0 + d);
    }
  }

  {
    var c = (newDir[1] === 1) ? pendingRgb : rgb;
    for (var d = 0; d <= 2; d++) {
      fillPixel(c, 7 - d, 14 - d);
      fillPixel(c, 7 + d, 14 - d);
    }
  }
}
`;

export default kSampleCodeSnakeGame;