// Wraps an express-validator chain; runs validation and surfaces the first error.
import { validationResult } from "express-validator";

export default function validate(validations) {
  return async (req, res, next) => {
    for (const validation of validations) {
      const result = await validation.run(req);
      if (!result.isEmpty()) {
        const msg = result.array()[0].msg;
        return res.status(400).json({ error: msg });
      }
    }
    return next();
  };
}