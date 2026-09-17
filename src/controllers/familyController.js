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
  JOIN_REQUESTED,
  JOIN_REJECTED,
  INVITE_RECEIVED,
  INVITE_REJECTED,
} from "../sockets/events.js";
import { matchNearestPlace, generateDigest, getCached, setCached } from "../ai/index.js";

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

export const getFamilyDigest = asyncHandler(async (req, res) => {
  const family = await Family.findById(req.params.id).populate(
    "members",
    "firstName lastLocation locationUpdatedAt homeAddress officeAddress"
  );
  if (!family) {
    return res.status(404).json({ error: "Family not found" });
  }
  if (!family.members.some((m) => m._id.toString() === req.user.id)) {
    return res.status(403).json({ error: "Not a member of this family" });
  }

  const facts = family.members.map((m) => {
    const { place, distanceM, arrived } = matchNearestPlace(m.lastLocation, {
      homeAddress: m.homeAddress,
      officeAddress: m.officeAddress,
    });
    const minutesAgo = m.locationUpdatedAt
      ? Math.round((Date.now() - new Date(m.locationUpdatedAt).getTime()) / 60000)
      : null;
    return {
      firstName: m.firstName,
      place,
      arrived,
      // Omit distance once arrived — sending it anyway invites weaker models
      // to redundantly repeat both ("at Home, 8 meters from Home").
      distanceMeters: arrived ? null : distanceM,
      minutesAgo,
      isViewer: m._id.toString() === req.user.id,
    };
  });

  const cached = getCached(family._id.toString(), req.user.id, facts);
  if (cached) {
    return res.json({ digest: cached.digestText, computedAt: cached.computedAt, facts });
  }

  const digest = await generateDigest(facts);
  const entry = setCached(family._id.toString(), req.user.id, facts, digest);
  res.json({ digest: entry.digestText, computedAt: entry.computedAt, facts });
});

export const requestToJoin = asyncHandler(async (req, res) => {
  const family = await Family.findById(req.params.id);
  if (!family) {
    return res.status(404).json({ error: "Family not found" });
  }
  if (family.members.some((m) => m.toString() === req.user.id)) {
    return res.status(400).json({ error: "You are already a member of this family" });
  }

  const existing = family.joinRequests.find((r) => r.user.toString() === req.user.id);
  if (existing) {
    existing.type = "request";
    existing.status = "pending";
    existing.requestedAt = new Date();
  } else {
    family.joinRequests.push({ user: req.user.id, type: "request" });
  }
  await family.save();

  if (req.io) {
    req.io.to(`user:${family.creator}`).emit(JOIN_REQUESTED, {
      familyId: family._id,
      familyName: family.name,
      userId: req.user.id,
    });
  }
  res.status(201).json({ success: true });
});

export const getJoinRequests = asyncHandler(async (req, res) => {
  const family = await Family.findById(req.params.id).populate(
    "joinRequests.user",
    "firstName lastName email"
  );
  if (!family) {
    return res.status(404).json({ error: "Family not found" });
  }
  if (family.creator.toString() !== req.user.id) {
    return res.status(403).json({ error: "Only the creator can view join requests" });
  }
  const pending = family.joinRequests.filter(
    (r) => r.status === "pending" && r.type === "request"
  );
  res.json({ joinRequests: pending });
});

export const acceptJoinRequest = asyncHandler(async (req, res) => {
  const family = await Family.findById(req.params.id);
  if (!family) {
    return res.status(404).json({ error: "Family not found" });
  }
  if (family.creator.toString() !== req.user.id) {
    return res.status(403).json({ error: "Only the creator can accept join requests" });
  }
  const request = family.joinRequests.find(
    (r) =>
      r.user.toString() === req.params.userId && r.status === "pending" && r.type === "request"
  );
  if (!request) {
    return res.status(404).json({ error: "No pending join request from this user" });
  }
  if (family.members.length >= MAX_FAMILY_MEMBERS) {
    return res
      .status(400)
      .json({ error: `Family already has the max of ${MAX_FAMILY_MEMBERS} members` });
  }

  request.status = "accepted";
  family.members.push(request.user);
  await family.save();
  await family.populate("members", "firstName lastName lastLocation locationUpdatedAt");

  const target = family.members.find((m) => m._id.toString() === req.params.userId);
  const member = { id: target._id, firstName: target.firstName, lastName: target.lastName };
  if (req.io) {
    req.io.to(`family:${family._id}`).emit(MEMBER_ADDED, { familyId: family._id, member });
    req.io.to(`user:${target._id}`).emit(MEMBER_ADDED, { familyId: family._id, member });
  }
  res.json({ family, member });
});

export const rejectJoinRequest = asyncHandler(async (req, res) => {
  const family = await Family.findById(req.params.id);
  if (!family) {
    return res.status(404).json({ error: "Family not found" });
  }
  if (family.creator.toString() !== req.user.id) {
    return res.status(403).json({ error: "Only the creator can reject join requests" });
  }
  const request = family.joinRequests.find(
    (r) =>
      r.user.toString() === req.params.userId && r.status === "pending" && r.type === "request"
  );
  if (!request) {
    return res.status(404).json({ error: "No pending join request from this user" });
  }
  request.status = "rejected";
  await family.save();

  if (req.io) {
    req.io.to(`user:${req.params.userId}`).emit(JOIN_REJECTED, {
      familyId: family._id,
      familyName: family.name,
    });
  }
  res.json({ success: true });
});

export const inviteMember = asyncHandler(async (req, res) => {
  const family = await Family.findById(req.params.id);
  if (!family) {
    return res.status(404).json({ error: "Family not found" });
  }
  if (family.creator.toString() !== req.user.id) {
    return res.status(403).json({ error: "Only the creator can invite members" });
  }
  const target = await User.findOne({ email: req.body.email });
  if (!target) {
    return res.status(404).json({ error: "No user with that email" });
  }
  if (family.members.some((m) => m.toString() === target._id.toString())) {
    return res.status(400).json({ error: "User is already a member" });
  }

  const existing = family.joinRequests.find((r) => r.user.toString() === target._id.toString());
  if (existing) {
    // Re-invite after a rejection (or resend a still-pending one) — always allowed.
    existing.type = "invite";
    existing.status = "pending";
    existing.requestedAt = new Date();
  } else {
    family.joinRequests.push({ user: target._id, type: "invite" });
  }
  await family.save();

  if (req.io) {
    req.io.to(`user:${target._id}`).emit(INVITE_RECEIVED, {
      familyId: family._id,
      familyName: family.name,
    });
  }
  res.status(201).json({ success: true });
});

export const getMyInvites = asyncHandler(async (req, res) => {
  const families = await Family.find({
    joinRequests: { $elemMatch: { user: req.user.id, type: "invite", status: "pending" } },
  })
    .select("name creator joinRequests")
    .populate("creator", "firstName lastName");

  const invites = families.map((f) => {
    const entry = f.joinRequests.find(
      (r) => r.user.toString() === req.user.id && r.type === "invite" && r.status === "pending"
    );
    return {
      familyId: f._id,
      familyName: f.name,
      creator: { firstName: f.creator.firstName, lastName: f.creator.lastName },
      requestedAt: entry.requestedAt,
    };
  });
  res.json({ invites });
});

export const acceptInvite = asyncHandler(async (req, res) => {
  const family = await Family.findById(req.params.id);
  if (!family) {
    return res.status(404).json({ error: "Family not found" });
  }
  const invite = family.joinRequests.find(
    (r) => r.user.toString() === req.user.id && r.type === "invite" && r.status === "pending"
  );
  if (!invite) {
    return res.status(404).json({ error: "No pending invite for you in this family" });
  }
  if (family.members.length >= MAX_FAMILY_MEMBERS) {
    return res
      .status(400)
      .json({ error: `Family already has the max of ${MAX_FAMILY_MEMBERS} members` });
  }

  invite.status = "accepted";
  family.members.push(req.user.id);
  await family.save();
  await family.populate("members", "firstName lastName lastLocation locationUpdatedAt");

  const target = family.members.find((m) => m._id.toString() === req.user.id);
  const member = { id: target._id, firstName: target.firstName, lastName: target.lastName };
  if (req.io) {
    req.io.to(`family:${family._id}`).emit(MEMBER_ADDED, { familyId: family._id, member });
    req.io.to(`user:${target._id}`).emit(MEMBER_ADDED, { familyId: family._id, member });
  }
  res.json({ family, member });
});

export const rejectInvite = asyncHandler(async (req, res) => {
  const family = await Family.findById(req.params.id);
  if (!family) {
    return res.status(404).json({ error: "Family not found" });
  }
  const invite = family.joinRequests.find(
    (r) => r.user.toString() === req.user.id && r.type === "invite" && r.status === "pending"
  );
  if (!invite) {
    return res.status(404).json({ error: "No pending invite for you in this family" });
  }
  invite.status = "rejected";
  await family.save();

  if (req.io) {
    req.io.to(`user:${family.creator}`).emit(INVITE_REJECTED, {
      familyId: family._id,
      familyName: family.name,
      userId: req.user.id,
    });
  }
  res.json({ success: true });
});

export const leaveFamily = asyncHandler(async (req, res) => {
  const family = await Family.findById(req.params.id);
  if (!family) {
    return res.status(404).json({ error: "Family not found" });
  }
  if (family.creator.toString() === req.user.id) {
    return res
      .status(400)
      .json({ error: "Creator cannot leave — delete the family instead" });
  }
  if (!family.members.some((m) => m.toString() === req.user.id)) {
    return res.status(400).json({ error: "You are not a member of this family" });
  }
  family.members = family.members.filter((m) => m.toString() !== req.user.id);
  await family.save();
  await family.populate("members", "firstName lastName lastLocation locationUpdatedAt");

  if (req.io) {
    req.io
      .to(`family:${family._id}`)
      .emit(MEMBER_REMOVED, { familyId: family._id, userId: req.user.id });
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