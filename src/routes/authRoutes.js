import { Router } from "express";
import * as c from "../controllers/authController.js";
import { signupValidations, loginValidations } from "../validators/authValidators.js";
import validate from "../middleware/validate.js";
import { verifyJwtCookie } from "../middleware/auth.js";

const router = Router();

router.post("/signup", validate(signupValidations), c.signup);
router.post("/login", validate(loginValidations), c.login);
router.post("/logout", c.logout);
router.get("/me", verifyJwtCookie, c.me);

export default router;