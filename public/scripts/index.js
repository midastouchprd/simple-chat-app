let isAlreadyCalling = false;
let getCalled = false;

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
  console.log(user, "createITEM CONTAINER");
  const userContainerEl = document.createElement("div");

  const usernameEl = document.createElement("p");

  userContainerEl.setAttribute("class", "active-user");
  userContainerEl.setAttribute("id", user.id);
  usernameEl.setAttribute("class", "username");
  usernameEl.innerHTML = `User: ${user.name}`;

  userContainerEl.appendChild(usernameEl);

  userContainerEl.addEventListener("click", () => {
    console.log("clicked on: ", user);
    unselectUsersFromList();
    userContainerEl.setAttribute("class", "active-user active-user--selected");
    callUser(user);
  });

  return userContainerEl;
}

async function callUser(user) {
  const talkingWithInfo = document.getElementById("talking-with-info");
  talkingWithInfo.innerHTML = `Talking with: "${user.name}"`;
  const offer = await peerConnection.createOffer();
  await peerConnection.setLocalDescription(new RTCSessionDescription(offer));

  socket.emit("call-user", {
    offer,
    to: user.id,
  });
}

function updateUserList(users) {
  const activeUserContainer = document.getElementById("active-user-container");

  users.forEach((user) => {
    console.log(user.name, "from updateUserLIST");
    const alreadyExistingUser = document.getElementById(user.id);
    if (!alreadyExistingUser) {
      const userContainerEl = createUserItemContainer(user);

      activeUserContainer.appendChild(userContainerEl);
    } else {
      alreadyExistingUser.innerHTML = `<p class="username">User: ${user.name}</p>`;
    }
  });
}

const socket = io.connect(location.host);

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

  console.log("Client has emitted make-answer, with: ", {
    answer,
    to: data.socket,
  });

  socket.emit("make-answer", {
    answer,
    to: data.socket,
  });
  getCalled = true;
});

socket.on("answer-made", async (data) => {
  console.log("Client has heard answer-made: ", data);
  await peerConnection.setRemoteDescription(
    new RTCSessionDescription(data.answer)
  );

  if (!isAlreadyCalling) {
    callUser(data.socket);
    isAlreadyCalling = true;
  }
});

socket.on("call-rejected", (data) => {
  console.log("Client has heard call-rejected: ", data);
  alert(`User: "Socket: ${data.socket.name}" rejected your call.`);
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

  console.log("Client has emitted add-name, with: ", name);
  socket.emit("add-name", name);
});
