// Centralized error -> consistent JSON shape.
export default function errorHandler(err, req, res, next) {
  // Mongoose duplicate key (e.g. unique email).
  if (err?.code === 11000) {
    const field = Object.keys(err.keyValue || {})[0] || "field";
    return res.status(409).json({ error: `${field} already in use` });
  }
  if (err?.name === "ValidationError") {
    const field = Object.keys(err.errors || {})[0];
    return res
      .status(400)
      .json({ error: err.errors[field]?.message || "Validation failed" });
  }
  if (err?.name === "CastError") {
    return res.status(400).json({ error: "Invalid id" });
  }
  const status = err?.status || 500;
  return res
    .status(status)
    .json({ error: err?.message || "Internal server error" });
}