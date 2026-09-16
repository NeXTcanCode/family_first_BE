import User from "../models/User.js";
import Family from "../models/Family.js";
import asyncHandler from "../utils/asyncHandler.js";
import { LOCATION_UPDATED } from "../sockets/events.js";
import { invalidateDigestCache } from "../ai/index.js";

export const lookupByEmail = asyncHandler(async (req, res) => {
  const user = await User.findOne({ email: req.query.email }).select(
    "_id firstName lastName"
  );
  if (!user) {
    return res.status(404).json({ error: "No user with that email" });
  }
  res.json({ user });
});

export const updateLocation = asyncHandler(async (req, res) => {
  const user = await User.findByIdAndUpdate(
    req.user.id,
    {
      lastLocation: { lat: req.body.lat, lng: req.body.lng },
      locationUpdatedAt: new Date(),
    },
    { new: true }
  );
  const payload = {
    userId: user._id,
    firstName: user.firstName,
    lastName: user.lastName,
    lastLocation: user.lastLocation,
    locationUpdatedAt: user.locationUpdatedAt,
  };
  const families = await Family.find({ members: req.user.id }).select("_id");
  if (req.io) {
    const rooms = families.map((f) => `family:${f._id}`);
    req.io.to(rooms).emit(LOCATION_UPDATED, payload);
  }
  families.forEach((f) => invalidateDigestCache(f._id.toString()));
  res.json({ user });
});

export const updateSavedAddresses = asyncHandler(async (req, res) => {
  const update = {};
  if (req.body.home) update.homeAddress = req.body.home;
  if (req.body.office) update.officeAddress = req.body.office;

  const user = await User.findByIdAndUpdate(req.user.id, update, { new: true });

  const families = await Family.find({ members: req.user.id }).select("_id");
  families.forEach((f) => invalidateDigestCache(f._id.toString()));

  res.json({ homeAddress: user.homeAddress, officeAddress: user.officeAddress });
});