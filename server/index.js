import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import { createPeerRegistry } from "./peers.js";
import QRCode from "qrcode";
import os from "os";

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: { origin: "*" },
  maxHttpBufferSize: 10 * 1024 * 1024, // 10MB per chunk
});

const PORT = process.env.PORT || 3001;
const peers = createPeerRegistry();

// Utility: get local LAN IP
function getLanIp() {
  const interfaces = os.networkInterfaces();
  for (const iface of Object.values(interfaces)) {
    for (const alias of iface) {
      if (alias.family === "IPv4" && !alias.internal) return alias.address;
    }
  }
  return "localhost";
}

io.on("connection", (socket) => {
  console.log(`[+] Socket connected: ${socket.id}`);

  // Step 1: client sends its identity after connecting
  socket.on("register", ({ name, deviceType }) => {
    const peer = peers.add(socket.id, { name, deviceType });
    socket.emit("registered", { id: socket.id, peers: peers.list() });
    socket.broadcast.emit("peer-joined", peer);
    console.log(`[register] ${name} (${deviceType}) — ${socket.id}`);
  });

  // Step 2: WebRTC signaling relay — offer
  socket.on("signal-offer", ({ targetId, offer }) => {
    io.to(targetId).emit("signal-offer", { fromId: socket.id, offer });
  });

  // Step 3: WebRTC signaling relay — answer
  socket.on("signal-answer", ({ targetId, answer }) => {
    io.to(targetId).emit("signal-answer", { fromId: socket.id, answer });
  });

  // Step 4: ICE candidate relay
  socket.on("signal-ice", ({ targetId, candidate }) => {
    io.to(targetId).emit("signal-ice", { fromId: socket.id, candidate });
  });

  // Notify incoming transfer (metadata only, actual bytes go P2P)
  socket.on("transfer-request", ({ targetId, fileName, fileSize, fileType }) => {
    io.to(targetId).emit("transfer-incoming", {
      fromId: socket.id,
      fileName,
      fileSize,
      fileType,
    });
  });

  socket.on("disconnect", () => {
    const peer = peers.remove(socket.id);
    if (peer) socket.broadcast.emit("peer-left", { id: socket.id });
    console.log(`[-] Socket disconnected: ${socket.id}`);
  });
});

httpServer.listen(PORT, "0.0.0.0", async () => {
  const ip = getLanIp();
  const url = `http://${ip}:5173`; // Vite dev server
  console.log(`\n🚀  Server running on port ${PORT}`);
  console.log(`📡  LAN address: http://${ip}:${PORT}`);
  console.log(`\n📱  Open on any device on your network:`);
  console.log(`    ${url}\n`);
  try {
    const qr = await QRCode.toString(url, { type: "terminal", small: true });
    console.log(qr);
  } catch (_) {}
});
