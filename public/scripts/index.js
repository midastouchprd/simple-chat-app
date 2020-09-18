var remoteVideo = document.getElementById("remote-video");
var peerConnection = null;
var wsConnection = new WebSocket(
  "wss://wse54aus.gigcasters.com/webrtc-session.json"
);
wsConnection.binaryType = "arraybuffer";
var streamInfo = {
  applicationName: "webrtc",
  streamName: "",
  sessionId: "",
};
var userData = {};
var availbleStreams = [];
const iceServers = [
  { url: "stun:stun01.sipphone.com" },
  { url: "stun:stun.ekiga.net" },
  { url: "stun:stun.fwdnet.net" },
  { url: "stun:stun.ideasip.com" },
  { url: "stun:stun.iptel.org" },
  { url: "stun:stun.rixtelecom.se" },
  { url: "stun:stun.schlund.de" },
  { url: "stun:stun.l.google.com:19302" },
  { url: "stun:stun1.l.google.com:19302" },
  { url: "stun:stun2.l.google.com:19302" },
  { url: "stun:stun3.l.google.com:19302" },
  { url: "stun:stun4.l.google.com:19302" },
  { url: "stun:stunserver.org" },
  { url: "stun:stun.softjoys.com" },
  { url: "stun:stun.voiparound.com" },
  { url: "stun:stun.voipbuster.com" },
  { url: "stun:stun.voipstunt.com" },
  { url: "stun:stun.voxgratia.org" },
  { url: "stun:stun.xten.com" },
  {
    url: "turn:numb.viagenie.ca",
    credential: "muazkh",
    username: "webrtc@live.com",
  },
  {
    url: "turn:192.158.29.39:3478?transport=udp",
    credential: "JZEOEt2V3Qb0y27GRntt2u2PAYA=",
    username: "28224511:1379330808",
  },
  {
    url: "turn:192.158.29.39:3478?transport=tcp",
    credential: "JZEOEt2V3Qb0y27GRntt2u2PAYA=",
    username: "28224511:1379330808",
  },
];
window.RTCPeerConnection =
  window.RTCPeerConnection ||
  window.mozRTCPeerConnection ||
  window.webkitRTCPeerConnection;
window.RTCIceCandidate =
  window.RTCIceCandidate ||
  window.mozRTCIceCandidate ||
  window.webkitRTCIceCandidate;
window.RTCSessionDescription =
  window.RTCSessionDescription ||
  window.mozRTCSessionDescription ||
  window.webkitRTCSessionDescription;
// start button clicked

function enhanceSDP(sdpStr) {
  var sdpLines = sdpStr.split(/\r\n/);
  var sdpStrRet = "";

  for (var sdpIndex in sdpLines) {
    var sdpLine = sdpLines[sdpIndex];

    if (sdpLine.length == 0) continue;

    if (sdpLine.includes("profile-level-id")) {
      // console.log("found profile-id");
      // This profile seems to be correct for the stream publishing,
      // however will not allow Safari to play it back, so we swap
      // it for a baseline constrained one, which is declared when
      // Safari publishes in the SDP.
      if (sdpLine.includes("640029")) {
        sdpLine = sdpLine.replace("640029", "42E01F");
      }
    }

    sdpStrRet += sdpLine;
    sdpStrRet += "\r\n";
  }

  return sdpStrRet;
}

function gotDescription(description) {
  peerConnection.setLocalDescription(
    description,
    function () {
      wsConnection.send(
        '{"direction":"play", "command":"sendResponse", "streamInfo":' +
          JSON.stringify(streamInfo) +
          ', "sdp":' +
          JSON.stringify(description) +
          ', "userData":' +
          JSON.stringify(userData) +
          "}"
      );
    },
    errorHandler
  );
}

function gotRemoteTrack(event) {
  if ("srcObject" in remoteVideo) {
    remoteVideo.srcObject = event.stream;
  } else {
    remoteVideo.src = window.URL.createObjectURL(event.stream);
  }
}

function gotRemoteStream(event) {
  if ("srcObject" in remoteVideo) {
    remoteVideo.srcObject = event.stream;
  } else {
    remoteVideo.src = window.URL.createObjectURL(event.stream);
  }
}

function getLocalVideo() {
  // console.log("get local vid");
  navigator.getUserMedia(
    { video: true, audio: true },
    (stream) => {
      const localVideo = document.getElementById("local-video");
      if (localVideo) {
        localVideo.srcObject = stream;
      }
    },
    errorHandler
  );
}

function setupPeerConnection() {
  peerConnection = new RTCPeerConnection({ iceServers }, null);
  peerConnection.ontrack = gotRemoteTrack;
  peerConnection.onaddstream = gotRemoteStream;
}

function wsConnect() {
  wsConnection.onopen = function () {
    setupPeerConnection();
    sendPlayGetAvailableStreams();
  };

  function sendPlayGetAvailableStreams() {
    wsConnection.send(
      '{"direction":"play", "command":"getAvailableStreams", "streamInfo":' +
        JSON.stringify(streamInfo) +
        ', "userData":' +
        JSON.stringify(userData) +
        "}"
    );
  }

  wsConnection.onmessage = function (evt) {
    var msgJSON = JSON.parse(evt.data);
    var msgStatus = Number(msgJSON["status"]);
    var msgCommand = msgJSON["command"];

    if (msgCommand === "getAvailableStreams") {
      let panel = document.getElementById("active-user-container");
      availbleStreams = msgJSON["availableStreams"];
      availbleStreams.map((stream) => {
        let p = document.createElement("p");
        p.innerHTML = stream.streamName;
        p.addEventListener("click", () => {
          startPlay(stream);
        });
        panel.appendChild(p);
      });
    }

    if (msgStatus == 514) {
      // repeater stream not ready
      repeaterRetryCount++;
      if (repeaterRetryCount < 10) {
        setTimeout(sendGetOffer, 500);
      } else {
        stopPlay();
      }
    } else if (msgStatus != 200) {
      stopPlay();
    } else {
      var streamInfoResponse = msgJSON["streamInfo"];
      if (streamInfoResponse !== undefined) {
        streamInfo.sessionId = streamInfoResponse.sessionId;
      }

      var sdpData = msgJSON["sdp"];
      if (sdpData !== undefined) {
        // We mundge the SDP here, before creating an Answer
        // If you can get the new MediaAPI to work this might
        // not be needed.
        msgJSON.sdp.sdp = enhanceSDP(msgJSON.sdp.sdp);
        peerConnection.setRemoteDescription(
          new RTCSessionDescription(msgJSON.sdp),
          function () {
            peerConnection.createAnswer(gotDescription, errorHandler);
          },
          errorHandler
        );
      }

      var iceCandidates = msgJSON["iceCandidates"];
      if (iceCandidates !== undefined) {
        for (var index in iceCandidates) {
          peerConnection.addIceCandidate(
            new RTCIceCandidate(iceCandidates[index])
          );
        }
      }
    }
  };

  wsConnection.onerror = function (evt) {
    console.log("wsConnection.onerror: " + JSON.stringify(evt));
  };
}

function startPlay(stream) {
  setupPeerConnection();
  let streamInfo = {
    applicationName: "webrtc",
    streamName: stream.streamName,
    sessionId: "",
  };

  wsConnection.send(
    '{"direction":"play", "command":"getOffer", "streamInfo":' +
      JSON.stringify(streamInfo) +
      ', "userData":' +
      JSON.stringify(userData) +
      "}"
  );
}

function errorHandler(e) {
  console.error(e);
}

function init() {
  try {
    getLocalVideo();
    wsConnect();
  } catch (e) {
    console.log(e);
  }
}

init();
