import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    firstName: { type: String, required: true, trim: true },
    middleName: { type: String, trim: true },
    lastName: { type: String, required: true, trim: true },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    passwordHash: { type: String, required: true },
    lastLocation: {
      lat: { type: Number },
      lng: { type: Number },
      _id: false,
    },
    locationUpdatedAt: { type: Date },
  },
  { timestamps: true }
);

export default mongoose.model("User", userSchema);