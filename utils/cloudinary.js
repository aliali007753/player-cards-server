const cloudinary = require("cloudinary").v2;
const { CloudinaryStorage } = require("multer-storage-cloudinary");

cloudinary.config({
  cloud_name: "untitled",
  api_key: "623144413629116",
  api_secret: "umtEO7jlfD5Fa9LzupyAgXUNPfs"
});

const storage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: "player-images", // كل الصور تنخزن داخل هذا الفولدر بحسابك
    allowed_formats: ["jpg", "png", "jpeg", "webp"]
  }
});

module.exports = { cloudinary, storage };
