import { Router } from "express";
import * as c from "../controllers/userController.js";
import { lookupValidations, updateLocationValidations } from "../validators/userValidators.js";
import validate from "../middleware/validate.js";

const router = Router();

router.get("/lookup", validate(lookupValidations), c.lookupByEmail);
router.patch("/me/location", validate(updateLocationValidations), c.updateLocation);

export default router;