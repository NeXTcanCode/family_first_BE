import Family from "../models/Family.js";
import { MAX_FAMILY_MEMBERS } from "../models/Family.js";
import User from "../models/User.js";
import asyncHandler from "../utils/asyncHandler.js";
import {
  MEMBER_ADDED,
  MEMBER_REMOVED,
  FAMILY_CREATED,
  FAMILY_UPDATED,
  FAMILY_DELETED,
} from "../sockets/events.js";

export const createFamily = asyncHandler(async (req, res) => {
  const family = await Family.create({
    name: req.body.name,
    creator: req.user.id,
    members: [req.user.id],
  });
  await family.populate("members", "firstName lastName");
  if (req.io) {
    req.io.to(`user:${req.user.id}`).emit(FAMILY_CREATED, { family });
  }
  res.status(201).json({ family });
});

export const getMyFamilies = asyncHandler(async (req, res) => {
  const families = await Family.find({ members: req.user.id }).populate(
    "members",
    "firstName lastName lastLocation locationUpdatedAt"
  );
  res.json({ families });
});

export const getFamily = asyncHandler(async (req, res) => {
  const family = await Family.findById(req.params.id).populate(
    "members",
    "firstName lastName lastLocation locationUpdatedAt"
  );
  if (!family) {
    return res.status(404).json({ error: "Family not found" });
  }
  if (!family.members.some((m) => m._id.toString() === req.user.id)) {
    return res.status(403).json({ error: "Not a member of this family" });
  }
  res.json({ family });
});

export const addMember = asyncHandler(async (req, res) => {
  const family = await Family.findById(req.params.id);
  if (!family) {
    return res.status(404).json({ error: "Family not found" });
  }
  if (family.creator.toString() !== req.user.id) {
    return res.status(403).json({ error: "Only the creator can add members" });
  }
  if (family.members.length >= MAX_FAMILY_MEMBERS) {
    return res
      .status(400)
      .json({ error: `Family already has the max of ${MAX_FAMILY_MEMBERS} members` });
  }
  const target = await User.findOne({ email: req.body.email });
  if (!target) {
    return res.status(404).json({ error: "No user with that email" });
  }
  if (family.members.some((m) => m.toString() === target._id.toString())) {
    return res.status(400).json({ error: "User is already a member" });
  }
  family.members.push(target._id);
  await family.save();
  await family.populate("members", "firstName lastName lastLocation locationUpdatedAt");

  const member = {
    id: target._id,
    firstName: target.firstName,
    lastName: target.lastName,
  };
  if (req.io) {
    req.io.to(`family:${family._id}`).emit(MEMBER_ADDED, { familyId: family._id, member });
    req.io.to(`user:${target._id}`).emit(MEMBER_ADDED, {
      familyId: family._id,
      member,
    });
  }
  res.status(201).json({ family, member });
});

export const removeMember = asyncHandler(async (req, res) => {
  const family = await Family.findById(req.params.id);
  if (!family) {
    return res.status(404).json({ error: "Family not found" });
  }
  if (family.creator.toString() !== req.user.id) {
    return res.status(403).json({ error: "Only the creator can remove members" });
  }
  const { userId } = req.params;
  if (userId === family.creator.toString()) {
    return res.status(400).json({ error: "Creator cannot remove themselves" });
  }
  if (!family.members.some((m) => m.toString() === userId)) {
    return res.status(404).json({ error: "User is not a member of this family" });
  }
  family.members = family.members.filter((m) => m.toString() !== userId);
  await family.save();
  await family.populate("members", "firstName lastName lastLocation locationUpdatedAt");

  if (req.io) {
    req.io.to(`family:${family._id}`).emit(MEMBER_REMOVED, { familyId: family._id, userId });
    req.io.to(`user:${userId}`).emit(MEMBER_REMOVED, { familyId: family._id, userId });
  }
  res.json({ family });
});

export const updateFamily = asyncHandler(async (req, res) => {
  const family = await Family.findById(req.params.id);
  if (!family) {
    return res.status(404).json({ error: "Family not found" });
  }
  if (family.creator.toString() !== req.user.id) {
    return res.status(403).json({ error: "Only the creator can rename this family" });
  }
  family.name = req.body.name;
  await family.save();
  await family.populate("members", "firstName lastName lastLocation locationUpdatedAt");

  if (req.io) {
    req.io.to(`family:${family._id}`).emit(FAMILY_UPDATED, { family });
  }
  res.json({ family });
});

export const deleteFamily = asyncHandler(async (req, res) => {
  const family = await Family.findById(req.params.id);
  if (!family) {
    return res.status(404).json({ error: "Family not found" });
  }
  if (family.creator.toString() !== req.user.id) {
    return res.status(403).json({ error: "Only the creator can delete this family" });
  }
  const memberIds = family.members.map((m) => m.toString());
  await family.deleteOne();

  if (req.io) {
    req.io.to(`family:${family._id}`).emit(FAMILY_DELETED, { familyId: family._id });
    memberIds.forEach((userId) => {
      req.io.to(`user:${userId}`).emit(FAMILY_DELETED, { familyId: family._id });
    });
  }
  res.json({ success: true });
});