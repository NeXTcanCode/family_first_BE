import { Router } from "express";
import * as c from "../controllers/userController.js";
import {
  lookupValidations,
  updateLocationValidations,
  savedAddressValidations,
} from "../validators/userValidators.js";
import validate from "../middleware/validate.js";

const router = Router();

router.get("/lookup", validate(lookupValidations), c.lookupByEmail);
router.patch("/me/location", validate(updateLocationValidations), c.updateLocation);
router.patch("/me/addresses", validate(savedAddressValidations), c.updateSavedAddresses);

export default router;