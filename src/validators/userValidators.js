import { query, body } from "express-validator";

export const lookupValidations = [
  query("email").isEmail().withMessage("A valid email is required"),
];

export const updateLocationValidations = [
  body("lat").isFloat({ min: -90, max: 90 }).withMessage("Invalid latitude"),
  body("lng").isFloat({ min: -180, max: 180 }).withMessage("Invalid longitude"),
];