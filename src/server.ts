import express, { Application } from "express";
import socketIO, { Server as SocketIOServer } from "socket.io";
import { createServer, Server as HTTPServer } from "http";
import path from "path";

const port = process.env.PORT || 5000;

export class Server {
  private httpServer: HTTPServer;
  private app: Application;
  private io: SocketIOServer;
  private activeSockets: { id: string; name: string }[] = [];

  constructor() {
    this.initialize();
  }

  private initialize(): void {
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
        this.activeSockets.push({
          id: socket.id,
          name: `user-${socket.id}`,
        });

        console.log(
          "server emitting update-user-list from: ",
          socket.id,
          "with: ",
          {
            users: this.activeSockets.filter(
              (existingSocket) => existingSocket.id !== socket.id
            ),
          }
        );

        //updates my list

        socket.emit("update-user-list", {
          users: this.activeSockets.filter(
            (existingSocket) => existingSocket.id !== socket.id
          ),
        });

        console.log(
          "server broadcast emitting update-user-list from: ",
          socket.id,
          "with: ",
          {
            users: [{ id: socket.id, name: `user-${socket.id}` }],
          }
        );

        //updates other list

        socket.broadcast.emit("update-user-list", {
          users: [{ id: socket.id, name: `user-${socket.id}` }],
        });
      }

      socket.on("add-name", (data: any) => {
        console.log("server heard add-name from: ", socket.id, "with: ", data);
        console.log(this.activeSockets);
        const myActiveSocketIndex = this.activeSockets
          .map((s) => s.id)
          .indexOf(socket.id);

        this.activeSockets[myActiveSocketIndex].name = data;

        console.log(
          "server emitting update-user-list from: ",
          socket.id,
          "with: ",
          {
            users: this.activeSockets.filter(
              (existingSocket) => existingSocket.id !== socket.id
            ),
          }
        );

        //updates my list

        socket.emit("update-user-list", {
          users: this.activeSockets.filter(
            (existingSocket) => existingSocket.id !== socket.id
          ),
        });

        console.log(
          "server broadcast emitting update-user-list from: ",
          socket.id,
          "with: ",
          {
            users: this.activeSockets.filter(
              (existingSocket) => existingSocket.id === socket.id
            ),
          }
        );

        //updates other list

        socket.broadcast.emit("update-user-list", {
          users: this.activeSockets.filter(
            (existingSocket) => existingSocket.id === socket.id
          ),
        });
      });

      socket.on("call-user", (data: any) => {
        console.log("server heard call-user from: ", socket.id, "with: ", data);

        console.log(
          "server broadcast emitting call-made from: ",
          socket.id,
          "with: ",
          data
        );
        socket.to(data.to).emit("call-made", {
          offer: data.offer,
          socket: socket.id,
        });
      });

      socket.on("make-answer", (data) => {
        console.log(
          "server heard make-answser from: ",
          socket.id,
          "with: ",
          data
        );
        console.log(
          "server broadcast emitting answer-made from: ",
          socket.id,
          "with: ",
          data
        );
        socket.to(data.to).emit("answer-made", {
          socket: socket.id,
          answer: data.answer,
        });
      });

      socket.on("reject-call", (data) => {
        console.log(
          "server heard rejected-call from: ",
          socket.id,
          "with: ",
          data
        );
        console.log(
          "server broadcast emitting call rejected from: ",
          socket.id,
          "with: ",
          data
        );
        socket.to(data.from).emit("call-rejected", {
          socket: socket.id,
        });
      });

      socket.on("disconnect", () => {
        console.log("server heard disconnect from: ", socket.id, "with: ");
        this.activeSockets = this.activeSockets.filter(
          (existingSocket) => existingSocket.id !== socket.id
        );
        socket.broadcast.emit("remove-user", {
          socketId: socket.id,
        });
      });
    });
  }

  public listen(callback: (port: string | number) => void): void {
    this.httpServer.listen(port, () => {
      callback(port);
    });
  }
}
