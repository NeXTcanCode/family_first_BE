// Wraps an async controller: catches rejections and forwards to the error handler.
export default function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}