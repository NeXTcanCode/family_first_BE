import jwt from "jsonwebtoken";
import Family from "../models/Family.js";

// Socket.IO middleware: parses token cookie, verifies, attaches socket.userId.
function verifyHandshake(socket, next) {
  const cookieHeader = socket.handshake?.headers?.cookie || "";
  const match = cookieHeader.match(/(?:^|;\s*)token=([^;]+)/);
  if (!match) {
    return next(new Error("unauthorized"));
  }
  try {
    const payload = jwt.verify(match[1], process.env.JWT_SECRET);
    socket.userId = payload.userId;
    return next();
  } catch {
    return next(new Error("unauthorized"));
  }
}

export function initSocket(io) {
  io.use(verifyHandshake);

  io.on("connection", async (socket) => {
    try {
      socket.join(`user:${socket.userId}`);
      const families = await Family.find({ members: socket.userId }).select(
        "_id"
      );
      families.forEach((f) => socket.join(`family:${f._id}`));
    } catch {
      // leave rooms empty on failure; core socket still works
    }
  });
}