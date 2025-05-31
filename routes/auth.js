const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const router = express.Router();

// سر التوقيع في متغير بيئي (env)
const JWT_SECRET = process.env.JWT_SECRET || "your_jwt_secret_here";

// بيانات المستخدمين المشفّرة والمحددة مسبقًا
const users = [
  { username: "ali.khlaf", password: "$2a$10$DYl65MSxxY2AG.n5QzyuGuLObe8wCdpqL2cJrJS.d1Gpm0YuhGL0q", role: "manager" },
  { username: "ahmed.Ibrahim", password: "$2a$10$G25qYyKrZ6SCvHMcwcoMKuXucMWEFkVGVKGE7/P5iKZ2zWaERAw6S", role: "supervisor" },
  { username: "Ibrahim.ahmed", password: "$2a$10$G25qYyKrZ6SCvHMcwcoMKuXucMWEFkVGVKGE7/P5iKZ2zWaERAw6S", role: "supervisor" },
  { username: "Ali.Adham", password: "$2a$10$G25qYyKrZ6SCvHMcwcoMKuXucMWEFkVGVKGE7/P5iKZ2zWaERAw6S", role: "supervisor" },
  { username: "AbuFatema", password: "$2a$10$G25qYyKrZ6SCvHMcwcoMKuXucMWEFkVGVKGE7/P5iKZ2zWaERAw6S", role: "supervisor" },
  { username: "ahmed.hazem", password: "$2a$10$G25qYyKrZ6SCvHMcwcoMKuXucMWEFkVGVKGE7/P5iKZ2zWaERAw6S", role: "supervisor" }
];

// مسار تسجيل الدخول
router.post("/login", (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ message: "جميع الحقول مطلوبة" });
  }

  const user = users.find(u => u.username === username);
  if (!user) {
    return res.status(401).json({ message: "❌ اسم المستخدم غير صحيح" });
  }

  bcrypt.compare(password, user.password, (err, isMatch) => {
    if (err) {
      console.error("bcrypt error:", err);
      return res.status(500).json({ message: "حدث خطأ في السيرفر" });
    }
    if (!isMatch) {
      return res.status(401).json({ message: "❌ كلمة السر غير صحيحة" });
    }

    // توليد التوكن مع بيانات المستخدم
    const token = jwt.sign(
      { username: user.username, role: user.role },
      JWT_SECRET,
      { expiresIn: "8h" }
    );

    res.json({ token, role: user.role });
  });
});

module.exports = router;
