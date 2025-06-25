@echo off
echo 🔁 جاري تحديث المشروع ورفعه إلى GitHub...

:: تحديد مسار المشروع (غيّر المسار حسب مشروعك)
cd /d "C:\Users\YourName\Desktop\اسم_المشروع"

:: إضافة جميع الملفات المعدّلة
git add .

:: كتابة رسالة التحديث
set /p msg=📌 اكتب رسالة التحديث: 
git commit -m "%msg%"

:: رفع التحديث إلى الفرع main
git push origin main

echo ✅ تم رفع التحديث إلى GitHub بنجاح!
pause
