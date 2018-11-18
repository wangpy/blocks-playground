export const kSampleCodeDrawImageOrVideo = `
/*
 * Display Image / video
 *
 * Sample code to demonstrate adding custom control on web UI and image / video processing.
 *
 * Usage: Choose the file to load using left side "Choose File" button.
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
        }
        reader.readAsDataURL(file);
    } else if (file.type.match(/^video\\//)) {
        // Load the image
        var reader = new FileReader();
        reader.onload = function (readerEvent) {
            uploadedVideoElement.onloadedmetadata = function(event) {
              uploadedVideoElement.style.display = 'block';
              uploadedVideoElement.controls = true;
              videoLoopInterval = setInterval(videoLoop, 100);
            };
            uploadedVideoElement.src = readerEvent.target.result;
        }
        reader.readAsDataURL(file);
    }
}

function initialise() {
  customControlElement = document.getElementById('custom-control');
  customControlElement.innerHTML = 
    '<div><input name="file[]" type="file" id="upload-file" accept="image/*, video/*" /></div>'
    + '<div><image id="uploaded-image" style="width: 300px; height: 300px; object-fit: contain; object-position: center center; display: none;" /></div>'
    + '<div><video id="uploaded-video" style="width: 300px; height: 300px; object-fit: contain; object-position: center center; display: none;" defaultMuted></video></div>'
    + '<div><canvas id="canvas-to-display" width="'+canvasSize+'" height="'+canvasSize+'"></canvas></div>';
  uploadFileButton = document.getElementById('custom-control');
  uploadFileButton.onchange = handleUploadFileChanged;
  uploadedImageElement = document.getElementById('uploaded-image');
  uploadedVideoElement = document.getElementById('uploaded-video');
  canvasToDisplay = document.getElementById('canvas-to-display');
}

function repaint() {
  clearDisplay();
  if (canvasImageData != null) {
    var imageData = canvasImageData.data;
    var i = 0;
    for (var y=0; y<canvasImageData.height; y++) {
      for (var x=0; x<canvasImageData.width; x++) {
        fillRect(makeARGB(imageData[i+3], imageData[i], imageData[i+1], imageData[i+2]), x, y, 1, 1);
        i+=4;
      }
    }
  }
}
`;

export default kSampleCodeDrawImageOrVideo;