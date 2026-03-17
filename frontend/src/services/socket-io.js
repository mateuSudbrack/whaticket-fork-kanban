import openSocket from "socket.io-client";
import {
  getBackendSocketPath,
  getBackendSocketUrl
} from "../config";

function connectToSocket() {
  let token = localStorage.getItem("token");
  if (token) {
    token = JSON.parse(token);
  }

  return openSocket(getBackendSocketUrl(), {
    path: getBackendSocketPath(),
    transports: ["websocket", "polling", "flashsocket"],
    query: {
      token: token
    }
  });
}

export default connectToSocket;
