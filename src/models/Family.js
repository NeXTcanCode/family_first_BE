import mongoose from "mongoose";

const familySchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    creator: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    members: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
  },
  { timestamps: true }
);

export const MAX_FAMILY_MEMBERS = 4;

export default mongoose.model("Family", familySchema);