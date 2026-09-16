import "dotenv/config";
import http from "http";
import { Server } from "socket.io";
import createApp from "./app.js";
import { connectDB } from "./config/db.js";
import { initSocket } from "./sockets/index.js";

const PORT = process.env.PORT || 4000;
const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN;
const NODE_ENV = process.env.NODE_ENV || "development";

async function start() {
  await connectDB();

  const ioRef = { io: null };
  const app = createApp(ioRef);
  const server = http.createServer(app);

  const io = new Server(server, {
    cors: { origin: CLIENT_ORIGIN, credentials: true },
  });
  ioRef.io = io;
  initSocket(io);

  server.listen(PORT, () => {
    console.log(`[${NODE_ENV}] API + sockets on http://localhost:${PORT}`);
  });
}

start().catch((err) => {
  console.error("Failed to start:", err.message);
  process.exit(1);
});