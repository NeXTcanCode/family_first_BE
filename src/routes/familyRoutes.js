import { Router } from "express";
import * as c from "../controllers/familyController.js";
import {
  createFamilyValidations,
  addMemberValidations,
  updateFamilyValidations,
} from "../validators/familyValidators.js";
import validate from "../middleware/validate.js";

const router = Router();

router.post("/", validate(createFamilyValidations), c.createFamily);
router.get("/", c.getMyFamilies);
router.get("/:id", c.getFamily);
router.get("/:id/digest", c.getFamilyDigest);
router.patch("/:id", validate(updateFamilyValidations), c.updateFamily);
router.delete("/:id", c.deleteFamily);
router.post("/:id/members", validate(addMemberValidations), c.addMember);
router.delete("/:id/members/:userId", c.removeMember);

export default router;