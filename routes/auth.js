const express = require("express");
const bcrypt = require("bcryptjs");
const router = express.Router();

// كلمات السر مشفّرة مسبقًا وثابتة ✅
const users = [
  { username: "ali.khlaf", password: "$2a$10$DYl65MSxxY2AG.n5QzyuGuLObe8wCdpqL2cJrJS.d1Gpm0YuhGL0q", role: "admin" },
  { username: "ahmed.Ibrahim", password: "$2a$10$G25qYyKrZ6SCvHMcwcoMKuXucMWEFkVGVKGE7/P5iKZ2zWaERAw6S", role: "moderator" },
  { username: "Ibrahim.ahmed", password: "$2a$10$G25qYyKrZ6SCvHMcwcoMKuXucMWEFkVGVKGE7/P5iKZ2zWaERAw6S", role: "moderator" },
  { username: "Ali.Adham", password: "$2a$10$G25qYyKrZ6SCvHMcwcoMKuXucMWEFkVGVKGE7/P5iKZ2zWaERAw6S", role: "moderator" },
  { username: "AbuFatema", password: "$2a$10$G25qYyKrZ6SCvHMcwcoMKuXucMWEFkVGVKGE7/P5iKZ2zWaERAw6S", role: "moderator" },
  { username: "ahmed.hazem", password: "$2a$10$G25qYyKrZ6SCvHMcwcoMKuXucMWEFkVGVKGE7/P5iKZ2zWaERAw6S", role: "moderator" }
];

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
