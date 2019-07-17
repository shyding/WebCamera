const resolutions = {
  'qqvga': { width: { exact: 160 }, height: { exact: 120 } },
  'qvga': { width: { exact: 320 }, height: { exact: 240 } },
  'vga': { width: { exact: 640 }, height: { exact: 480 } }
};

function Utils(errorOutputId) { // eslint-disable-line no-unused-vars
  let self = this;
  this.errorOutput = document.getElementById(errorOutputId);

  const OPENCV_URL = '../../build/wasm/opencv.js';  //local build
  this.loadOpenCv = function (onloadCallback) {
    let script = document.createElement('script');
    script.setAttribute('async', '');
    script.setAttribute('type', 'text/javascript');
    script.addEventListener('load', () => {
      if (cv.getBuildInformation) {
        console.log(cv.getBuildInformation());
        onloadCallback();
      }
      else {
        // WASM
        cv['onRuntimeInitialized'] = () => {
          console.log(cv.getBuildInformation());
          onloadCallback();
        }
      }
    });
    script.addEventListener('error', () => {
      self.printError('Failed to load ' + OPENCV_URL);
    });
    script.src = OPENCV_URL;
    let node = document.getElementsByTagName('script')[0];
    node.parentNode.insertBefore(script, node);
  };

  this.createFileFromUrl = function (path, url, callback) {
    let request = new XMLHttpRequest();
    request.open('GET', url, true);
    request.responseType = 'arraybuffer';
    request.onload = function (ev) {
      if (request.readyState === 4) {
        if (request.status === 200) {
          let data = new Uint8Array(request.response);
          cv.FS_createDataFile('/', path, data, true, false, false);
          callback();
        } else {
          self.printError(
            'Failed to load ' + url + ' status: ' + request.status);
        }
      }
    };
    request.send();
  };

  this.loadImageToCanvas = function (url, cavansId) {
    let canvas = document.getElementById(cavansId);
    let ctx = canvas.getContext('2d');
    let img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = function () {
      canvas.width = img.width;
      canvas.height = img.height;
      ctx.drawImage(img, 0, 0, img.width, img.height);
    };
    img.src = url;
  };

  this.clearError = function () {
    this.errorOutput.innerHTML = '';
  };

  this.printError = function (err) {
    if (typeof err === 'undefined') {
      err = '';
    } else if (typeof err === 'number') {
      if (!isNaN(err)) {
        if (typeof cv !== 'undefined') {
          err = 'Exception: ' + cv.exceptionFromPtr(err).msg;
        }
      }
    } else if (typeof err === 'string') {
      let ptr = Number(err.split(' ')[0]);
      if (!isNaN(ptr)) {
        if (typeof cv !== 'undefined') {
          err = 'Exception: ' + cv.exceptionFromPtr(ptr).msg;
        }
      }
    } else if (err instanceof Error) {
      err = err.stack.replace(/\n/g, '<br>');
    }
    this.errorOutput.innerHTML = err;
  };

  this.addFileInputHandler = function (fileInputId, canvasId) {
    let inputElement = document.getElementById(fileInputId);
    inputElement.addEventListener('change', (e) => {
      let files = e.target.files;
      if (files.length > 0) {
        let imgUrl = URL.createObjectURL(files[0]);
        self.loadImageToCanvas(imgUrl, canvasId);
      }
    }, false);
  };

  function onVideoCanPlay() {
    if (self.onCameraStartedCallback) {
      self.onCameraStartedCallback(self.stream, self.video);
    }
  };

  this.startCamera = function (videoConstraint, videoId, callback) {
    let video = document.getElementById(videoId);
    if (!video) video = document.createElement('video');
    if (!videoConstraint) videoConstraint = true;

    navigator.mediaDevices.getUserMedia({ video: videoConstraint, audio: false })
      .then(function (stream) {
        video.srcObject = stream;
        video.play();
        self.video = video;
        self.stream = stream;
        self.onCameraStartedCallback = callback;
        video.addEventListener('canplay', onVideoCanPlay, false);
      })
      .catch(function (err) {
        self.printError('Camera Error: ' + err.name + ' ' + err.message);
      });
  };

  this.stopCamera = function () {
    if (this.video) {
      this.video.pause();
      this.video.srcObject = null;
      this.video.removeEventListener('canplay', onVideoCanPlay);
    }
    if (this.stream) {
      this.stream.getVideoTracks()[0].stop();
    }
  };
};


function checkFeatures(info, features) {
  var wasmSupported = true, webrtcSupported = true;
  if (features.webrtc) {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      webrtcSupported = false;
    }
  }
  if (features.wasm && !window.WebAssembly) {
    wasmSupported = false;
  }

  if (!webrtcSupported || !wasmSupported) {
    var text = "Your web browser doesn't support ";
    var len = text.length;
    if (!webrtcSupported) {
      text += "WebRTC";
    }
    if (!wasmSupported) {
      if (text.length > len) {
        text += " and ";
      }
      text += "WebAssembly"
    }
    text += ".";
    info.innerHTML = text;
    return false;
  }

  return true;
}

function isMobileDevice() {
  if (/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i
    .test(navigator.userAgent)) {
    return true;
  }
  return false;
};

function setMainCanvasProperties(video) {
  video.width = video.videoWidth;
  video.height = video.videoHeight;
  canvasOutput.style.width = `${video.width}px`;
  canvasOutput.style.height = `${video.height}px`;
  document.getElementsByClassName('canvas-wrapper')[0].style.height =
    `${video.height}px`;
}

function onVideoStarted() {
  streaming = true;
  setMainCanvasProperties(video);
  document.getElementById('mainContent').classList.remove('hidden');
  startVideoProcessing();
}

function onVideoStopped() {
  streaming = false;
  let canvasContext = canvasOutput.getContext('2d');
  canvasContext.clearRect(0, 0, video.width, video.height);
}