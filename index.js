const express = require('express');
const cors = require('cors');
const multer = require('multer');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { MongoClient, ObjectId } = require('mongodb');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

const app = express();
const port = 4000;
const uri = process.env.MONGODB_URI;
const JWT_SECRET = process.env.JWT_SECRET;
const ADMIN_KEY = process.env.ADMIN_KEY;

const client = new MongoClient(uri);

app.use(cors());
app.use(express.json());

// إعداد مجلد رفع الصور
const uploadFolder = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadFolder)) fs.mkdirSync(uploadFolder);

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadFolder),
  filename: (req, file, cb) => cb(null, Date.now() + '-' + file.originalname)
});
const upload = multer({ storage });

app.use('/uploads', express.static(uploadFolder));

// ميدلوير تحقق التوكن والصلاحيات
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
      res.status(401).json({ message: 'غير مصرح أو توكن غير صالح' });
    }
  };
}

async function run() {
  try {
    await client.connect();
    console.log('✅ Connected to MongoDB');

    const db = client.db('mydatabase');
    const users = db.collection('users');
    const players = db.collection('players');

    // دالة لإنشاء مستخدم اختبار (مدير)
    async function createTestUser() {
      const existing = await users.findOne({ username: 'admin' });
      if (existing) {
        console.log('User "admin" already exists');
        return;
      }
      const hashedPass = await bcrypt.hash('admin123', 10);
      await users.insertOne({
        username: 'admin',
        password: hashedPass,
        role: 'manager',
        blocked: false,
        uploadCount: 0,
        createdAt: new Date()
      });
      console.log('Test user "admin" created with password "admin123"');
    }

    // استدعاء دالة إنشاء المستخدم التجريبي
    await createTestUser();

    // تسجيل دخول
    app.post('/api/login', async (req, res) => {
      const { username, password } = req.body;
      const user = await users.findOne({ username });
      if (!user) return res.status(401).json({ message: 'خطأ في اسم المستخدم أو كلمة المرور' });

      const validPass = await bcrypt.compare(password, user.password);
      if (!validPass) return res.status(401).json({ message: 'خطأ في اسم المستخدم أو كلمة المرور' });

      if (user.blocked) return res.status(403).json({ message: 'حسابك محظور' });

      const token = jwt.sign({ userId: user._id, username: user.username, role: user.role }, JWT_SECRET, { expiresIn: '8h' });
      res.json({ token, role: user.role, username: user.username });
    });

    // إضافة مستخدم (مدير فقط)
    app.post('/api/users', authMiddleware('manager'), async (req, res) => {
      const { username, password, role } = req.body;
      if (!username || !password || !role) return res.status(400).json({ message: 'جميع الحقول مطلوبة' });
      if (role !== 'supervisor' && role !== 'manager') return res.status(400).json({ message: 'الدور غير صحيح' });

      const existing = await users.findOne({ username });
      if (existing) return res.status(409).json({ message: 'اسم المستخدم موجود مسبقاً' });

      const hashedPass = await bcrypt.hash(password, 10);
      const newUser = {
        username,
        password: hashedPass,
        role,
        uploadCount: 0,
        blocked: false,
        createdAt: new Date()
      };
      await users.insertOne(newUser);
      res.status(201).json({ message: 'تم إضافة المستخدم' });
    });

    // جلب المستخدمين (مدير فقط)
    app.get('/api/users', authMiddleware('manager'), async (req, res) => {
      const allUsers = await users.find({ role: { $in: ['manager', 'supervisor'] } }, { projection: { password: 0 } }).toArray();
      res.json(allUsers);
    });

    // حذف مستخدم (مدير فقط)
    app.delete('/api/users/:id', authMiddleware('manager'), async (req, res) => {
      const id = req.params.id;
      await users.deleteOne({ _id: new ObjectId(id) });
      res.json({ message: 'تم حذف المستخدم' });
    });

    // حظر مستخدم (مدير فقط)
    app.post('/api/users/:id/block', authMiddleware('manager'), async (req, res) => {
      const id = req.params.id;
      await users.updateOne({ _id: new ObjectId(id) }, { $set: { blocked: true } });
      res.json({ message: 'تم حظر المستخدم' });
    });

    // فك الحظر عن مستخدم (مدير فقط)
    app.post('/api/users/:id/unblock', authMiddleware('manager'), async (req, res) => {
      const id = req.params.id;
      await users.updateOne({ _id: new ObjectId(id) }, { $set: { blocked: false } });
      res.json({ message: 'تم فك الحظر عن المستخدم' });
    });

    // Middleware فحص المستخدم المحظور لكل الطلبات
    app.use(async (req, res, next) => {
      if (!req.headers.authorization) return next();
      try {
        const token = req.headers.authorization.split(' ')[1];
        if (!token) return next();
        const payload = jwt.verify(token, JWT_SECRET);
        const user = await users.findOne({ _id: new ObjectId(payload.userId) });
        if (user && user.blocked) return res.status(403).json({ message: 'حسابك محظور' });
        next();
      } catch {
        next();
      }
    });

    // إضافة لاعب جديد (مدير أو مشرف)
    app.post('/api/players', authMiddleware(), upload.single('image'), async (req, res) => {
      const { name, bio } = req.body;
      const image = req.file ? `/uploads/${req.file.filename}` : null;
      const username = req.user.username;

      if (!name || !bio || !image) {
        return res.status(400).json({ message: 'الاسم، السيرة، والصورة مطلوبة' });
      }

      const newPlayer = {
        name,
        bio,
        image,
        views: 0,
        createdBy: username,
        createdAt: new Date(),
        expireAt: new Date(Date.now() + 48 * 60 * 60 * 1000) // 48 ساعة صلاحية
      };

      await players.insertOne(newPlayer);

      await users.updateOne({ username }, { $inc: { uploadCount: 1 } });

      res.status(201).json({ message: 'تمت إضافة اللاعب' });
    });

    // حذف لاعب (مدير فقط)
    app.delete('/api/players/:id', authMiddleware('manager'), async (req, res) => {
      const id = req.params.id;
      await players.deleteOne({ _id: new ObjectId(id) });
      res.json({ message: 'تم حذف اللاعب' });
    });

    // جلب اللاعبين غير منتهية الصلاحية
    app.get('/api/players', async (req, res) => {
      const now = new Date();
      const all = await players.find({ expireAt: { $gt: now } }).sort({ createdAt: -1 }).toArray();
      res.json(all);
    });

    // زيادة المشاهدات مرة واحدة لكل زائر
    app.post('/api/players/:id/view', async (req, res) => {
      const id = req.params.id;
      await players.updateOne({ _id: new ObjectId(id) }, { $inc: { views: 1 } });
      res.json({ message: 'تمت زيادة المشاهدات' });
    });

    // زيادة المشاهدات بواسطة المدير (مفتاح خاص)
    app.post('/api/players/:id/admin-view', async (req, res) => {
      const id = req.params.id;
      const { adminKey } = req.body;

      if (adminKey !== ADMIN_KEY) {
        return res.status(403).json({ message: 'وصول غير مصرح' });
      }

      await players.updateOne({ _id: new ObjectId(id) }, { $inc: { views: 1 } });
      res.json({ message: 'تمت زيادة المشاهدات بواسطة المدير' });
    });

    // حذف تلقائي للاعبين منتهية الصلاحية كل ساعة
    setInterval(async () => {
      const now = new Date();
      const expired = await players.deleteMany({ expireAt: { $lt: now } });
      if (expired.deletedCount > 0) {
        console.log(`🗑️ تم حذف ${expired.deletedCount} لاعب منتهي الصلاحية`);
      }
    }, 3600000);

    app.listen(port, () => {
      console.log(`🚀 Server running on http://localhost:${port}`);
    });

  } catch (error) {
    console.error(error);
  }
}

run();
