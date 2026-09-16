import { query, body } from "express-validator";

export const lookupValidations = [
  query("email").isEmail().withMessage("A valid email is required"),
];

export const updateLocationValidations = [
  body("lat").isFloat({ min: -90, max: 90 }).withMessage("Invalid latitude"),
  body("lng").isFloat({ min: -180, max: 180 }).withMessage("Invalid longitude"),
];

export const savedAddressValidations = [
  body("home.lat").optional().isFloat({ min: -90, max: 90 }).withMessage("Invalid home latitude"),
  body("home.lng").optional().isFloat({ min: -180, max: 180 }).withMessage("Invalid home longitude"),
  body("office.lat").optional().isFloat({ min: -90, max: 90 }).withMessage("Invalid office latitude"),
  body("office.lng").optional().isFloat({ min: -180, max: 180 }).withMessage("Invalid office longitude"),
];