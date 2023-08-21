import { createServer } from "http";
import { Server as io } from "socket.io";

const server = createServer();
const sockets = new io(server, {
  path: "/my-custom-path/",
  cors: {
    credentials: true,
    origin: [
      "https://itransition-task-7-front.onrender.com",
      "http://localhost:4200",
      "*",
    ],
  },
});

const NUM_PLAYERS = 2;
const games = {};

try {
  sockets.on("connection", (socket) => {
    console.log(`User connected, ${socket.id}`);
    let gameId;

    function createGame() {
      gameId = getUniqueId();
      games[gameId] = {
        players: 0,
        boards: [],
      };
      socket.join(gameId);
      socket.emit(
        "message",
        JSON.stringify({ event: "game_created", message: { gameId: gameId } })
      );
    }

    function joinGame(gameId) {
      if (!games[gameId]) {
        socket.emit(
          "message",
          JSON.stringify({
            event: "join_failed",
            message: { message: "Game not found", gameId: gameId },
          })
        );
        return;
      } else if (games[gameId].players >= NUM_PLAYERS) {
        socket.emit(
          "message",
          JSON.stringify({
            event: "join_failed",
            message: { message: "Game is full", gameId: gameId },
          })
        );
        return;
      } else {
        games[gameId].players++;

        socket.join(gameId);

        socket.emit(
          "message",
          JSON.stringify({
            event: "join_successful",
            message: { gameId: gameId },
          })
        );

        sockets.to(gameId).emit(
          "message",
          JSON.stringify({
            event: `${gameId}:member_added`,
            message: { count: games[gameId].players, gameId: gameId },
          })
        );

        sockets.to(gameId).emit(
          "message",
          JSON.stringify({
            event: `${gameId}:subscription_succeeded`,
            message: {
              count: games[gameId].players,
              gameId: gameId,
              boards: games[gameId].boards,
            },
          })
        );
        return;
      }
    }

    function getBoards(gameId) {
      if (games[gameId]?.players === 2) {
        sockets.to(gameId).emit(
          "message",
          JSON.stringify({
            event: `${gameId}:boards`,
            message: {
              gameId: gameId,
              board1: games[gameId].board1,
              board2: games[gameId].board2,
            },
          })
        );
      } else {
        return;
      }
      return;
    }

    function removePlayer(gameId) {
      if (games[gameId]) {
        games[gameId].players--;
        sockets.to(gameId).emit("member_removed", games[gameId].players);
      }
    }

    function fireTorpedo(data) {
      const { gameId, player, score, boardId, board } = data;
      sockets.to(gameId).emit(
        "message",
        JSON.stringify({
          event: `client-fire`,
          message: { boardId, board, player, score, canPlay: true },
        })
      );
      return;
    }

    function saveName(data) {
      // games[gameId] = {
      //   name: data,
      // };
    }

    socket.on("message", async (message) => {
      switch (message.type) {
        case "saveName":
          saveName(message.name);
          break;
        case "createGame":
          createGame();
          joinGame(gameId);
          console.log(gameId);
          break;
        case "joinGame":
          joinGame(message.gameId);
          getBoards(message.gameId);
          break;
        case "client-fire":
          fireTorpedo(message);
          getBoards(message.gameId);
          break;
        case "created-board":
          games[gameId].board1 = message.board1;
          games[gameId].board2 = message.board2;
          break;
        default:
          break;
      }
    });

    socket.on("disconnect", () => {
      if (gameId) {
        socket.leave(gameId);
        removePlayer(gameId);
      }
    });
  });
} catch (error) {
  console.error(error);
}

server.listen(5050, () => {
  console.log("Server is running on port 5050");
});

function getUniqueId() {
  return Math.random().toString(36).substr(2, 8);
}
