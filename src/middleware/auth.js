import jwt from "jsonwebtoken";

// Reads req.cookies.token, verifies, attaches req.user = { id }.
// Intended to run before protected routes.
export function verifyJwtCookie(req, res, next) {
  const token = req.cookies?.token;
  if (!token) {
    return res.status(401).json({ error: "Not authenticated" });
  }
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.user = { id: payload.userId };
    return next();
  } catch {
    return res.status(401).json({ error: "Invalid or expired session" });
  }
}