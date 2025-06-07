const express = require('express');
const cors = require('cors');
const multer = require('multer');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { MongoClient, ObjectId } = require('mongodb');
const cloudinary = require('cloudinary').v2;
require('dotenv').config();

const app = express();
const port = process.env.PORT || 4000;  // دعم تشغيل على بيئات مختلفة
const uri = process.env.MONGODB_URI;
const JWT_SECRET = process.env.JWT_SECRET;
const ADMIN_KEY = process.env.ADMIN_KEY;

// إعداد Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// اسم موقعك على Netlify (لتعديل CORS)
const allowedOrigins = ['https://alshorasports.netlify.app'];

app.use(cors({
  origin: function (origin, callback) {
    // السماح بالطلبات بدون origin (مثل أدوات الاختبار)
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true
}));

app.use(express.json());

const storage = multer.memoryStorage();
const upload = multer({ storage });

function authMiddleware(role = null) {
  return async (req, res, next) => {
    try {
      const token = req.headers.authorization?.split(' ')[1];
      if (!token) return res.status(401).json({ message: 'غير مصرح' });
      const payload = jwt.verify(token, JWT_SECRET);
      req.user = payload;

      if (role && payload.role !== role && payload.role !== 'manager') {
        return res.status(403).json({ message: 'ليس لديك صلاحية الوصول' });
      }
      next();
    } catch (error) {
      res.status(401).json({ message: 'توكن غير صالح' });
    }
  };
}

async function run() {
  try {
    const client = new MongoClient(uri);
    await client.connect();
    console.log('✅ Connected to MongoDB');

    const db = client.db('mydatabase');
    const users = db.collection('users');
    const players = db.collection('players');

    // إنشاء مستخدم إداري تجريبي في حال عدم وجوده
    async function createTestUser() {
      const existing = await users.findOne({ username: 'admin' });
      if (existing) return;
      const hashedPass = await bcrypt.hash('admin123', 10);
      await users.insertOne({
        username: 'admin',
        password: hashedPass,
        role: 'manager',
        blocked: false,
        uploadCount: 0,
        createdAt: new Date()
      });
      console.log('تم إنشاء مستخدم تجريبي admin');
    }

    await createTestUser();

    app.post('/api/login', async (req, res) => {
      const { username, password } = req.body;
      const user = await users.findOne({ username });
      if (!user) return res.status(401).json({ message: 'خطأ في اسم المستخدم أو كلمة المرور' });

      const validPass = await bcrypt.compare(password, user.password);
      if (!validPass) return res.status(401).json({ message: 'كلمة المرور غير صحيحة' });

      if (user.blocked) return res.status(403).json({ message: 'الحساب محظور' });

      const token = jwt.sign({ userId: user._id, username: user.username, role: user.role }, JWT_SECRET, { expiresIn: '8h' });
      res.json({ token, role: user.role, username: user.username });
    });

    app.post('/api/users', authMiddleware('manager'), async (req, res) => {
      const { username, password, role } = req.body;
      if (!username || !password || !role) return res.status(400).json({ message: 'البيانات ناقصة' });

      const exists = await users.findOne({ username });
      if (exists) return res.status(409).json({ message: 'اسم المستخدم مستخدم' });

      const hashed = await bcrypt.hash(password, 10);
      await users.insertOne({ username, password: hashed, role, uploadCount: 0, blocked: false, createdAt: new Date() });
      res.status(201).json({ message: 'تم إنشاء المستخدم' });
    });

    app.get('/api/users', authMiddleware('manager'), async (req, res) => {
      const all = await users.find({ role: { $in: ['manager', 'supervisor'] } }, { projection: { password: 0 } }).toArray();
      res.json(all);
    });

    app.post('/api/users/:id/block', authMiddleware('manager'), async (req, res) => {
      await users.updateOne({ _id: new ObjectId(req.params.id) }, { $set: { blocked: true } });
      res.json({ message: 'تم الحظر' });
    });

    app.post('/api/users/:id/unblock', authMiddleware('manager'), async (req, res) => {
      await users.updateOne({ _id: new ObjectId(req.params.id) }, { $set: { blocked: false } });
      res.json({ message: 'تم فك الحظر' });
    });

    app.delete('/api/users/:id', authMiddleware('manager'), async (req, res) => {
      await users.deleteOne({ _id: new ObjectId(req.params.id) });
      res.json({ message: 'تم الحذف' });
    });

    // التحقق من حالة الحظر قبل معالجة الطلبات
    app.use(async (req, res, next) => {
      if (!req.headers.authorization) return next();
      try {
        const token = req.headers.authorization.split(' ')[1];
        const payload = jwt.verify(token, JWT_SECRET);
        const user = await users.findOne({ _id: new ObjectId(payload.userId) });
        if (user?.blocked) return res.status(403).json({ message: 'الحساب محظور' });
        next();
      } catch {
        next();
      }
    });

    // إضافة لاعب مع رفع صورة إلى Cloudinary
    app.post('/api/players', authMiddleware(), upload.single('image'), async (req, res) => {
      const { name, bio } = req.body;
      const username = req.user.username;

      if (!name || !bio || !req.file) {
        return res.status(400).json({ message: 'جميع الحقول مطلوبة' });
      }

      try {
        const result = await new Promise((resolve, reject) => {
          const stream = cloudinary.uploader.upload_stream({ folder: 'players' }, (err, result) => {
            if (err) return reject(err);
            resolve(result);
          });
          stream.end(req.file.buffer);
        });

        const newPlayer = {
          name,
          bio,
          image: result.secure_url,
          views: 0,
          createdBy: username,
          createdAt: new Date(),
          expireAt: new Date(Date.now() + 48 * 60 * 60 * 1000) // حذف تلقائي بعد 48 ساعة
        };

        await players.insertOne(newPlayer);
        await users.updateOne({ username }, { $inc: { uploadCount: 1 } });

        res.status(201).json({ message: 'تمت الإضافة' });
      } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'فشل رفع الصورة أو حفظ اللاعب' });
      }
    });

    app.delete('/api/players/:id', authMiddleware('manager'), async (req, res) => {
      await players.deleteOne({ _id: new ObjectId(req.params.id) });
      res.json({ message: 'تم الحذف' });
    });

    app.get('/api/players', async (req, res) => {
      const now = new Date();
      const data = await players.find({ expireAt: { $gt: now } }).sort({ createdAt: -1 }).toArray();
      res.json(data);
    });

    // زيادة مشاهدات لاعب عادي
    app.post('/api/players/:id/view', async (req, res) => {
      await players.updateOne({ _id: new ObjectId(req.params.id) }, { $inc: { views: 1 } });
      res.json({ message: 'تمت الزيادة' });
    });

    // زيادة مشاهدات اللاعب بواسطة المدير (بمفتاح أمان)
    app.post('/api/players/:id/admin-view', async (req, res) => {
      if (req.body.adminKey !== ADMIN_KEY) {
        return res.status(403).json({ message: 'غير مصرح' });
      }
      await players.updateOne({ _id: new ObjectId(req.params.id) }, { $inc: { views: 1 } });
      res.json({ message: 'تمت الزيادة من المدير' });
    });

    // حذف اللاعبين المنتهين صلاحيتهم كل ساعة
    setInterval(async () => {
      const now = new Date();
      const deleted = await players.deleteMany({ expireAt: { $lt: now } });
      if (deleted.deletedCount > 0) {
        console.log(`🗑️ حذف ${deleted.deletedCount} لاعب منتهي`);
      }
    }, 3600000);

    app.listen(port, () => {
      console.log(`🚀 Server running on http://localhost:${port}`);
    });

  } catch (error) {
    console.error('فشل تشغيل السيرفر:', error);
  }
}

run();
