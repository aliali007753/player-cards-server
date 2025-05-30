const express = require("express");
const bcrypt = require("bcryptjs");
const router = express.Router();

// كلمات السر المشفّرة مسبقًا
const users = [
  { username: "ali.khlaf", password: bcrypt.hashSync("ali00774411", 10), role: "admin" },
  { username: "ahmed.Ibrahim", password: bcrypt.hashSync("aa00774411", 10), role: "moderator" },
  { username: "Ibrahim.ahmed", password: bcrypt.hashSync("aa00774411", 10), role: "moderator" },
  { username: "Ali.Adham", password: bcrypt.hashSync("aa00774411", 10), role: "moderator" },
  { username: "AbuFatema", password: bcrypt.hashSync("aa00774411", 10), role: "moderator" },
  { username: "ahmed.hazem", password: bcrypt.hashSync("aa00774411", 10), role: "moderator" }
];

// مسار تسجيل الدخول
router.post("/login", (req, res) => {
  const { username, password } = req.body;
  const user = users.find((u) => u.username === username);

  if (!user) return res.status(401).json({ message: "❌ اسم المستخدم غير صحيح" });

  const isMatch = bcrypt.compareSync(password, user.password);
  if (!isMatch) return res.status(401).json({ message: "❌ كلمة السر غير صحيحة" });

  const token = "mock-token-for-" + user.username;
  res.json({ token, role: user.role });
});

module.exports = router;
