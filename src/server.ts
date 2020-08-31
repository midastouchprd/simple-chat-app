import express, { Application } from "express";
import socketIO, { Server as SocketIOServer } from "socket.io";
import { createServer, Server as HTTPServer } from "http";
import path from "path";

const port = process.env.PORT;

export class Server {
  private httpServer: HTTPServer;
  private app: Application;
  private io: SocketIOServer;
  private PORT: number;
  private activeSockets: { id: string; name: string }[] = [];

  constructor() {
    this.initialize();
  }

  private initialize(): void {
    this.PORT = port | 5000;
    this.app = express();
    this.httpServer = createServer(this.app);
    this.io = socketIO(this.httpServer);

    this.configureApp();
    this.configureRoutes();
    this.handleSocketConnection();
  }

  private configureApp(): void {
    this.app.use(express.static(path.join(__dirname, "../public")));
  }

  private configureRoutes(): void {
    this.app.get("/", (req, res) => {
      res.sendFile("index.html");
    });
  }

  private handleSocketConnection(): void {
    this.io.on("connection", (socket) => {
      console.log("server heard connection from: ", socket.id);

      const existingSocket = this.activeSockets.find(
        (existingSocket) => existingSocket.id === socket.id
      );

      if (!existingSocket) {
        this.activeSockets.push({ id: socket.id, name: `user-${socket.id}` });

        console.log("server emitting update-user-list from: ", socket.id);

        socket.emit("update-user-list", {
          users: this.activeSockets.filter(
            (existingSocket) => existingSocket.id !== socket.id
          ),
        });

        console.log(
          "server broadcast emitting update-user-list from: ",
          socket.id
        );

        socket.broadcast.emit("update-user-list", {
          users: [{ id: socket.id, name: `user-${socket.id}` }],
        });
      }

      socket.on("add-name", (data: any) => {
        console.log("server heard add-name from: ", socket.id);
        console.log(this.activeSockets);
        const myActiveSocketIndex = this.activeSockets
          .map((s) => s.id)
          .indexOf(socket.id);

        this.activeSockets[myActiveSocketIndex].name = data;

        console.log(
          "server broadcast emitting update-user-list from: ",
          socket.id
        );

        socket.emit("update-user-list", {
          users: this.activeSockets.filter(
            (existingSocket) => existingSocket.id !== socket.id
          ),
        });
      });

      socket.on("call-user", (data: any) => {
        console.log("server heard call-user from: ", socket.id);

        console.log("server broadcast emitting call-made from: ", socket.id);
        socket.to(data.to).emit("call-made", {
          offer: data.offer,
          socket: socket.id,
        });
      });

      socket.on("make-answer", (data) => {
        console.log("server heard make-answser from: ", socket.id);
        console.log("server broadcast emitting answer-made from: ", socket.id);
        socket.to(data.to).emit("answer-made", {
          socket: socket.id,
          answer: data.answer,
        });
      });

      socket.on("reject-call", (data) => {
        console.log("server heard rejected-call from: ", socket.id);
        console.log(
          "server broadcast emitting call rejected from: ",
          socket.id
        );
        socket.to(data.from).emit("call-rejected", {
          socket: socket.id,
        });
      });

      socket.on("disconnect", () => {
        console.log("server heard add-name from: ", socket.id);
        this.activeSockets = this.activeSockets.filter(
          (existingSocket) => existingSocket.id !== socket.id
        );
        socket.broadcast.emit("remove-user", {
          socketId: socket.id,
        });
      });
    });
  }

  public listen(callback: (port: number) => void): void {
    this.httpServer.listen(this.PORT, () => {
      callback(this.PORT);
    });
  }
}
