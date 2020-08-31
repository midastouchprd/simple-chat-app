import { Server } from "./server";
import { hostname, homedir, userInfo } from "os";

const server = new Server();

console.log(hostname(), homedir(), userInfo());

server.listen((port) => {
  console.log(`Server is listening on: ${port}`);
});
