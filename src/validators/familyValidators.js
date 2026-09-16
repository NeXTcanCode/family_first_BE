import { body } from "express-validator";

export const createFamilyValidations = [
  body("name").trim().notEmpty().withMessage("Family name is required"),
];

export const addMemberValidations = [
  body("email").isEmail().withMessage("A valid email is required"),
];

export const updateFamilyValidations = [
  body("name").trim().notEmpty().withMessage("Family name is required"),
];