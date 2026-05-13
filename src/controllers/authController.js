import User from "../models/User.js";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

export const adminLogin = async (req, res) => {
  try {
    console.log("REQ BODY:", req.body);

    const { email, password } = req.body;

    const user = await User.findOne({ email });

    console.log("FOUND USER:", user);

    if (!user) {
      console.log("❌ USER NOT FOUND");
      return res.status(400).json({ error: "Invalid email or password" });
    }

    const isMatch = await bcrypt.compare(password, user.password);

    console.log("PASSWORD MATCH:", isMatch);

    if (!isMatch) {
      console.log("❌ PASSWORD WRONG");
      return res.status(400).json({ error: "Invalid email or password" });
    }

    return res.json({ message: "OK" });

  } catch (err) {
    console.log(err);
    res.status(500).json({ error: "Server error" });
  }
};