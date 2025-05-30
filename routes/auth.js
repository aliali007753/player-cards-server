const express = require("express");
const router = express.Router();

// قائمة المستخدمين المسموح لهم فقط (مدير ومشرفين)
const users = [
  { username: "ali.khlaf", password: "ali00774411", role: "admin" },
  { username: "ahmed.Ibrahim", password: "aa00774411", role: "moderator" },
  { username: "Ibrahim.ahmed", password: "aa00774411", role: "moderator" },
  { username: "Ali.Adham", password: "aa00774411", role: "moderator" },
  { username: "AbuFatema", password: "aa00774411", role: "moderator" },
  { username: "ahmed.hazem", password: "aa00774411", role: "moderator" } // ✅ المشرف الجديد
];

// مسار تسجيل الدخول
router.post("/login", (req, res) => {
  const { username, password } = req.body;

  const user = users.find(
    (u) => u.username === username && u.password === password
  );

  if (!user) {
    return res.status(401).json({ message: "❌ فشل تسجيل الدخول: بيانات غير صحيحة" });
  }

  // توكن وهمي (بمكانه لاحقاً نضيف JWT إذا تحب)
  const token = "mock-token-for-" + user.username;

  res.json({ token, role: user.role });
});

module.exports = router;
