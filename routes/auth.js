const express = require("express");
const bcrypt = require("bcryptjs");
const router = express.Router();

// قائمة المستخدمين مع كلمات سر مشفرة مسبقاً (باستخدام bcryptjs)
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

  if (!user) {
    return res.status(401).json({ message: "❌ فشل تسجيل الدخول: المستخدم غير موجود" });
  }

  // تحقق من كلمة السر المشفرة
  const isMatch = bcrypt.compareSync(password, user.password);

  if (!isMatch) {
    return res.status(401).json({ message: "❌ فشل تسجيل الدخول: كلمة السر غير صحيحة" });
  }

  // توكن وهمي
  const token = "mock-token-for-" + user.username;

  res.json({ token, role: user.role });
});

module.exports = router;
