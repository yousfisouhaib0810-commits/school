# 🗺️ الخطة التنفيذية المفصلة جداً (Micro-Execution Plan)

> **الهدف من هذا الملف:** تحويل الخطة العامة إلى خطوات تنفيذية مجهرية (Micro-Tasks). لا مجال للتخمين هنا؛ كل أمر (Command)، كل ملف، وكل دالة يجب أن يكون محدداً.
> 
> **🏆 القواعد الذهبية الإجبارية أثناء بناء كل مرحلة:**
> 1. 🔒 **الأمان التام:** لا ثغرات.
> 2. 💪 **القوة وقابلية التوسع:** جاهز للنمو.
> 3. ⚡ **السرعة الخاطفة:** أداء مثالي.
> 4. 🧹 **كود واضح وبسيط:** سهل الفهم والتطوير.
> 5. 🐛 **قابلية التتبع:** أخطاء واضحة وسهلة الاكتشاف.

---

## 🏗️ المرحلة 0: الأساس والبنية التحتية (Monorepo & DB)

### 0.1 هيكلة الـ Monorepo
- **الأوامر التنفيذية:**
  ```bash
  mkdir school && cd school
  pnpm init
  echo "packages:\n  - 'apps/*'\n  - 'packages/*'" > pnpm-workspace.yaml
  pnpm add -w -D turbo typescript @types/node eslint
  ```
- **الملفات المطلوبة:**
  - `turbo.json`: إعداد لعمليات `build`, `lint`, `dev` مع الاعتمادات الصحيحة.
  - `packages/config/`: إنشاء ملفات `tsconfig.base.json` و `eslint-preset.js`.
  - `packages/shared/`: إنشاء `package.json` مع `index.ts` لتصدير أنواع Zod.

### 0.2 إعداد الواجهة الخلفية (Backend - Fastify)
- **الأوامر:** `cd apps && mkdir api && cd api && pnpm init`
- **التنصيب:** `pnpm add fastify @fastify/cors @fastify/helmet @fastify/jwt zod`
- **الهيكلة الداخلية `apps/api/src/`:**
  - `server.ts`: نقطة الإقلاع المركزية.
  - `plugins/`: مجلد يحتوي `tenant.ts` (يستخرج `X-Tenant-Subdomain`) و `auth.ts` (لفك تشفير JWT).
  - `routes/`: مقسم إلى `auth/`, `tenant/`, `video/`.

### 0.3 إعداد الواجهة الأمامية (Frontend - Next.js 15)
- **الأوامر:** `cd apps && pnpm create next-app@latest web --typescript --tailwind --eslint --app`
- **التنصيب:** `pnpm add shadcn-ui@latest lucide-react zustand`
- **الهيكلة:**
  - `src/app/(auth)`: صفحات الدخول والتسجيل.
  - `src/app/(dashboard)`: لوحة تحكم الأستاذ.
  - `src/app/(student)`: واجهة الطالب.
  - `src/middleware.ts`: مبرمج لاستخراج Subdomain من الرابط (`req.headers.get('host')`).

### 0.4 قاعدة البيانات والتجريد (Prisma & Postgres)
- **الأوامر:** `cd packages && mkdir database && cd database && pnpm init && pnpm add prisma -D && pnpm dlx prisma init`
- **التفاصيل الدقيقة في `schema.prisma`:**
  - تفعيل `relationMode = "foreignKeys"`.
  - كل الجداول **يجب** أن تحتوي على `tenantId String @db.Uuid`.
  - كتابة سكربت `rls.sql` لفرض `ROW LEVEL SECURITY` بناءً على `app.current_tenant_id`.

### 0.5 بيئة التطوير المحلية (Docker Compose)
- **ملف `docker-compose.yml`:**
  - `postgres` (المنفذ 5432، متغيرات البيئة POSTGRES_USER, POSTGRES_PASSWORD).
  - `redis` (المنفذ 6379، لا يحتاج باسورد محلياً).
  - `nginx` (المنفذ 80، مع volume لملف `nginx.conf` لتوجيه `*.localhost` إلى Fastify و Next.js).

---

## 🛡️ المرحلة 1: النواة الأمنية و Multi-Tenancy

### 1.1 التحقق من الهوية (Auth)
- **خوارزمية التشفير:** استخدام `argon2` لتشفير الباسورد.
  ```typescript
  import * as argon2 from 'argon2';
  const hash = await argon2.hash(password);
  ```
- **نظام الـ Tokens:**
  - **Access Token:** يُرسل في Body مدته 15m.
  - **Refresh Token:** يُرسل كـ `HttpOnly, Secure, SameSite=Strict` مدته 7 أيام.
- **التوجيهات الأمنية:**
  - الـ POST على `/api/auth/login` يجب أن يمر عبر Fastify Rate Limit (Max 5 per minute).

### 1.2 عزل المستأجرين (RLS Middleware)
- **في Fastify القابس `tenant.ts`:**
  - قراءة الدومين الفرعي (`X-Tenant-Subdomain`).
  - البحث في الـ DB عن الـ Tenant الموازي.
  - تنفيذ `prisma.$executeRaw` لعمل `SET app.current_tenant_id = 'xxx'` قبل تمرير الطلب للـ Route.

---

## 📊 المرحلة 2: لوحة تحكم الأستاذ (Dashboard Management)

### 2.1 الواجهة (Frontend)
- **الهيكل:** 
  - Sidebar ثابت في اليسار. يحتوي على قوائم Navigation مبرمجة لتعكس الـ Path الحالي (Active states).
- **إدارة المحتوى (Drag and Drop):**
  - استخدام مكتبة `@hello-pangea/dnd` لترتيب المراحل والدروس وإرسال `PATCH /api/stages/reorder`.

### 2.2 الـ API الخاصة بالإضافة والتعديل (CRUD)
- مسار إنشاء مادة `POST /api/subjects`:
  - قراءة الـ Body الموثق بـ Zod.
  - إدخال البيانات في Prisma مع ربطها بـ `req.tenantId` التلقائي لمنع حقن Tenant آخر.

---

## 🎥 المرحلة 3: نظام الفيديو المحمي (Anti-Piracy Video)

### 3.1 الرفع المباشر (Direct Upload to Cloudflare Stream)
- **التفصل الدقيق:**
  - الأستاذ يضغط "رفع".
  - Frontend يطلب نقطة الرفع من: `POST /api/videos/upload-url`.
  - Backend يكلم Cloudflare API برمز المصادقة للحصول على `uploadUrl`.
  - Frontend يرفع الملف مباشرة إلى `uploadUrl` وعرض `Progress Bar` بالاعتماد على XMLHttpRequest أو Axios progress event.

### 3.2 العلامة المائية الديناميكية (Dynamic Watermark UI)
- مكون React مخصص `VideoPlayer.tsx`.
- يحتوي على طبقة `div` مطلقة (`absolute z-50 pointer-events-none`).
- الـ `div` يطلب `setInterval` يغير من موضعه (Top/Left) بقيم عشوائية لتجنب برامج حجب العلامة المائية.

---

## 🔴 المرحلة 4: البث المباشر (Live Sessions)

### 4.1 دمج zoom
- واجهة `` تستخدم الجافاسكريبت `
- **نظام الوصول:** 
  - الـ Backend يولد رمز JWT مؤقت مُوقع بمفتاح `zoom api `.
  - لا يمكن للطالب دخول الرابط بدون طلب الرمز أولاً للتحقق من دفعه.

---

## 💳 المرحلة 5: نظام الدفع (Payments & Subscriptions)

### 5.1 البوابات (Gateways)
- **Stripe:** 
  - إعداد `Stripe Checkout`.
  - تخزين `customer_id` في جدول `Users` و `subscription_id` في جدول `Subscriptions`.
- **CIB/الذهبية:**
  - التكامل عبر واجهة برمجة الدفع الجزائرية (Satim API إن توفرت أو وسيط معتمد).
- **الـ Webhooks:**
  - ملف `POST /api/webhooks/stripe`.
  - التحقق النقدي الدقيق من `stripe.webhooks.constructEvent`.

---

## 🎨 المرحلة 6: صانع صفحات الهبوط (Page Builder)

### 6.1 بنية تخزين الصفحة
- حقل `blocks` في جدول `LandingPage` يكون نوعه `JSONB`.
- الهيكل: 
  ```json
  [
    {"type": "hero", "props": {"title": "أكاديميتي", "bg": "#fff"}},
    {"type": "pricing", "props": {"plans": ["monthly", "yearly"]}}
  ]
  ```
- **المحرك (Render Engine):**
  - كود Frontend يمتلك دالة `renderBlock(block)` تقوم بإرجاع مكون React المقابل لـ `type`.

---

## 🎓 المرحلة 7: واجهة الطالب (Student Portal)

### 7.1 متتبع تقدم الطالب (Progress Tracking)
- يتم استدعاء ميزة `onTimeUpdate` في الـ مشغل الفيديو (Player).
- كل 10 ثوانٍ يتم عمل `debounced request` لإرسال الثواني المشاهدة `PUT /api/videos/progress`.
- عند وصول النسبة المئوية للمشاهدة فوق 90%، يرسل `is_completed=true`.

---

## 👑 المرحلة 8: لوحة المشرف العام (Super Admin)

- **بنية الدخول:**
  - لا توجد بوابة عامة، فقط مسار `/super-secret-admin`.
  - التحقق من دور المستخدم (`role === "SUPER_ADMIN"`).
- **إدارة المستأجرين (Tenants):**
  - إحصاء الـ Tenant.
  - زر (اقفال حساب) يغير حقل `status` من `ACTIVE` إلى `SUSPENDED`.
  - الـ Middleware سيقوم بإرجاع صفحة `403 Account Suspended` تلقائياً لكل الطلاب المرتبطين به.

---

## 🛡️ المرحلة 9: الحماية المركزية والأداء (Performance & Quality)

- **حماية الـ API:** تطبيق `helmet` ضد محاولات ClickJacking، و `cors` للحد من اتصالات الأطراف الثالثة.
- **التخزين المؤقت (Caching):**
  - جدول الدروس يتم وضع نسخة منه في Redis بصيغة `tenant:{tenant_id}:lessons`.
  - كل عملية `PUT/POST/DELETE` تمسح مفتاح Redis ليتم جلبه طازجاً في المرة القادمة.
- **الاختبار (Testing):** كتابة سكربتات بـ `Vitest` أو `Jest` لضمان أن RLS يمنع فعلا الوصول الخاطئ.

--- أو Docker):**
  - سيتم بناء صورة Docker لـ Next.js مع متغير `STANDALONE_MODE`.
- **قاعدة البيانات:** 
  - إعداد نسخ احتياطي يومي باستخدام `pg_dump` وحفظه في مساحة متوافقة مع S3 مثل `Clo

## 🚀 المرحلة 10: النشر والإطلاق (Deployment)

- **الواجهة الأمامية (Verceludflare R2`. 
- **CI/CD Pipeline:**
  - يجب تمرير `tsc --noEmit` وَ `eslint` وَ `test` بنجاح  عمل `docker build` وَ `docker push`.
