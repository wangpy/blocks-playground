export const kSampleCodeDrawImageOrVideo = `
/*
 * Display Image / video
 *
 * Sample code to demonstrate adding custom control on web UI and image / video processing.
 * 
 * Usage: 
 * 1. Choose the file to load using left side "Choose File" button.
 *    (If file content does not appear below the button, try again)
 * 2. Touch X / Y to change image brightness / contrast.
 * 3. While video is playing:
 *    - Apply pressure to reduce video playing speed.
 *    - Tap on the bottom gray line to change video playing position.
 */

// Add global variables here - DO NOT CALL API FUNCTIONS HERE
var customControlElement = null;
var uploadFileButton = null;
var uploadedImageElement = null;
var uploadedVideoElement = null;
var canvasToDisplay = null;
var videoLoopInterval = null;
var canvasSize = 15;
var canvasImageData = null;
var touchPosX = 0;
var touchPosY = 0;
var touchPosVZ = 0;
var isVideo = false;

function drawElementToCanvasToDisplay(element, sourceWidth, sourceHeight) {
  // Resize the image
  var target_size = canvasSize,
      width = sourceWidth,
      height = sourceHeight,
      left = 0,
      top = 0;
  if (width > height) {
    height *= target_size / width;
    width = target_size;
    top = (target_size - height) / 2.0;
  } else {
    width *= target_size / height;
    height = target_size;
    left = (target_size - width) / 2.0;
  }
  var ctx = canvasToDisplay.getContext('2d');
  ctx.beginPath();
  ctx.rect(0, 0, target_size, target_size);
  ctx.fillStyle = 'black';
  ctx.fill();
  ctx.drawImage(element, left, top, width, height);
  canvasImageData = ctx.getImageData(0, 0, canvasSize, canvasSize);
}

function videoLoop() {
    if (uploadedVideoElement && !uploadedVideoElement.paused && !uploadedVideoElement.ended) {
      drawElementToCanvasToDisplay(uploadedVideoElement, uploadedVideoElement.videoWidth, uploadedVideoElement.videoHeight);
      uploadedVideoElement.playbackRate = 1.0 - touchPosVZ / 255.0;
    }
}

function handleUploadFileChanged(event) {
    var file = event.target.files[0];

    if (file.type.match(/^image\\//)) {
        // Load the image
        var reader = new FileReader();
        reader.onload = function (readerEvent) {
            uploadedImageElement.onload = function (imageEvent) {
		      drawElementToCanvasToDisplay(uploadedImageElement, uploadedImageElement.naturalWidth, uploadedImageElement.naturalHeight);
            };
            uploadedImageElement.src = readerEvent.target.result;
            uploadedImageElement.style.display = 'block';
            uploadedVideoElement.style.display = 'none';
            isVideo = false;
        }
        reader.readAsDataURL(file);
    } else if (file.type.match(/^video\\//)) {
        // Load the video
        var reader = new FileReader();
        reader.onload = function (readerEvent) {
            uploadedVideoElement.onloadedmetadata = function(event) {
              uploadedVideoElement.style.display = 'block';
              uploadedImageElement.style.display = 'none';
              isVideo = true;
              uploadedVideoElement.controls = true;
              videoLoopInterval = setInterval(videoLoop, 100);
            };
            uploadedVideoElement.src = readerEvent.target.result;
            uploadedVideoElement.playbackRate = 1.0 - touchPosVZ / 255.0;
        }
        reader.readAsDataURL(file);
    }
}

function loadImageFromURL(url) {
    var xmlHTTP = new XMLHttpRequest();
    xmlHTTP.open('GET', url, true);

    // Must include this line - specifies the response type we want
    xmlHTTP.responseType = 'arraybuffer';

    xmlHTTP.onload = function(e)
    {
        var arr = new Uint8Array(this.response);

        // Convert the int array to a binary string
        // We have to use apply() as we are converting an *array*
        // and String.fromCharCode() takes one or more single values, not
        // an array.
        var raw = String.fromCharCode.apply(null,arr);

        // This works!!!
        var b64=btoa(raw);
        var dataURL="data:image/jpeg;base64,"+b64;
        uploadedImageElement.onload = function (imageEvent) {
          drawElementToCanvasToDisplay(uploadedImageElement, uploadedImageElement.naturalWidth, uploadedImageElement.naturalHeight);
        };
        uploadedImageElement.src = dataURL;
        uploadedImageElement.style.display = 'block';
        uploadedVideoElement.style.display = 'none';
        isVideo = false;
    };

    xmlHTTP.send();
}

function initialise() {
  customControlElement = document.getElementById('custom-control');
  customControlElement.innerHTML = 
    '<div><input name="file[]" type="file" id="upload-file" accept="image/*, video/*" /></div>'
    + '<div><image id="uploaded-image" style="width: 300px; height: 300px; object-fit: contain; object-position: center center; display: none;" /></div>'
    + '<div><video id="uploaded-video" style="width: 300px; height: 300px; object-fit: contain; object-position: center center; display: none;" defaultMuted></video></div>'
    + '<div><canvas id="canvas-to-display" width="'+canvasSize+'" height="'+canvasSize+'"></canvas></div>'
    + '<div><button id="extract-canvas-data-button">Export Canvas Data to Code</button></div>';
  uploadFileButton = document.getElementById('custom-control');
  uploadFileButton.onchange = handleUploadFileChanged;
  uploadedImageElement = document.getElementById('uploaded-image');
  uploadedVideoElement = document.getElementById('uploaded-video');
  canvasToDisplay = document.getElementById('canvas-to-display');
  document.getElementById('extract-canvas-data-button').addEventListener('click', function() {
    if (canvasImageData != null) {
      var textArea = document.createElement('textArea');
      textArea.rows = 10;
      textArea.cols = 30;
      textArea.innerHTML = 'var canvasImageData = '+ JSON.stringify({
        width: canvasImageData.width,
        height: canvasImageData.height,
        data: Array.from(canvasImageData.data)
      }, null, 2) + ';';
      customControlElement.appendChild(textArea);
    } else {
      alert('Please use "Choose File" button to select image / video first');
    }
  });
  
  if (canvasImageData === null) {
    // NOTE: this is just for demo porpose, and only works on the image URL on the same web server hostname Due to cross-platform policy.
    // Please use the "Choose File" button to upload your own image / video and use button to extract data array.
    loadImageFromURL('https://wangpy.github.io/blocks-playground/images/fireman-304669_640.png');
  }
}

function repaint() {
  clearDisplay();
  if (canvasImageData != null) {
    var imageData = canvasImageData.data;
    var i = 0, x, y, r, g, b, a;
    var mul = 1.0 - 0.9 * touchPosX / 4096;
    var scale = 1.0 - 0.9 * touchPosY / 4096;
    for (var y=0; y<canvasImageData.height; y++) {
      for (var x=0; x<canvasImageData.width; x++) {
        r = imageData[i];
        g = imageData[i+1];
        b = imageData[i+2];
        a = imageData[i+3];
        
        // do some color processing
        r = Math.round(255 * Math.pow(scale * r / 255.0, mul));
        g = Math.round(255 * Math.pow(scale * g / 255.0, mul));
        b = Math.round(255 * Math.pow(scale * b / 255.0, mul));

        fillRect(makeARGB(a, r, g, b), x, y, 1, 1);
        i+=4;
      }
    }
  }

  // Draw and fade touch points.
  drawPressureMap();
  fadePressureMap();

  if (isVideo) {
    fillRect(makeARGB(255, 64, 64, 64), 0, 14, 15, 1);  
    var headPos = Math.floor(15.0 * uploadedVideoElement.currentTime / uploadedVideoElement.duration);
    fillRect(makeARGB(255, 255, 255, 255), headPos, 14, 1, 1);
  }
}

// touchIndex: number, first touch = 1
// x: number 0-4095
// y: number 0-4095
// vz: number 0-255

function touchStart(touchIndex, x, y, vz) {
  addPressurePoint(makeARGB(255, 255, 255, 0), x, y, vz);
  
  if (touchIndex === 1) {
    var xDotPos = 15 * x / 4096.0;
    var yDotPos = 15 * y / 4096.0;
    if (isVideo && yDotPos >= 14) {
      uploadedVideoElement.currentTime = Math.floor(xDotPos) / 15.0 * uploadedVideoElement.duration;
    } else {
      touchPosX = x;
      touchPosY = y;
      touchPosVZ = vz;

      uploadedVideoElement.playbackRate = 1.0 - (vz / 255.0);
    }
  }
}

function touchMove(touchIndex, x, y, vz) {
  addPressurePoint(makeARGB(32, 255, 0, 0), x, y, vz / 2);

  if (touchIndex === 1) {
    touchPosX = x;
    touchPosY = y;
    touchPosVZ = vz;
  }
}

function touchEnd(touchIndex, x, y, vz) {
  if (touchIndex === 1) {
    touchPosVZ = 0;
  }
}
`;

export default kSampleCodeDrawImageOrVideo;