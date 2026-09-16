import jwt from "jsonwebtoken";

export function signToken(userId) {
  return jwt.sign({ userId }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || "7d",
  });
}

export function verifyToken(token) {
  return jwt.verify(token, process.env.JWT_SECRET);
}

export function cookieOptions() {
  // Localhost dev: FE/BE same-site -> Lax. Any deploy (Render FE subdomain -> Render BE, or localhost FE -> Render BE) is cross-site -> None+Secure or the browser drops the cookie.
  const sameSite = process.env.NODE_ENV === "production" ? "none" : "lax";
  return {
    httpOnly: true,
    sameSite,
    secure: sameSite === "none", // SameSite=None requires Secure
    maxAge: 7 * 24 * 60 * 60 * 1000, // matches default JWT expiry (Express maxAge is in ms)
  };
}