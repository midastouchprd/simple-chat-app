let isAlreadyCalling = false;
let getCalled = false;

const existingCalls = [];

const { RTCPeerConnection, RTCSessionDescription } = window;

const peerConnection = new RTCPeerConnection();

function unselectUsersFromList() {
  const alreadySelectedUser = document.querySelectorAll(
    ".active-user.active-user--selected"
  );

  alreadySelectedUser.forEach((el) => {
    el.setAttribute("class", "active-user");
  });
}

function createUserItemContainer(user) {
  const userContainerEl = document.createElement("div");

  const usernameEl = document.createElement("p");

  userContainerEl.setAttribute("class", "active-user");
  userContainerEl.setAttribute("id", user.id);
  usernameEl.setAttribute("class", "username");
  usernameEl.innerHTML = `User: ${user.name}`;

  userContainerEl.appendChild(usernameEl);

  userContainerEl.addEventListener("click", () => {
    unselectUsersFromList();
    userContainerEl.setAttribute("class", "active-user active-user--selected");
    const talkingWithInfo = document.getElementById("talking-with-info");
    talkingWithInfo.innerHTML = `Talking with: "Socket: ${user.name}"`;
    callUser(user.id);
  });

  return userContainerEl;
}

async function callUser(socketId) {
  const offer = await peerConnection.createOffer();
  await peerConnection.setLocalDescription(new RTCSessionDescription(offer));

  socket.emit("call-user", {
    offer,
    to: socketId,
  });
}

function updateUserList(users) {
  const activeUserContainer = document.getElementById("active-user-container");

  users.forEach((user) => {
    const alreadyExistingUser = document.getElementById(user.id);
    if (!alreadyExistingUser) {
      const userContainerEl = createUserItemContainer(user);

      activeUserContainer.appendChild(userContainerEl);
    } else {
      alreadyExistingUser.innerHTML = `<p class="username">User: ${user.name}</p>`;
    }
  });
}

const socket = io.connect("localhost:5000");

socket.on("update-user-list", ({ users }) => {
  console.log("Client has heard update-user-list, with: ", users);
  updateUserList(users);
});

socket.on("remove-user", ({ socketId }) => {
  console.log("Client has heard remove-user, with: ", socketId);
  const elToRemove = document.getElementById(socketId);

  if (elToRemove) {
    elToRemove.remove();
  }
});

socket.on("call-made", async (data) => {
  console.log("Client has heard call-made, with: ", data);
  if (getCalled) {
    const confirmed = confirm(
      `User "Socket: ${data.socket}" wants to call you. Do accept this call?`
    );

    if (!confirmed) {
      console.log("Client has emitted reject-call, with: ", {
        from: data.socket,
      });
      socket.emit("reject-call", {
        from: data.socket,
      });

      return;
    }
  }

  await peerConnection.setRemoteDescription(
    new RTCSessionDescription(data.offer)
  );
  const answer = await peerConnection.createAnswer();
  await peerConnection.setLocalDescription(new RTCSessionDescription(answer));

  socket.emit("make-answer", {
    answer,
    to: data.socket,
  });
  getCalled = true;
});

socket.on("answer-made", async (data) => {
  await peerConnection.setRemoteDescription(
    new RTCSessionDescription(data.answer)
  );

  if (!isAlreadyCalling) {
    callUser(data.socket);
    isAlreadyCalling = true;
  }
});

socket.on("call-rejected", (data) => {
  alert(`User: "Socket: ${data.socket}" rejected your call.`);
  unselectUsersFromList();
});

peerConnection.ontrack = function ({ streams: [stream] }) {
  const remoteVideo = document.getElementById("remote-video");
  if (remoteVideo) {
    remoteVideo.srcObject = stream;
  }
};

navigator.getUserMedia(
  { video: true, audio: true },
  (stream) => {
    const localVideo = document.getElementById("local-video");
    if (localVideo) {
      localVideo.srcObject = stream;
    }

    stream
      .getTracks()
      .forEach((track) => peerConnection.addTrack(track, stream));
  },
  (error) => {
    console.warn(error.message);
  }
);

let userName = document.getElementById("local-user-name");
let setNameButton = document.getElementById("set-name-button");
setNameButton.addEventListener("click", (e) => {
  let name = userName.value;

  console.log(name);

  socket.emit("add-name", name);
});
