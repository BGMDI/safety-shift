# نشر النظام للعرض الخارجي

دليل خطوة بخطوة لنشر `shift-saas` على الإنترنت برابط ثابت — **لا يعتمد على جهازك ولا على شبكتك**.

> **لماذا النشر لا النفق:** شبكة الجامعة تقتل جلسات الأنفاق بعد المصافحة (جُرّب `cloudflared` بـ QUIC وHTTP/2 وفشل الاثنان).
> النشر يُشغّل الكود على خوادم المنصّات، فلا يمرّ بشبكتك إطلاقاً.

---

## المعمار

| الطبقة | المنصّة | التكلفة |
|---|---|---|
| قاعدة البيانات (PostgreSQL) | **Neon** | مجاني |
| الـAPI (NestJS) | **Railway** | مجاني للتجربة |
| الواجهة (Next.js) | **Vercel** | مجاني |

الثلاث تدخل بحساب GitHub مباشرة — لا حاجة لنطاق ولا بطاقة.

**ترتيب النشر مقصود:** قاعدة البيانات ← الـAPI ← الواجهة. كل طبقة تحتاج عنوان سابقتها.

---

## قبل البدء — أودِع التغييرات

المنصّات تبني من GitHub، فأي تعديل غير مُودَع **لن يُنشر**:

```bash
git status
```

إن وُجدت تغييرات، أودِعها وادفعها قبل المتابعة.

---

## ١. قاعدة البيانات — Neon

1. افتح [neon.tech](https://neon.tech) ← **Sign up with GitHub**
2. **Create project** — اختر المنطقة الأقرب (Frankfurt أو Singapore)
3. من صفحة المشروع انسخ **Connection string**، يبدو هكذا:

```
postgresql://user:pass@ep-xxx.eu-central-1.aws.neon.tech/neondb?sslmode=require
```

📋 **احتفظ به** — سنسمّيه `DATABASE_URL`.

> أرسله لي لأُنشئ الجداول وأزرع بيانات العرض.

---

## ٢. الـAPI — Railway

1. افتح [railway.app](https://railway.app) ← **Login with GitHub**
2. **New Project** ← **Deploy from GitHub repo** ← اختر `BGMDI/safety-shift`
3. من **Settings** اضبط:

**Build Command**
```
npm install && npm run db:generate --workspace=packages/database && npm run build --workspace=apps/api
```

**Start Command**
```
npm run start:prod --workspace=apps/api
```

4. من **Variables** أضف:

| المتغيّر | القيمة |
|---|---|
| `DATABASE_URL` | رابط Neon من الخطوة ١ |
| `JWT_SECRET` | سرّ عشوائي طويل |
| `JWT_REFRESH_SECRET` | سرّ **مختلف** |
| `PLATFORM_JWT_SECRET` | سرّ **ثالث مختلف** |
| `JWT_EXPIRES_IN` | `15m` |
| `JWT_REFRESH_EXPIRES_IN` | `7d` |
| `NODE_ENV` | `production` |
| `FRONTEND_URL` | اتركه فارغاً الآن — نملؤه في الخطوة ٤ |

> **الأسرار الثلاثة يجب أن تختلف.** `PLATFORM_JWT_SECRET` هو الفاصل الأمني بين لوحة الشركة ولوحة مالك المنصة — لو ساوى `JWT_SECRET` لأصبح أي موظف قادراً على انتحال مالك المنصة.
> لتوليدها: نفّذ `node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"` ثلاث مرات.

5. من **Settings → Networking** اضغط **Generate Domain**

📋 ستحصل على عنوان مثل `shift-api-production.up.railway.app` — **احتفظ به**.

---

## ٣. الواجهة — Vercel

1. افتح [vercel.com](https://vercel.com) ← **Continue with GitHub**
2. **Add New → Project** ← استورد `BGMDI/safety-shift`
3. **مهم:** اضبط **Root Directory** على `apps/web`
4. الإطار يُكتشف تلقائياً (Next.js) — لا تغيّر أوامر البناء
5. من **Environment Variables** أضف:

| المتغيّر | القيمة |
|---|---|
| `NEXT_PUBLIC_API_URL` | `https://<عنوان Railway>` — **بلا شرطة مائلة في النهاية** |

6. **Deploy**

📋 ستحصل على عنوان مثل `safety-shift.vercel.app` — **هذا هو الرابط الذي ترسله**.

> ⚠️ `NEXT_PUBLIC_*` تُحقن **وقت البناء** لا وقت التشغيل. أي تغيير لها يستلزم **إعادة نشر** (Redeploy) لا مجرّد حفظ.

---

## ٤. اربط الطرفين — CORS

ارجع إلى **Railway → Variables** واضبط:

```
FRONTEND_URL = https://safety-shift.vercel.app
```

ثم **Redeploy**.

> يقبل عدة نطاقات مفصولة بفاصلة، لتشمل نطاقات المعاينة:
> `https://safety-shift.vercel.app,https://safety-shift-git-main-you.vercel.app`

بدون هذه الخطوة ستفتح الصفحات لكن **كل طلب بيانات سيُرفض**.

---

## ٥. الدخول

```
admin@shift.com  /  Admin@123456
```

**غيّر كلمة المرور فوراً** إن بقي النشر قائماً بعد العرض.

---

## حدود معروفة

| الحد | التفصيل |
|---|---|
| **الملفات المرفوعة تزول** | صور الموظفين وشعارات الشركات تُحفظ على قرص Railway المؤقّت، وتُمسح مع كل إعادة نشر. للإنتاج الحقيقي: خزّنها في S3 أو Cloudflare R2 |
| **الخادم ينام** | الطبقة المجانية في Railway توقف الخادم عند الخمول؛ أول طلب بعده يستغرق ثوانٍ |
| **بيانات وهمية** | البذرة تُنشئ بيانات عرض لا بيانات موظفيك الحقيقية — مقصود، فلا داعي لكشف أرقام هويات ورواتب حقيقية لطرف خارجي |

---

## بعد انتهاء العرض

النشر يبقى قائماً بلا تكلفة، لكن إن أردت إغلاقه:

- **Vercel:** Settings → Delete Project
- **Railway:** Settings → Danger → Delete Service
- **Neon:** Settings → Delete Project

لا يؤثر أي منها على نسختك المحلية.
