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
    joinRequests: [
      {
        user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
        // "request" = the user asked to join; "accept/reject" is the creator's call.
        // "invite" = the creator invited this user; "accept/reject" is the user's call.
        type: { type: String, enum: ["request", "invite"], default: "request" },
        status: {
          type: String,
          enum: ["pending", "accepted", "rejected"],
          default: "pending",
        },
        requestedAt: { type: Date, default: Date.now },
      },
    ],
  },
  { timestamps: true }
);

export const MAX_FAMILY_MEMBERS = 4;

export default mongoose.model("Family", familySchema);