// ==== المتطلبات الأساسية ====
const express = require('express');
const cors = require('cors');
const multer = require('multer');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { MongoClient, ObjectId } = require('mongodb');
const cloudinary = require('cloudinary').v2;
require('dotenv').config();

const app = express();
const port = process.env.PORT || 4000;
const uri = process.env.MONGODB_URI;
const JWT_SECRET = process.env.JWT_SECRET;
const ADMIN_KEY = process.env.ADMIN_KEY;

// ==== إعداد Cloudinary ====
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// ==== إعداد CORS ====
const allowedOrigins = ['https://alshorasports.netlify.app'];
app.use(cors({
  origin: function (origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) callback(null, true);
    else callback(new Error('Not allowed by CORS'));
  },
  credentials: true
}));

app.use(express.json());
const storage = multer.memoryStorage();
const upload = multer({ storage });

// ==== التوكن للتحقق ====
function authMiddleware(role = null) {
  return async (req, res, next) => {
    try {
      const token = req.headers.authorization?.split(' ')[1];
      if (!token) return res.status(401).json({ message: 'غير مصرح' });
      const payload = jwt.verify(token, JWT_SECRET);
      req.user = payload;
      if (role && payload.role !== role && payload.role !== 'manager') {
        return res.status(403).json({ message: 'ليس لديك صلاحية' });
      }
      next();
    } catch {
      res.status(401).json({ message: 'توكن غير صالح' });
    }
  };
}

async function run() {
  const client = new MongoClient(uri);
  await client.connect();
  console.log('✅ Connected to MongoDB');

  const db = client.db('mydatabase');
  const users = db.collection('users');
  const players = db.collection('players');
  const votes = db.collection('votes');
  const voteSessions = db.collection('vote_sessions');
  const voteEnd = db.collection('vote_end_time');

  // ==== إنشاء حساب مدير افتراضي ====
  const existing = await users.findOne({ username: 'admin' });
  if (!existing) {
    const hashed = await bcrypt.hash('admin123', 10);
    await users.insertOne({
      username: 'admin',
      password: hashed,
      role: 'manager',
      blocked: false,
      uploadCount: 0,
      createdAt: new Date()
    });
    console.log('🧪 تم إنشاء مدير افتراضي');
  }

  // ==== تسجيل الدخول ====
  app.post('/api/login', async (req, res) => {
    try {
      const { username, password } = req.body;
      const user = await users.findOne({ username });
      if (!user) return res.status(401).json({ message: 'اسم المستخدم أو كلمة المرور غير صحيح' });
      const valid = await bcrypt.compare(password, user.password);
      if (!valid) return res.status(401).json({ message: 'كلمة المرور غير صحيحة' });
      if (user.blocked) return res.status(403).json({ message: 'الحساب محظور' });

      const token = jwt.sign({ userId: user._id, username, role: user.role }, JWT_SECRET, { expiresIn: '8h' });
      res.json({ token, role: user.role, username });
    } catch {
      res.status(500).json({ message: 'خطأ في تسجيل الدخول' });
    }
  });

  // ==== إضافة لاعب مع صورة ====
  app.post('/api/players', authMiddleware(), upload.single('image'), async (req, res) => {
    try {
      const { name, bio } = req.body;
      const username = req.user.username;
      if (!name || !bio || !req.file) return res.status(400).json({ message: 'جميع الحقول مطلوبة' });

      const result = await new Promise((resolve, reject) => {
        cloudinary.uploader.upload_stream({ folder: 'players' }, (err, result) => {
          if (err) return reject(err);
          resolve(result);
        }).end(req.file.buffer);
      });

      const player = {
        name,
        bio,
        image: result.secure_url,
        views: 0,
        votes: 0,
        createdBy: username,
        createdAt: new Date(),
        expireAt: new Date(Date.now() + 48 * 60 * 60 * 1000)
      };

      await players.insertOne(player);
      await users.updateOne({ username }, { $inc: { uploadCount: 1 } });

      res.status(201).json({ message: 'تمت الإضافة' });
    } catch {
      res.status(500).json({ message: 'فشل رفع الصورة أو حفظ البيانات' });
    }
  });

  // ==== عرض اللاعبين ====
  app.get('/api/players', async (req, res) => {
    try {
      const now = new Date();
      const result = await players.find({ expireAt: { $gt: now } }).sort({ createdAt: -1 }).toArray();
      res.json(result);
    } catch {
      res.status(500).json({ message: 'خطأ في جلب اللاعبين' });
    }
  });

  // ==== زيادة المشاهدات ====
  app.post('/api/players/:id/view', async (req, res) => {
    try {
      const playerId = new ObjectId(req.params.id);
      await players.updateOne({ _id: playerId }, { $inc: { views: 1 } });
      res.json({ message: 'تمت الزيادة' });
    } catch {
      res.status(500).json({ message: 'خطأ في زيادة المشاهدات' });
    }
  });

  // ==== التصويت: إضافة لاعب إلى التصويت ====
  app.post('/api/vote/add/:id', authMiddleware('manager'), async (req, res) => {
    try {
      const playerId = new ObjectId(req.params.id);
      const player = await players.findOne({ _id: playerId });
      if (!player) return res.status(404).json({ message: 'اللاعب غير موجود' });

      const exists = await votes.findOne({ playerId });
      if (exists) return res.status(409).json({ message: 'موجود بالفعل في التصويت' });

      await votes.insertOne({ playerId, votes: 0 });
      res.json({ message: 'تمت الإضافة إلى التصويت' });
    } catch {
      res.status(500).json({ message: 'خطأ في إضافة التصويت' });
    }
  });

  // ==== عرض قائمة التصويت ====
  app.get('/api/vote', async (req, res) => {
    try {
      const list = await votes.find().toArray();
      const result = await Promise.all(list.map(async (v) => {
        const p = await players.findOne({ _id: v.playerId });
        return { ...p, voteCount: v.votes };
      }));
      res.json(result);
    } catch {
      res.status(500).json({ message: 'خطأ في جلب التصويت' });
    }
  });

  // ==== التصويت من الزائر ====
  app.post('/api/vote/:id', async (req, res) => {
    try {
      const playerId = new ObjectId(req.params.id);
      const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;

      const existingVote = await voteSessions.findOne({ playerId, ip });
      if (existingVote) return res.status(400).json({ message: 'صوتت مسبقًا' });

      await votes.updateOne({ playerId }, { $inc: { votes: 1 } });
      await voteSessions.insertOne({ playerId, ip, votedAt: new Date() });

      res.json({ message: '✅ تم التصويت' });
    } catch {
      res.status(500).json({ message: 'خطأ في التصويت' });
    }
  });

  // ==== حذف لاعب من التصويت ====
  app.delete('/api/vote/:id', authMiddleware('manager'), async (req, res) => {
    try {
      const playerId = new ObjectId(req.params.id);
      await votes.deleteOne({ playerId });
      await voteSessions.deleteMany({ playerId });
      res.json({ message: 'تم الحذف من التصويت' });
    } catch {
      res.status(500).json({ message: 'خطأ في حذف التصويت' });
    }
  });

  // ==== زيادة التصويت يدويًا ====
  app.post('/api/vote/admin/:id', authMiddleware('manager'), async (req, res) => {
    try {
      const playerId = new ObjectId(req.params.id);
      await votes.updateOne({ playerId }, { $inc: { votes: 1 } });
      res.json({ message: 'تمت الزيادة اليدوية' });
    } catch {
      res.status(500).json({ message: 'خطأ في الزيادة اليدوية' });
    }
  });

  // ==== ✅ بدء التصويت وتحديد وقت النهاية مع طباعة الخطأ ====
  app.post('/api/vote/start', authMiddleware('manager'), async (req, res) => {
    try {
      const endDate = new Date(Date.now() + 24 * 60 * 60 * 1000);
      await voteEnd.updateOne(
        { _id: 'vote_end' },
        { $set: { endTime: endDate } },
        { upsert: true }
      );
      res.json({ message: 'تم بدء التصويت' });
    } catch (err) {
      console.error('خطأ في /api/vote/start:', err); // 🔍 هنا تطبع الخطأ في الكونسول
      res.status(500).json({ message: 'خطأ في التصويت' });
    }
  });

  // ==== جلب وقت انتهاء التصويت ====
  app.get('/api/vote/endtime', async (req, res) => {
    try {
      const doc = await voteEnd.findOne({ _id: 'vote_end' });
      res.json({ endTime: doc?.endTime || null });
    } catch {
      res.status(500).json({ message: 'خطأ في جلب وقت انتهاء التصويت' });
    }
  });

  // ==== بدء السيرفر ====
  app.listen(port, () => {
    console.log(`🚀 Server running on port ${port}`);
  });
}

run().catch(console.dir);
