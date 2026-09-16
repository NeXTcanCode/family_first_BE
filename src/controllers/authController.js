import bcrypt from "bcryptjs";
import User from "../models/User.js";
import { signToken, cookieOptions } from "../utils/jwt.js";
import asyncHandler from "../utils/asyncHandler.js";

function publicUser(user) {
  return {
    id: user._id,
    firstName: user.firstName,
    middleName: user.middleName,
    lastName: user.lastName,
    email: user.email,
    homeAddress: user.homeAddress,
    officeAddress: user.officeAddress,
  };
}

export const signup = asyncHandler(async (req, res) => {
  const { firstName, middleName, lastName, email, password } = req.body;
  const passwordHash = await bcrypt.hash(password, 10);
  const user = await User.create({
    firstName,
    middleName,
    lastName,
    email,
    passwordHash,
  });
  const token = signToken(user._id);
  res.cookie("token", token, cookieOptions());
  res.status(201).json({ user: publicUser(user) });
});

export const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  const user = await User.findOne({ email });
  if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
    return res.status(401).json({ error: "Invalid email or password" });
  }
  const token = signToken(user._id);
  res.cookie("token", token, cookieOptions());
  res.json({ user: publicUser(user) });
});

export const logout = (req, res) => {
  res.cookie("token", "", { ...cookieOptions(), maxAge: 0 });
  res.json({ ok: true });
};

export const me = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user.id);
  if (!user) {
    return res.status(404).json({ error: "User not found" });
  }
  res.json({ user: publicUser(user) });
});