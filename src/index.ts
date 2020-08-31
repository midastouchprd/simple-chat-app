import { Server } from "./server";

const server = new Server();
console.log(server);

server.listen((port) => {
  console.log(`Server is listening on: ${port}`);
});
