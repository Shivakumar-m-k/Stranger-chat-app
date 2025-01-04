const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*", // Allow requests from the frontend
    methods: ["GET", "POST"],
  },
});

let userQueue = []; // Queue to store users waiting for a chat
let activePairs = new Map(); // Map to store active chat pairs

let usersQueue = []; // Queue for unmatched users
let activeChats = {}; // Tracks active chat pairs

io.on("connection", (socket) => {
  console.log("User connected:", socket.id);

  // Handle joining the queue
  socket.on("joinQueue", () => {
    if (usersQueue.length > 0) {
      const partner = usersQueue.shift(); // Match with the first in queue
      activeChats[socket.id] = partner;
      activeChats[partner] = socket.id;

      socket.emit("paired", { partner });
      io.to(partner).emit("paired", { partner: socket.id });
    } else {
      usersQueue.push(socket.id); // Add to the queue if no one is available
    }
  });

  // Handle messages
  socket.on("message", ({ to, message }) => {
    io.to(to).emit("message", { from: socket.id, content: message });
  });

  // Handle end chat
  socket.on("endChat", () => {
    const partner = activeChats[socket.id];
    if (partner) {
      io.to(partner).emit("chatEnded"); // Notify partner
      delete activeChats[partner];
      delete activeChats[socket.id];
    }
    socket.emit("chatEnded"); // Notify self
  });

  // Handle disconnection
  socket.on("disconnect", () => {
    const partner = activeChats[socket.id];
    if (partner) {
      io.to(partner).emit("partnerDisconnected");
      delete activeChats[partner];
    }
    const index = usersQueue.indexOf(socket.id);
    if (index !== -1) {
      usersQueue.splice(index, 1); // Remove from queue if waiting
    }
    delete activeChats[socket.id];
    console.log(`User disconnected: ${socket.id}`);
  });


  function pairUsers() {
    while (userQueue.length > 1) {
      const user1 = userQueue.shift();
      const user2 = userQueue.shift();

      activePairs.set(user1.socketId, user2.socketId);
      activePairs.set(user2.socketId, user1.socketId);

      io.to(user1.socketId).emit("paired", { partner: user2.socketId });
      io.to(user2.socketId).emit("paired", { partner: user1.socketId });

      console.log(`Paired ${user1.socketId} with ${user2.socketId}`);
    }
  }
});

server.listen(3000, () => {
  console.log("Server running on http://localhost:3000");
});
