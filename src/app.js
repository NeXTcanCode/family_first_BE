import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import morgan from "morgan";

import authRoutes from "./routes/authRoutes.js";
import familyRoutes from "./routes/familyRoutes.js";
import userRoutes from "./routes/userRoutes.js";
import { verifyJwtCookie } from "./middleware/auth.js";
import errorHandler from "./middleware/errorHandler.js";

// Builds the express app; does NOT listen. server.js attaches socket.io.
// `ioRef` is a mutable holder so req.io resolves lazily once the real io exists.
export default function createApp(ioRef = { io: null }) {
  const app = express();

  // Strip a trailing slash: browsers never send one in the Origin header, so a
  // trailing slash in CLIENT_ORIGIN would otherwise fail the exact-match check.
  const clientOrigin = process.env.CLIENT_ORIGIN?.replace(/\/+$/, "");
  app.use(
    cors({
      origin: clientOrigin,
      credentials: true,
    })
  );
  app.use(express.json());
  app.use(cookieParser());
  if (process.env.NODE_ENV !== "production") {
    app.use(morgan("dev"));
  }

  // Give controllers/validators access to socket.io for real-time emits.
  app.use((req, res, next) => {
    req.io = ioRef.io;
    next();
  });

  app.get("/api/health", (req, res) => res.json({ ok: true }));

  app.use("/api/auth", authRoutes);
  app.use("/api/families", verifyJwtCookie, familyRoutes);
  app.use("/api/users", verifyJwtCookie, userRoutes);

  app.use((req, res) => res.status(404).json({ error: "Not found" }));
  app.use(errorHandler);

  return app;
}