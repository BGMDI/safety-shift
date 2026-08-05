# مواصفة إعادة بناء النظام — shift-saas

> **الغرض:** وثيقة مرجعية كاملة تكفي لإعادة بناء النظام من الصفر.
> مستخرَجة من الكود الفعلي بتاريخ **5 أغسطس 2026**.
> **نطاق التغطية:** 35 نموذج بيانات · 21 وحدة API · 28 صفحة واجهة.

---

## جدول المحتويات

1. [نظرة عامة](#1-نظرة-عامة)
2. [البنية التقنية](#2-البنية-التقنية)
3. [متغيرات البيئة](#3-متغيرات-البيئة)
4. [نموذج البيانات الكامل](#4-نموذج-البيانات-الكامل)
5. [المصادقة والصلاحيات](#5-المصادقة-والصلاحيات)
6. [وحدات الـ API ومساراتها](#6-وحدات-الـ-api-ومساراتها)
7. [منطق الأعمال الجوهري](#7-منطق-الأعمال-الجوهري)
8. [الواجهة الأمامية](#8-الواجهة-الأمامية)
9. [خطة إعادة البناء بالترتيب](#9-خطة-إعادة-البناء-بالترتيب)
10. [قواعد ثابتة وأخطاء معروفة](#10-قواعد-ثابتة-وأخطاء-معروفة)
11. [⚠️ نقاط ضعف تصميمية — لا تنسخها](#11-️-نقاط-ضعف-تصميمية--لا-تنسخها)

---

## 1. نظرة عامة

نظام **SaaS بالعربية بالكامل** (RTL) لإدارة الموارد البشرية والشفتات، **متعدد المستأجرين (multi-tenant)**، بلوحتين منفصلتين تماماً:

| اللوحة | المستخدم | المصادقة |
|---|---|---|
| **لوحة الشركة** | موظفو الشركة (بمستويات صلاحيات) | `JWT_SECRET` + `access_token` |
| **لوحة مالك المنصة** | مالك المنصة (يدير كل الشركات) | `PLATFORM_JWT_SECRET` + `platform_access_token` |

### المفاهيم المحورية

- **الموظف = المستخدم.** لا يوجد جدول `User` منفصل؛ `JWT.sub` = `Employee.id`، وتسجيل الدخول بالبريد وكلمة المرور من جدول `Employee`.
- **عزل المستأجرين** عبر حقل `tenantId` في كل جدول تشغيلي، ويُشتق دائماً من الـ JWT وليس من مدخلات المستخدم.
- **الوحدات القابلة للتفعيل:** كل شركة لها `enabledModules` — أقسام تُفتح أو تُغلق حسب باقة الاشتراك. الموظفون والهيكل التنظيمي **أساسيان دائماً** ولا يخضعان للتفعيل.
- **لا اعتماد تلقائي أبداً:** مسار اعتماد الطلبات يُصعِّد احتياطياً بدل الموافقة التلقائية.

---

## 2. البنية التقنية

```
shift-saas/                    Monorepo (Turborepo)
├── apps/
│   ├── api/                   NestJS · منفذ 4000 · بادئة /api/v1
│   └── web/                   Next.js 16 (App Router) + Turbopack · منفذ 3000
├── packages/
│   ├── database/              Prisma + PostgreSQL
│   └── types/                 أنواع مشتركة (JwtPayload, AuthTokens...)
└── package.json               turbo run dev | build | db:generate | db:migrate
```

| الطبقة | التقنية |
|---|---|
| Backend | NestJS · Passport JWT · Prisma ORM · bcrypt (12 rounds) · multer (رفع الملفات) · Swagger |
| Frontend | Next.js 16 App Router · React · Tailwind CSS · axios · react-hook-form + zod |
| قاعدة البيانات | PostgreSQL |
| المدفوعات | Stripe (checkout · portal · webhook) |
| Node | ≥ 20 |

**ملاحظات تشغيلية مهمة:**
- الـ API يعمل بأمر `ts-node -r tsconfig-paths/register src/main.ts` — **بلا file-watch**، يحتاج إعادة تشغيل يدوية بعد أي تعديل خلفي.
- الملفات المرفوعة تُقدَّم من مجلد `uploads/` عبر المسار الثابت `/uploads` (صور الموظفين + شعارات الشركات).

---

## 3. متغيرات البيئة

```env
# قاعدة البيانات
DATABASE_URL=postgresql://user:pass@localhost:5432/shift_saas

# مصادقة الشركات
JWT_SECRET=<سر توكن الموظفين>
JWT_EXPIRES_IN=15m
JWT_REFRESH_SECRET=<سر توكن التجديد>
JWT_REFRESH_EXPIRES_IN=7d

# مصادقة مالك المنصة — منفصلة تماماً
PLATFORM_JWT_SECRET=<سر مختلف تماماً>
PLATFORM_JWT_EXPIRES_IN=8h

# الشبكة
PORT=4000
FRONTEND_URL=http://localhost:3000
NEXT_PUBLIC_API_URL=http://localhost:4000
NODE_ENV=development

# Stripe
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
STRIPE_PRICE_MONTHLY=
STRIPE_PRICE_QUARTERLY=
STRIPE_PRICE_ANNUAL=
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=

# NextAuth (موجود في الإعداد)
NEXTAUTH_SECRET=
NEXTAUTH_URL=http://localhost:3000
```

> ⚠️ **حرج:** `JWT_SECRET` و`PLATFORM_JWT_SECRET` **يجب** أن يكونا مختلفين — هذا هو الفاصل الأمني بين اللوحتين.

---

## 4. نموذج البيانات الكامل

### 4.1 المستأجرون والمنصة

```prisma
model Tenant {
  id, name, logo?
  plan            SubscriptionPlan  @default(TRIAL)   // TRIAL|MONTHLY|QUARTERLY|ANNUAL
  planStatus      PlanStatus        @default(TRIAL)   // TRIAL|ACTIVE|EXPIRED|CANCELLED
  stripeCustomerId? @unique
  trialEndsAt?
  enabledModules  SystemModule[]                      // الأقسام المفعّلة
  subscriptionTemplateId?
  subscriptionStartsAt?, subscriptionEndsAt?          // تجاوزه ⇒ إقفال الدخول
  maxUsers?       Int                                 // فارغ = بلا حد
}

enum SystemModule {
  ATTENDANCE  SHIFTS  LEAVES  PAYROLL  CUSTODY
  UNIFORMS    ONBOARDING  APPROVALS  ROLES  AUDIT
}

model PlatformAdmin {           // حساب مالك المنصة — بلا أي ربط بشركة
  id, email @unique, passwordHash, fullName, createdAt
}

model PlatformAuditLog {        // سجل تدقيق مالك المنصة — لا يظهر للشركة إطلاقاً
  id, tenantId, action, entityId?, details Json?, createdAt
}

model SubscriptionTemplate {    // باقة جاهزة (أساسي/احترافي/متكامل)
  id, name, modules SystemModule[], monthlyPrice? Decimal(10,2), isActive
}

model Subscription {            // اشتراك Stripe
  id, tenantId, stripeSubscriptionId @unique, plan, status
  currentPeriodStart, currentPeriodEnd, cancelAtPeriodEnd
}
```

### 4.2 الهيكل التنظيمي

```prisma
model Branch {
  id, tenantId, name, location?, timezone @default("Asia/Riyadh")
  managerEmployeeId?         // مدير الفرع — يُستخدم في مسار الاعتماد
  siteSupervisorEmployeeId?  // مشرف الموقع — إشراف ميداني
}

model Department {
  id, tenantId, branchId?, name
  parentId?                  // شجرة أقسام (DeptHierarchy)
  headEmployeeId?            // رئيس القسم — يُستخدم في مسار الاعتماد
}

model JobTitle {
  id, tenantId, name, grade?, baseSalary Decimal(10,2)
  isShiftEligible Boolean @default(true)   // هل تدخل في جدولة الشفتات؟
}
```

### 4.3 الموظفون

```prisma
model Employee {
  id, tenantId, branchId, departmentId?, jobTitleId?
  employeeCode
  fullName                                    // مركّب تلقائياً
  firstName?, fatherName?, grandfatherName?, familyName?
  nationalId?, idExpiryDate?, nationality?, birthDate?
  qualification?, specialization?, iban?, photo?
  hireDate, status EmployeeStatus @default(ACTIVE)   // ACTIVE|SUSPENDED|TERMINATED
  email? @unique                              // فريد عالمياً — الدخول بالبريد بلا تحديد شركة
  phone?, passwordHash?

  @@unique([tenantId, employeeCode])
  @@unique([tenantId, phone])
  @@unique([tenantId, nationalId])
  @@unique([tenantId, iban])
}
```

> **قيود التفرّد أساسية** — بدونها يصبح تسجيل الدخول غير حتمي (علّة حقيقية وقعت سابقاً).

### 4.4 الرواتب

```prisma
model SalaryComponent {
  id, tenantId, employeeId
  type SalaryComponentType    // BASE | ALLOWANCE | DEDUCTION
  name, amount Decimal(10,2), isPercentage, effectiveDate
}

model PayrollRun {
  id, tenantId, month, year
  status PayrollStatus @default(DRAFT)    // DRAFT|APPROVED|PAID
  totalAmount Decimal(12,2), approvedBy?, approvedAt?
  @@unique([tenantId, month, year])
}

model PayrollDetail {
  id, payrollRunId, employeeId
  baseSalary, totalAllowances, totalDeductions
  absenceDeduction, lateDeduction, netSalary   // كلها Decimal(10,2)
  workingDays, absentDays
}
```

### 4.5 الإجازات

```prisma
model LeaveType {
  id, tenantId, name, description?
  maxDays, maxDaysHalfPay?, maxDaysUnpaid?    // المرضية: كامل/نصف/بدون
  requiresApproval, color?, isSystemDefault
  calculationType String @default("FIXED")
  // FIXED | SENIORITY_BASED | SICK_TIERED | ONCE_PER_EMPLOYMENT | PER_EVENT
  minDays?, seniorityThreshold?               // لـ SENIORITY_BASED
}

model LeaveBalance {
  id, tenantId, employeeId, leaveTypeId, year
  entitledDays, usedDays @default(0)
  @@unique([employeeId, leaveTypeId, year])
}

model LeaveRequest {
  id, tenantId, employeeId, leaveTypeId
  startDate, endDate
  status RequestStatus @default(PENDING)      // PENDING|APPROVED|REJECTED
  approvedBy?, notes?, createdAt
  hiddenFromTenant Boolean @default(false)    // ⭐ حذف مالك المنصة = إخفاء لا مسح
}
```

### 4.6 الشفتات والتدوير

```prisma
model Shift {
  id, tenantId, branchId, name
  startTime String, endTime String            // "HH:mm"
  breakMinutes, isNightShift, workingDays Int[]   // 0=الأحد .. 6=السبت
  minStaffing?                                // الحد الأدنى لحساب فجوة التغطية

  // قواعد الحضور الخاصة بهذه الوردية
  checkInWindowMinutes Int @default(30)       // السماح بالحضور قبل البداية
  lateAfterMinutes     Int @default(0)        // سماح قبل احتساب "تأخير"
  absentAfterMinutes   Int @default(60)       // بعده بلا حضور ⇒ "غائب"
  checkOutEarlyMinutes Int @default(0)        // السماح بالانصراف قبل النهاية
}

model EmployeeShift {                          // التعيين الفعلي
  id, tenantId, employeeId, shiftId
  effectiveFrom, effectiveTo?                 // null = مفتوح
}

model RotationPlan {
  id, tenantId, name
  restMode String @default("AT_ROTATION")     // AT_ROTATION | WEEKLY | AFTER_N_DAYS
  restDays Int @default(1)
  weeklyRestDays Int[]                        // لـ WEEKLY
  workDaysBeforeRest Int @default(0)          // لـ AFTER_N_DAYS
  startDate, createdAt
}

model RotationStep {                           // خطوة: شفت + عدد أيامه
  id, planId, order, shiftId, days
}

model RotationGroup {
  id, planId, name, order
  supervisorEmployeeId?                       // مشرف الفترة
}

model RotationGroupMember {
  id, groupId, employeeId
  pinnedShiftId?                              // مثبَّت على شفت — خارج التناوب
  @@unique([groupId, employeeId])
}
```

> ⚠️ **`EmployeeShift` لا يحمل `planId`** — لا يوجد ربط بين التعيين والخطة التي أنشأته. هذا أصل مشكلة تعارض الخطط (انظر §7.2).

### 4.7 الحضور

```prisma
model AttendanceLog {
  id, tenantId, employeeId, date @db.Date
  checkIn?, checkOut?
  source AttendanceSource @default(MANUAL)    // BIOMETRIC|MANUAL|SUPERVISOR|SELF
  status AttendanceStatus @default(PRESENT)   // PRESENT|ABSENT|LATE|EXCUSED|HOLIDAY|WEEKEND
  lateMinutes, overtimeMinutes, approvedBy?, notes?
  @@unique([employeeId, date])
}

model PermissionLog {                          // استئذان
  id, tenantId, employeeId, date @db.Date
  type PermissionType                          // START|DURING|END
  durationMin, reason?, status, approvedBy?
}

model PublicHoliday { id, tenantId, name, date @db.Date, isRecurring }
```

### 4.8 العهد والبدلات والمباشرات

```prisma
model CustodyItem {
  id, tenantId, employeeId, itemName
  assignedDate, returnedDate?, status String @default("active")
}

model UniformRequest {
  id, tenantId, employeeId, uniformType, size?, quantity
  status RequestStatus, notes?, approvedBy?, createdAt
}

model OnboardingRequest {
  id, tenantId, employeeId
  type OnboardingType                          // NEW_HIRE | RETURN_FROM_LEAVE
  scheduledDate @db.Date, notes?, status, approvedBy?
}
```

### 4.9 الصلاحيات والتدقيق

```prisma
model Role         { id, tenantId, name  @@unique([tenantId, name]) }  // صف لكل شركة، ليس enum
model Permission   { id, roleId, module, action }
model EmployeeRole { id, employeeId, roleId  @@unique([employeeId, roleId]) }

model AuditLog {                               // سجل تدقيق الشركة
  id, tenantId, employeeId?, action, module, entityId?
  oldData Json?, newData Json?, ipAddress?, createdAt
  impersonatedBy String?                       // مالك المنصة إن نُفِّذ داخل جلسة انتحال
  @@index([tenantId, createdAt])
}
```

### 4.10 مسارات الاعتماد

```prisma
enum ApprovalRequestType  { LEAVE  UNIFORM  ONBOARDING }
enum ApproverKind         { ROLE  DEPT_HEAD  BRANCH_MANAGER }
enum ApprovalCaseStatus   { PENDING  APPROVED  REJECTED }
enum ApprovalFallbackTier { HR  SUPER_ADMIN }
enum ApprovalActionStatus { PENDING  SKIPPED  APPROVED  REJECTED }

model ApprovalWorkflow {
  id, tenantId, type, isActive
  @@unique([tenantId, type])
}

model ApprovalStep {
  id, workflowId, order, label, approverKind
  roleId?                                      // مطلوب فقط عند ROLE
  @@unique([workflowId, order])
}

model ApprovalCase {
  id, tenantId, workflowId, requestType, requestId, employeeId
  status, currentOrder @default(1)
  fallbackTier?                                // تصعيد احتياطي
  decidedById?, notes?, createdAt, decidedAt?
  @@unique([requestType, requestId])
}

model ApprovalAction {
  id, caseId, stepId, order, status
  decidedBy?, decidedAt?, notes?
  @@unique([caseId, order])
}
```

---

## 5. المصادقة والصلاحيات

### 5.1 نظاما مصادقة منفصلان

| | لوحة الشركة | لوحة مالك المنصة |
|---|---|---|
| الجدول | `Employee` | `PlatformAdmin` |
| السرّ | `JWT_SECRET` | `PLATFORM_JWT_SECRET` |
| استراتيجية Passport | `jwt` | `platform-jwt` |
| الحارس | `JwtAuthGuard` | `PlatformAuthGuard` |
| مفتاح التخزين | `access_token` + `refresh_token` | `platform_access_token` |
| عميل axios | `lib/api.ts` | `lib/platform-api.ts` |
| نقطة الدخول | `POST /auth/login` | `POST /platform-auth/login` |

### 5.2 حمولة التوكن

```ts
// packages/types/src/index.ts
interface JwtPayload {
  sub: string        // Employee.id
  tenantId: string
  email: string
  roles: string[]    // من EmployeeRole → Role.name
  modules: string[]  // Tenant.enabledModules — لتصفية القائمة الجانبية
}

interface PlatformJwtPayload {   // بلا tenantId إطلاقاً
  sub: string  email: string  fullName: string
}
```

**مطالبة إضافية اختيارية:** توكن الانتحال (§7.8) يحمل `impersonatedBy: string` فوق `JwtPayload` — يميّز الجلسة عن تسجيل دخول حقيقي. الحُرّاس تتجاهله، لكنه متاح لأي منطق يحتاج نسب الإجراء لمالك المنصة.

### 5.3 مستويات الأدوار

```ts
// apps/api/src/common/auth.util.ts
MGMT_ROLES = ['super_admin', 'hr_manager', 'supervisor']  // عرض بيانات كل الموظفين
HR_ROLES   = ['super_admin', 'hr_manager']                 // التعديل والبيانات المالية

isManager(u)              // ينتمي لـ MGMT_ROLES
isHR(u)                   // ينتمي لـ HR_ROLES
assertSelfOrManager(u,id) // سجله الشخصي أو إداري
assertSelfOrHR(u,id)      // سجله الشخصي أو موارد بشرية (مالي)
```

الأدوار الافتراضية المُنشأة لكل شركة جديدة:
`['super_admin', 'hr_manager', 'supervisor', 'employee']`

### 5.4 الحارس `RolesGuard` يمنع افتراضياً ⭐

كل مسار تحت `RolesGuard` **يجب** أن يعلن تصريحه صراحةً، وإلا رُفض:

| الوسم | المعنى |
|---|---|
| `@Roles('super_admin', ...)` | مقصور على هذه الأدوار |
| `@AnyEmployee()` | متاح لأي موظف مسجّل دخول — **والملكية مفروضة داخل المعالج** |
| **بلا وسم** | **مرفوض** — `403: هذا المسار غير مُصرَّح به` |

```ts
canActivate(context) {
  const requiredRoles = reflector.getAllAndOverride(ROLES_KEY, targets)
  if (requiredRoles?.length) { /* افحص الأدوار */ return true }
  if (reflector.getAllAndOverride(ANY_EMPLOYEE_KEY, targets)) return true
  throw new ForbiddenException('هذا المسار غير مُصرَّح به — يلزم @Roles(...) أو @AnyEmployee()')
}
```

**لماذا المنع افتراضي:** كان الحارس يُرجع `true` عند غياب `@Roles`، فأي مسار جديد يُنشأ مكشوفاً بصمت. تسبّب ذلك فعلاً في انكشاف كل الرواتب وأرقام الهويات لأي موظف. بعد القلب، نسيان الوسم يصبح **خطأ 403 مرئياً فوراً** لا تسريباً صامتاً.

**شرط استخدام `@AnyEmployee()`:** لا تضعه إلا على مسار ذاتي (`/my`, `/me/...`) أو يفرض الملكية داخلياً عبر `assertSelfOrManager` / `assertSelfOrHR` أو بتقييد الاستعلام بـ `u.sub`. الوسم يعني "أي موظف"، فإن لم يقيّد المعالج النطاق صار المسار مكشوفاً لكل الشركة.

> المسارات تحت `PlatformAuthGuard` (لوحة المنصة) لا تمرّ بـ`RolesGuard` إطلاقاً — وجود الحارس وحده هو التصريح.

### 5.5 حارس الوحدات `ModuleGuard`

مستقل عن `RolesGuard`، يمنع الوصول لقسم غير مفعّل في باقة الشركة:

```ts
if (!required) return true                    // بلا @RequiresModule = أساسي دائماً
if (!user?.tenantId) return true              // مسارات مالك المنصة لا تحمل tenantId
if (!tenant.enabledModules.includes(required))
  throw new ForbiddenException('هذا القسم غير مفعّل في باقة اشتراك شركتكم')
```

### 5.6 إقفال الاشتراك المنتهي

عند كل تسجيل دخول وكل تجديد توكن:

```ts
const expiredByDate = tenant.subscriptionEndsAt ? tenant.subscriptionEndsAt < new Date() : false
if (planStatus === 'EXPIRED' || planStatus === 'CANCELLED' || expiredByDate)
  throw new UnauthorizedException('انتهت صلاحية اشتراك شركتك')
```

> `refreshToken()` يُعيد جلب `enabledModules` من قاعدة البيانات في كل تجديد — لتنعكس تغييرات الباقة فوراً بلا انتظار انتهاء التوكن.

---

## 6. وحدات الـ API ومساراتها

> البادئة العامة: `/api/v1`
> الترميز: 🔓 أي مسجّل دخول · 👔 `supervisor`+ · 💼 `hr_manager`+ · 👑 `super_admin` · 🏢 مالك المنصة

### المصادقة
```
POST   /auth/login                       🔓  بريد + كلمة مرور ⇒ accessToken + refreshToken
POST   /auth/refresh                     🔓
POST   /platform-auth/login              🔓  مالك المنصة
POST   /platform-auth/bootstrap          🔓  إنشاء أول مالك منصة
GET    /tenants/me                       🔓  اسم وشعار شركتي
```

### الهيكل التنظيمي  *(أساسي — بلا `@RequiresModule`)*
```
GET    /branches                         👔      POST /branches            💼
PUT    /branches/:id                     💼      DELETE /branches/:id      💼
GET    /departments  ·  /departments/:id 👔      POST/PUT/DELETE           💼
GET    /job-titles                       👔      POST/PUT/DELETE           💼
```

### الموظفون  *(أساسي)*
```
GET    /employees                        👔
GET    /employees/stats                  👔
GET    /employees/next-code              💼
GET    /employees/:id                    🔓  (assertSelfOrManager داخلياً)
POST   /employees                        💼
PUT    /employees/:id                    💼
POST   /employees/:id/photo              💼  multipart
DELETE /employees/:id                    💼
```

### الرواتب  *(أساسي)*
```
GET    /salary/employee/:id              🔓  (assertSelfOrHR)
GET    /salary/employee/:id/certificate  🔓  تعريف بالراتب
POST   /salary/component                 💼
PUT    /salary/component/:id             💼
DELETE /salary/component/:id             💼
```

### الحضور  `@RequiresModule('ATTENDANCE')`
```
GET    /attendance/roster                👔  كشف التحضير + "غياب متوقع"
GET    /attendance/summary               👔
GET    /attendance/me/today              🔓
GET    /attendance/me/logs               🔓  ?month&year
GET    /attendance                       👔
POST   /attendance/bulk                  👔
POST   /attendance/self-check            🔓  { type: 'in' | 'out' }
POST   /attendance/import                💼
POST   /attendance                       👔
PUT    /attendance/:id                   👔
DELETE /attendance/:id                   💼
```

### الشفتات والتدوير  `@RequiresModule('SHIFTS')`
```
GET    /shifts                           👔
POST   /shifts · PUT /shifts/:id · DELETE /shifts/:id      💼
POST   /shifts/assign                    💼
GET    /shifts/my-schedule               🔓  ?startDate&endDate
GET    /shifts/schedule                  👔

GET    /rotations                        👔
POST   /rotations                        💼
DELETE /rotations/:id                    💼
POST   /rotations/:id/groups             💼
DELETE /rotations/groups/:groupId        💼
PUT    /rotations/groups/:groupId/supervisor              💼
POST   /rotations/groups/:groupId/members                 💼
PUT    /rotations/groups/:groupId/members/:employeeId/pin 💼
DELETE /rotations/groups/:groupId/members/:employeeId     💼
POST   /rotations/:id/distribute         💼
GET    /rotations/:id/preview            👔  ?days&startDate
POST   /rotations/:id/apply              💼  { days, startDate }
```

### الإجازات  `@RequiresModule('LEAVES')`
```
GET    /leaves/types                     🔓
GET    /leaves/calc-types                🔓
POST   /leaves/types/seed-saudi-defaults 💼  بذر أنواع نظام العمل السعودي
POST/PUT/DELETE /leaves/types(/:id)      💼
POST   /leaves/balances/auto-assign      💼
GET    /leaves/balances/:employeeId      🔓  (assertSelfOrManager)
POST   /leaves/balances                  💼
DELETE /leaves/balances/:id              💼
DELETE /leaves/types/:id/balances        💼  حذف جماعي
GET    /leaves/requests                  🔓  (غير الإداري يرى طلباته فقط)
POST   /leaves/requests                  🔓
PUT    /leaves/requests/:id/approve      🔓  (الأهلية محسوبة ديناميكياً)
```

### مسير الرواتب  `@RequiresModule('PAYROLL')`
```
GET    /payroll/my                       🔓
GET    /payroll  ·  /payroll/:id         💼
POST   /payroll                          💼  توليد المسير
PUT    /payroll/:id/approve              👑
DELETE /payroll/:id                      👑
```

### العهد · البدلات · المباشرات
```
GET    /custody/my                       🔓        `CUSTODY`
GET    /custody/employee/:id             🔓
POST   /custody                          💼
PUT    /custody/:id/return               💼
GET    /custody/clearance/:id            🔓  إخلاء طرف

GET    /uniforms/my                      🔓        `UNIFORMS`
GET    /uniforms                         👔
POST   /uniforms                         🔓
PUT    /uniforms/:id/status              🔓

GET    /onboarding/my                    🔓        `ONBOARDING`
GET    /onboarding                       👔
POST   /onboarding                       🔓
PUT    /onboarding/:id/decide            🔓
```

### الاعتمادات · الصلاحيات · التدقيق
```
GET    /approvals/workflows              💼        `APPROVALS`
PUT    /approvals/workflows/:type        💼
POST   /approvals/workflows/seed-defaults 💼
GET    /approvals/my-queue               🔓  طلبات بانتظار قراري
GET    /approvals/trail/:requestType/:requestId  🔓

GET    /roles                            💼        `ROLES`
POST   /roles/seed-defaults              👑
POST/PUT/DELETE /roles(/:id)             👑
GET    /roles/employees                  💼
POST   /roles/:roleId/employees/:employeeId    👑
DELETE /roles/:roleId/employees/:employeeId    👑

GET    /audit                            💼        `AUDIT`
```

### لوحة مالك المنصة  🏢 *(`PlatformAuthGuard` فقط — بلا `RolesGuard`/`ModuleGuard`)*
```
GET/POST/PUT/DELETE  /platform/templates(/:id)   باقات الاشتراك
GET    /platform/tenants
GET    /platform/tenants/:id
POST   /platform/tenants                          إنشاء شركة + أدمنها
PUT    /platform/tenants/:id                      الاسم + maxUsers
PUT    /platform/tenants/:id/modules              تفعيل/تعطيل الأقسام
PUT    /platform/tenants/:id/extend                تمديد الاشتراك
PUT    /platform/tenants/:id/suspend
PUT    /platform/tenants/:id/reactivate
POST   /platform/tenants/:id/logo                 multipart
POST   /platform/tenants/:id/impersonate          ⭐ يصكّ توكن أدمن الشركة
GET    /platform/tenants/:id/leave-requests
DELETE /platform/tenants/:id/leave-requests/:requestId   ⭐ إخفاء لا حذف
GET    /platform/tenants/:id/platform-audit       سجل تدقيق مالك المنصة
```

### الاشتراكات (Stripe)
```
POST   /subscriptions/checkout           🔓
POST   /subscriptions/portal             🔓
POST   /subscriptions/webhook            عام — يتحقق بتوقيع Stripe
```

---

## 7. منطق الأعمال الجوهري

### 7.1 خوارزمية تدوير الشفتات

**المفهوم:** الموظفون يُوزَّعون على **مجموعات** (حتى 8)، والخطة تُعرَّف كسلسلة **خطوات** (شفت + عدد أيامه). كل مجموعة تبدأ من إزاحة مختلفة لضمان تغطية كل الشفتات في نفس اليوم.

```ts
interface Slot      { shiftId: string | null; start: number; len: number }  // null = راحة
interface StepInput { shiftId: string; days: number }
```

#### بناء الكتل

```ts
buildStepSlots(steps) {          // كتلة لكل خطوة بعدد أيامها الخاص
  let acc = 0
  for (const step of steps) {
    slots.push({ shiftId: step.shiftId, start: acc, len: max(1, step.days) })
    acc += len
  }
  return { stepSlots, stepsCycle: acc }
}
```

#### أوضاع الراحة الثلاثة

| الوضع | السلوك |
|---|---|
| **`AT_ROTATION`** | راحة عند القلبة — تُضاف كتلة راحة بطول `restDays` بعد كل الخطوات |
| **`WEEKLY`** | راحة أسبوعية ثابتة — أيام `weeklyRestDays` (0=الأحد..6=السبت) تُصفَّر دائماً |
| **`AFTER_N_DAYS`** | راحة بعد عدد أيام عمل محدد (`workDaysBeforeRest`) |

#### حساب شفت المجموعة

**لـ `AT_ROTATION` و`WEEKLY`:**
```ts
slotFor(slots, cycle, gi, dayIndex) {
  const offset = slots[gi % slots.length].start        // إزاحة المجموعة
  const pos = ((dayIndex + offset) % cycle + cycle) % cycle
  return slots.find(s => pos >= s.start && pos < s.start + s.len)?.shiftId ?? null
}
```

**لـ `AFTER_N_DAYS`** — الأدق منطقياً:
```ts
afterNDaysShiftFor(stepSlots, stepsCycle, workPeriod, restDays, groupCount, gi, dayIndex) {
  const outerCycle  = workPeriod + restDays
  const groupOffset = floor((gi * outerCycle) / groupCount)
  const shifted     = dayIndex + groupOffset
  const pos         = ((shifted % outerCycle) + outerCycle) % outerCycle
  if (pos >= workPeriod) return null                   // يوم راحة

  // ⭐ دورة الشفتات تراكمية عبر فترات العمل — لا تُعاد من الصفر
  const fullCycles   = floor(shifted / outerCycle)
  const workDayIndex = fullCycles * workPeriod + pos
  const stepPos      = ((workDayIndex % stepsCycle) + stepsCycle) % stepsCycle
  return stepSlots.find(s => stepPos >= s.start && stepPos < s.start + s.len)?.shiftId ?? null
}
```

> **لماذا التراكم مهم:** `workPeriod` مستقل تماماً عن `stepsCycle`. لو كانت فترة العمل أقصر من دورة الشفتات، فبدون التراكم ستُسقَط الشفتات المتأخرة في الترتيب نهائياً ولن يعمل عليها أحد أبداً.

#### المعاينة مقابل التطبيق ⚠️

هذا **أهم مفهوم في الوحدة**:

| العملية | الأثر |
|---|---|
| `preview()` | **حساب في الذاكرة فقط** — لا يكتب شيئاً في قاعدة البيانات |
| `apply()` | **يكتب صفوف `EmployeeShift` فعلية** — هنا فقط يظهر الجدول للموظف |

> إنشاء خطة وتوزيع موظفين عليها **لا يُنتج أي جدول**. لا بد من ضغط "تطبيق". هذا سبب شكوى "الجدول لا يظهر للموظف" — لم تكن علّة برمجية.

**آلية `apply(days: 7|14|30)`:**
```
1. احذف EmployeeShift المتداخلة كلياً مع الفترة
2. اقطع (effectiveTo) التعيينات التي تبدأ قبل الفترة
3. حوّل أعمدة المصفوفة إلى فترات متصلة لكل مجموعة (للمتناوبين)
4. الأعضاء المثبَّتون (pinnedShiftId): تعيين واحد ثابت طوال الفترة
```

### 7.2 منع تعارض الخطط

**المشكلة الجذرية:** `EmployeeShift` **لا يحمل `planId`**. عند التطبيق تعتمد الفلترة على `employeeId` + التداخل الزمني فقط ⇒ تُستبدَل تعيينات خطة أخرى **بصمت**، ويبقى الموظف بلا شفت بعد انتهاء الفترة الجديدة.

**الحل المطبَّق:**
```ts
crossPlanConflicts(tenantId, planId, employeeIds) {
  // يجد الموظفين الأعضاء في مجموعة ضمن خطة أخرى (planId: { not: planId })
  // ⇒ يُستبعدون من addMembers() و distribute()، وتُعاد قائمة blocked
}
```

**تنبيه التغطية:** `preview()` يُعيد `uncoveredActive` — الموظفون النشطون غير المنضمين للخطة وليس لديهم إجازة معتمدة متداخلة زمنياً مع فترة التطبيق.

### 7.3 قواعد الحضور والانصراف

كل وردية تحمل قواعدها الخاصة. حدود الوردية تتعامل مع الشفت الليلي:

```ts
shiftBounds(dateStr, shift) {
  const start = new Date(`${dateStr}T${shift.startTime}`)
  let   end   = new Date(`${dateStr}T${shift.endTime}`)
  if (end <= start) end = new Date(end + DAY_MS)   // ⭐ شفت ليلي يعبر منتصف الليل
  return { start, end }
}
```

| الحساب | القاعدة |
|---|---|
| **التأخير** | `checkIn - shiftStart` (بحد أدنى 0) |
| **الإضافي (مع شفت)** | `checkOut - shiftEnd` (بحد أدنى 0) |
| **الإضافي (بلا شفت)** | `worked - 480` دقيقة (دوام ثابت 8 ساعات) |
| **"متأخر"؟** | `lateMinutes > shift.lateAfterMinutes` |
| **أبكر حضور مسموح** | `shiftStart - checkInWindowMinutes` |
| **أبكر انصراف مسموح** | `shiftEnd - checkOutEarlyMinutes` |
| **"غياب متوقع"** | لا سجل و `now > shiftStart + absentAfterMinutes` (أو التاريخ ماضٍ) |

### 7.4 احتساب مسير الرواتب

```ts
absenceDeduction = absentDays > 0
  ? (baseSalary / workingDaysInMonth) * absentDays : 0

lateDeduction = lateMinutes > 0
  ? (baseSalary / workingDaysInMonth / 8 / 60) * lateMinutes : 0

netSalary = max(0, baseSalary + allowances - deductions - absenceDeduction - lateDeduction)
```

### 7.5 مسار الاعتماد — لا موافقة تلقائية أبداً ⭐

**المبدأ:** إن لم يوجد موافق مؤهّل لخطوة، تُتخطّى (`SKIPPED`) لا تُعتمد. وإن استُنفدت كل الخطوات، **يُصعَّد** الطلب.

```ts
advance(caseId, requester) {
  while (current?.status === 'PENDING') {
    const eligible = resolveEligibleApprovers(tenantId, current.step, requester)
    if (eligible.length > 0)
      return { caseStatus: 'PENDING', ... }         // توقّف بانتظار قرار

    markAction(current, 'SKIPPED')                   // لا موافق ⇒ تخطٍّ
    const next = actions.find(a => a.order === current.order + 1)
    if (!next) return escalateFallback(caseId, tenantId)   // ⭐ لا اعتماد تلقائي
    current = next
  }
}

escalateFallback(caseId, tenantId) {
  if (hr_manager موجود)  → fallbackTier = 'HR'
  if (super_admin موجود) → fallbackTier = 'SUPER_ADMIN'
  // لا أحد إطلاقاً ⇒ يبقى معلّقاً بلا معتمد — أفضل من اعتماده تلقائياً
}
```

**أنواع الموافقين (`ApproverKind`):**
| النوع | كيف يُحدَّد |
|---|---|
| `ROLE` | أي موظف يحمل `roleId` المحدد |
| `DEPT_HEAD` | `Department.headEmployeeId` لقسم مقدّم الطلب |
| `BRANCH_MANAGER` | `Branch.managerEmployeeId` لفرع مقدّم الطلب |

### 7.6 أنواع إجازات نظام العمل السعودي

تُبذر عبر `POST /leaves/types/seed-saudi-defaults` (لا تُكرَّر الموجود بالاسم):

| النوع | المادة | الأيام | الاحتساب |
|---|---|---|---|
| الإجازة السنوية | 109 | 21 / 30 | `SENIORITY_BASED` (عتبة 5 سنوات) |
| الإجازة المرضية | 117 | 30 كامل + 60 بـ75% + 30 بلا راتب | `SICK_TIERED` |
| إجازة الوضع (الأمومة) | 151 | 84 | `PER_EVENT` |
| إجازة الأبوة | 113/أ | 3 | `PER_EVENT` |
| إجازة الحج | 113 | 10 | `ONCE_PER_EMPLOYMENT` |
| إجازة الزواج | 113/ب | 3 | `PER_EVENT` |
| إجازة الوفاة | 113/ج | 3 | `PER_EVENT` |
| إجازة العدة | 160 | 130 | `PER_EVENT` |
| الإجازة الدراسية | 115 | 30 | `FIXED` |

**منطق `autoAssignBalances`:**
```ts
SENIORITY_BASED     → yearsService >= threshold ? maxDays : (minDays ?? maxDays)
SICK_TIERED         → maxDays (أيام الراتب الكامل فقط كرصيد أساسي)
FIXED               → maxDays
ONCE_PER_EMPLOYMENT → 0 إن وُجد رصيد مستخدم سابقاً أو طلب معتمد غير مخفي، وإلا maxDays
PER_EVENT           → تُتخطّى — تُمنح يدوياً عند وقوع الحدث
```

### 7.7 مبدأ "لا حذف فعلي" ⭐

**القاعدة:** أي سجل له ريكورد **لا يُمسح** — يُخفى عن الشركة ويبقى كاملاً لدى مالك المنصة.

```ts
deleteTenantLeaveRequest(tenantId, requestId) {
  if (status !== APPROVED && status !== PENDING) throw   // المرفوضة لا تُحذف
  if (status === APPROVED) restoreLeaveBalance()          // إعادة الأيام المخصومة
  update({ hiddenFromTenant: true })                      // ⭐ لا delete
  logPlatformAction(tenantId, 'LEAVE_REQUEST_DELETE', ...)  // سجل مالك المنصة فقط
}
```

**نقاط الفلترة الإلزامية** (كل قراءة من جانب الشركة):
```ts
getRequests()        → where: { hiddenFromTenant: false }
ONCE_PER_EMPLOYMENT  → where: { status: 'APPROVED', hiddenFromTenant: false }
```
> نسيان أي نقطة فلترة يجعل السجل "المحذوف" يظهر أو يؤثر في الحسابات.

**فصل سجلات التدقيق:**
| السجل | ماذا يحوي |
|---|---|
| `AuditLog` (الشركة) | إجراءات موظفي الشركة فقط — **لا شيء من مالك المنصة إطلاقاً** |
| `PlatformAuditLog` | `TENANT_IMPERSONATE` · `LEAVE_REQUEST_DELETE` — **لا تراه الشركة أبداً** |

### 7.8 انتحال شخصية أدمن الشركة

بدل بناء شاشات CRUD مكرّرة لمالك المنصة، يصكّ النظام **توكن دخول تينانت** لأدمن الشركة:

```ts
const IMPERSONATION_TTL = '15m'

impersonateTenant(tenantId, platformAdminId) {
  const admin = employee.findFirst({
    where: { tenantId, status: 'ACTIVE',
             employeeRoles: { some: { role: { name: 'super_admin' } } } },
    orderBy: { createdAt: 'asc' },
  })
  const payload: JwtPayload & { impersonatedBy: string } = {
    sub: admin.id, tenantId, email: admin.email ?? '',
    roles: admin.employeeRoles.map(er => er.role.name),
    modules: tenant.enabledModules,
    impersonatedBy: platformAdminId,        // يميّزه عن تسجيل دخول حقيقي
  }
  logPlatformAction(tenantId, 'TENANT_IMPERSONATE', admin.id, { platformAdminId, ... })

  // بلا refreshToken إطلاقاً — الجلسة تنتهي وحدها ولا تُمدَّد
  return { accessToken: sign(payload, { expiresIn: IMPERSONATION_TTL }), expiresIn: IMPERSONATION_TTL }
}
```

**قيود أمنية مقصودة تميّزه عن تسجيل الدخول العادي:**

| القيد | السبب |
|---|---|
| **بلا `refreshToken`** | لا يمكن تمديد الجلسة أياماً بلا رجوع للوحة المنصة |
| **عمر 15 دقيقة** | نافذة تعرّض ضيّقة، تنتهي وحدها |
| **`impersonatedBy` في الحمولة** | يميّز الجلسة عن دخول حقيقي وينسبها لمالك المنصة |

**تدفق الواجهة:** زر في لوحة المنصة ⇒ `window.open('/impersonate?t=...')` ⇒ صفحة جسر تخزّن التوكن، **تمسح أي `refresh_token` سابق** (حتى لا تُمدَّد الجلسة)، وتنظّف الرابط بـ `history.replaceState` ⇒ تحويل للوحة التحكم.

عند انتهاء الـ15 دقيقة يفشل أول طلب بـ401، ويحاول `api.ts` التجديد فلا يجد `refresh_token` ⇒ يمسح الجلسة ويحوّل لتسجيل الدخول. تدهور آمن بلا تعليق.

> ⚠️ **يبقى قوياً:** يمنح أدمن كامل لأي شركة بضغطة واحدة بلا كلمة مرور. مُسجَّل في سجل مالك المنصة، لكن **لا يزال بلا إبطال فوري للجلسة الجارية ولا تنبيه للشركة** — انظر §11.2.

### 7.9 سجل التدقيق التلقائي

`AuditInterceptor` مسجَّل عالمياً (`APP_INTERCEPTOR`) ويلتقط **كل** تعديل بيانات ناجح، بدل الاعتماد على تذكّر كل خدمة أن تسجّل يدوياً.

```ts
const AUDITED = { POST: 'CREATE', PUT: 'UPDATE', PATCH: 'UPDATE', DELETE: 'DELETE' }

intercept(context, next) {
  if (!AUDITED[req.method]) return next.handle()          // القراءات لا تُسجَّل
  if (@SkipAudit موجود) return next.handle()               // الخدمة تسجّل يدوياً
  if (!req.user?.tenantId) return next.handle()            // مسارات المنصة/المصادقة
  return next.handle().pipe(tap(res => void this.write(...)))   // بعد النجاح فقط
}
```

**ما يُسجَّل:** `tenantId · employeeId · action · module · entityId · newData · ipAddress · impersonatedBy`
- `module` = أول مقطع في المسار (`/api/v1/employees/123` ⇒ `employees`)
- `entityId` = `params.id` أو `params.requestId` أو `response.id`
- `newData` = `{ _path, _method, body }` بعد الحجب

**ثلاثة ضمانات إلزامية:**

| الضمان | التنفيذ |
|---|---|
| **لا تسريب أسرار** | حجب تكراري لكل مفتاح في `REDACT` (`password`, `passwordHash`, `token`, `secret`...) مهما كان عمقه ⇒ `[محجوب]` |
| **لا يُفشل الطلب** | الكتابة داخل `try/catch` تُسجّل تحذيراً فقط — سجل التدقيق لا يجوز أن يُسقط عملية ناجحة |
| **لا يتضخّم** | جسم أكبر من 4000 حرف يُستبدل بـ`{ _truncated, _size }` (عمليات الاستيراد الجماعي) |

**`@SkipAudit()`** — للمسارات التي تسجّل يدوياً بتفاصيل أغنى. حالياً `PUT/DELETE /attendance/:id` فقط، لأنهما يلتقطان `oldData` وهو ما لا يستطيعه الـinterceptor (لا يرى الحالة قبل التعديل).

> **حدّ مقصود:** `oldData` يبقى `null` في التسجيل التلقائي. من يحتاج المقارنة قبل/بعد يسجّل يدوياً ويوسم المسار بـ`@SkipAudit()`.

---

## 8. الواجهة الأمامية

### 8.1 هيكل المسارات

```
/(auth)/login                     تسجيل دخول الشركة
/(dashboard)/
  dashboard                       لوحة التحكم (KPIs · تغطية الورديات · النشاط الأخير)
  me                              صفحتي — 8 تبويبات (نظرة عامة · موافقاتي · حضوري ·
                                  جدولي · راتبي · إجازاتي · عهدتي وبدلتي · مباشرتي)
  employees · employees/new · employees/[id] · [id]/edit · [id]/salary
  departments · branches · job-titles
  attendance · shifts · leaves · payroll
  custody · uniforms · onboarding
  approvals · roles · audit · settings
/impersonate                      صفحة جسر دخول مالك المنصة
/platform/
  login · dashboard · tenants · plans
```

### 8.2 عملاء الـ API

| الملف | الغرض |
|---|---|
| `lib/api.ts` | عميل axios للموظف — `access_token` + تجديد تلقائي عند 401 |
| `lib/platform-api.ts` | عميل **منفصل تماماً** لمالك المنصة — `platform_access_token`، وعند 401 يحوّل لـ `/platform/login` |
| `lib/auth.ts` | قراءة الأدوار/الوحدات من الـ JWT على العميل |

```ts
// lib/auth.ts
decodeToken()  getRoles()  getUserId()
isManager()  isHR()  isSuperAdmin()
getModules()  hasModule(module)
```

> **الواجهة تخفي فقط، والخادم يمنع فعلاً.** إخفاء عنصر في القائمة الجانبية ليس حماية.

### 8.3 اصطلاحات التصميم

- **RTL كامل** — `dir="rtl"`، والنصوص كلها عربية.
- **متغيرات CSS للثيم** (تدعم الوضع الليلي):
  `--surface` `--surface-2` `--ink` `--ink-2` `--ink-3` `--line` `--brand` `--brand-soft`
  `--good` `--good-soft` `--warn` `--warn-soft` `--crit` `--crit-soft` `--shadow`
- **التواريخ:** `toLocaleDateString('ar-SA')` — وللميلادي `'ar-SA-u-ca-gregory'`.
- **الحالات** تُعرض كشارات ملوّنة (`rounded-full` + `*-soft` خلفية).

---

## 9. خطة إعادة البناء بالترتيب

### المرحلة 0 — الأساس
```bash
npx create-turbo@latest shift-saas
# apps/api (NestJS) · apps/web (Next.js) · packages/database · packages/types
```
1. `packages/types` — `JwtPayload` · `AuthTokens` · `ApiResponse` · `ShiftScheduleEntry`
2. `packages/database` — مخطط Prisma كاملاً (§4) ثم `prisma db push`
3. `.env` بكل المتغيرات (§3)

### المرحلة 1 — المصادقة والعزل *(لا شيء يعمل بدونها)*
1. `AuthModule` — `JwtStrategy` · `JwtAuthGuard` · login/refresh
2. `PlatformAuthModule` — `PlatformJwtStrategy` · `PlatformAuthGuard` · login/bootstrap
3. `common/guards/roles.guard.ts` + `decorators/roles.decorator.ts`
4. `common/guards/module.guard.ts` + `decorators/requires-module.decorator.ts`
5. `common/auth.util.ts` — `isManager` · `isHR` · `assertSelfOr*`
6. `common/decorators/current-user.decorator.ts`

### المرحلة 2 — لوحة مالك المنصة *(تُنشئ الشركات — يجب أن تسبق كل شيء)*
`PlatformModule` كاملاً: الباقات · إنشاء شركة (+ الأدوار الأربعة + أدمن الشركة) · تفعيل الوحدات · التمديد/التعليق · الشعار.

### المرحلة 3 — الهيكل والموظفون *(أساس كل الوحدات)*
`branches` → `departments` → `job-titles` → `employees` → `salary` → `roles`

### المرحلة 4 — الوحدات التشغيلية
```
shifts  →  attendance  →  rotations     (تعتمد على الشفتات)
leaves  →  approvals                    (تعتمد على الأدوار والهيكل)
custody · uniforms · onboarding
payroll                                 (تعتمد على الحضور + الرواتب)
audit
```

### المرحلة 5 — الواجهة
1. `lib/api.ts` · `lib/platform-api.ts` · `lib/auth.ts`
2. `login` → `layout` + `sidebar` (مصفّاة بـ `hasModule`)
3. `dashboard` → `me` → بقية الصفحات
4. `platform/*` → `impersonate`

### المرحلة 6 — البذر والتحقق
```
POST /platform-auth/bootstrap             أول مالك منصة
POST /platform/tenants                    أول شركة + أدمنها
POST /roles/seed-defaults                 الأدوار الأربعة
POST /leaves/types/seed-saudi-defaults    أنواع نظام العمل
POST /approvals/workflows/seed-defaults   مسارات الاعتماد
```

---

## 10. قواعد ثابتة وأخطاء معروفة

### 10.1 قواعد إلزامية

1. **`RolesGuard` يمنع افتراضياً** — كل مسار تحته يحتاج `@Roles(...)` أو `@AnyEmployee()`، وإلا رُفض بـ403. ولا تضع `@AnyEmployee()` إلا مع تقييد فعلي للنطاق داخل المعالج (`u.sub` أو `assertSelfOr*`).
2. **`tenantId` من الـ JWT دائماً** — لا من body أو query أبداً.
3. **ممنوع `updateMany`/`deleteMany` غير مقيّدة النطاق** — استعلم أولاً (قراءة) لتحديد الـ IDs بدقة، ثم قيّد الكتابة بها.
4. **تعليقات Prisma:** `//` فقط. `/* */` تسبب خطأ `P1012` عند `db push`.
5. **بعد أي تعديل خلفي:** تحقق بطلب حقيقي (curl / `Invoke-RestMethod`). نجاح الـ compile وتسجيل الـ route في اللوجات **لا يكفي**.
6. **`hiddenFromTenant: false`** في كل استعلام يقرأ `LeaveRequest` من جانب الشركة.

### 10.2 فخّ `undefined` مقابل `''` في التعديل

```ts
// خطأ شائع: ترك حقل اختياري فارغاً لا يمسحه فعلياً
undefined  ⇒ لا تغيير
''         ⇒ يجب أن يصبح null

emptyToNull(v) { return v === '' ? null : v }
// وللحقول التي قد تُمسح، افحص وجود المفتاح لا قيمته:
if ('managerEmployeeId' in data) upd.managerEmployeeId = emptyToNull(data.managerEmployeeId)
```
> بدون فحص `'key' in data`، تعديل اسم الفرع فقط كان **يمسح مدير الفرع المعيَّن**.

### 10.3 فخّ المسح قبل التحقق من البديل

```ts
// ❌ خطأ: يُفرغ الخطة بالكامل إن لم يتبقَّ أحد
await deleteMany({ where: { group: { planId } } })
await createMany({ data: toDistribute })

// ✅ صواب
if (toDistribute.length) { await deleteMany(...); await createMany(...) }
```
> هذه العلّة فرّغت خطة حقيقية (11 عضوية) أثناء الاختبار.

### 10.4 فحص كل القيود المرجعية قبل الحذف

حذف `LeaveType` كان يفحص `LeaveRequest` **وينسى `LeaveBalance`** ⇒ خطأ 500 عام بدل رسالة واضحة.

```ts
const reqCount = await leaveRequest.count({ where: { leaveTypeId: id } })
if (reqCount) throw new BadRequestException(`لا يمكن الحذف — يوجد ${reqCount} طلب مرتبط`)
const balCount = await leaveBalance.count({ where: { leaveTypeId: id } })
if (balCount) throw new BadRequestException(`لا يمكن الحذف — يوجد ${balCount} رصيد مسند`)
```

### 10.5 أخطاء تاريخية أُصلحت

| العلّة | السبب | الإصلاح |
|---|---|---|
| تسجيل دخول غير حتمي | موظفون بنفس البريد + `findFirst` بلا `orderBy` | `@unique` على `email` + تنظيف البيانات |
| مسح مدير الفرع عند تعديل الاسم | تحديث غير مشروط لـ `managerEmployeeId` | فحص `'key' in data` |
| حقول اختيارية لا تُمسح | خلط `undefined` بـ `''` | `emptyToNull()` |
| "زر التعديل لا يعمل" | النموذج أعلى الصفحة والجدول أسفلها | `scrollIntoView` — كانت مشكلة UX لا خللاً |
| تسريب الرواتب والهويات | `@Get` بلا `@Roles` + الحارس يسمح افتراضياً | قلب الحارس للمنع الافتراضي (§11.3) |
| أي موظف يعتمد أي طلب مباشرة | المسار الاحتياطي في `onboarding.decide` بلا فحص | `isManager` — مطابقاً للإجازات والبدلات |
| قراءة مسار اعتماد شركة أخرى | `getTrail` بلا `tenantId` | تقييد الاستعلام بالشركة |

### 10.6 ملاحظات بيئة التطوير (Windows)

- **الـ API بلا file-watch** — أعد تشغيله يدوياً بعد كل تعديل خلفي.
- أوامر `npm`/`npx`/`node`/Prisma تعمل عبر **PowerShell**؛ احتفظ بـ Bash لأوامر git.
- عند استخدام PowerShell لأوامر Prisma **حمّل `.env` يدوياً**:
  ```powershell
  Get-Content .env | ForEach-Object {
    if ($_ -match '^\s*([^#=]+?)\s*=\s*(.*)\s*$') {
      $name = $matches[1]; $value = $matches[2] -replace '^"(.*)"$', '$1'
      Set-Item -Path "Env:$name" -Value $value
    }
  }
  ```

---

## 11. ⚠️ نقاط ضعف تصميمية — لا تنسخها

> الأقسام ١–١٠ تصف النظام **كما هو فعلاً**، لأن الوثيقة مرجع دقيق.
> هذا القسم يصف ما **لا ينبغي نسخه** لو أُعيد البناء من الصفر. كل نقطة موثّقة بدليل من الكود.

### 11.1 `EmployeeShift` بلا ربط بالخطة 🔴

**الدليل:** النموذج يحوي `employeeId · shiftId · effectiveFrom · effectiveTo` فقط — **لا `planId`**.

**الأثر:** لا يمكن معرفة أي خطة أنشأت أي تعيين. عند تطبيق خطة جديدة تعتمد الفلترة على `employeeId` + التداخل الزمني فقط، فتُستبدَل تعيينات خطة أخرى **بصمت**. الحل الحالي (`crossPlanConflicts`) يعالج العرَض بمنع العضوية المزدوجة، لا السبب.

**التوصية:**
```prisma
model EmployeeShift {
  // ...
  rotationPlanId String?   // من أنشأ هذا التعيين
  appliedAt      DateTime?
  plan RotationPlan? @relation(fields: [rotationPlanId], references: [id])
  @@index([tenantId, employeeId, effectiveFrom])
}
```
عندها يصبح التطبيق قادراً على استبدال تعيينات خطته فقط، وعرض تعارض صريح بدل الكتابة فوق عمل خطة أخرى.

### 11.2 توكن الانتحال — 🟡 مُعالَج جزئياً

**✅ ما عولج** (مُطبَّق ومُتحقَّق منه):

| القيد | التحقق |
|---|---|
| حذف `refreshToken` نهائياً | حقول الاستجابة: `accessToken · expiresIn · adminName` — لا `refreshToken` |
| عمر ثابت 15 دقيقة غير قابل للتمديد | `exp - iat = 15` دقيقة |
| `impersonatedBy` في الحمولة | يطابق `sub` مالك المنصة |
| تسجيل `platformAdminId` في سجل المنصة | مسجَّل في `details` |
| مسح `refresh_token` سابق في صفحة الجسر | يمنع تمديد الجلسة عند انتهائها |

| **`impersonatedBy` يُستهلَك فعلياً** | `AuditInterceptor` يكتبه في كل سجل ⇒ الإجراء منسوب لمالك المنصة (§11.5) |

**🔴 ما تبقّى:**
- **لا إبطال فوري** — لا يمكن قطع جلسة انتحال جارية قبل انتهاء الـ15 دقيقة.
- **لا تنبيه للشركة** بأن أحداً دخل بصلاحيات أدمنها.
- **لا شارة في الواجهة** تُذكّر مالك المنصة بأنه يتصفّح كشركة أخرى.

**الخطوات المتبقية:**
```ts
// 1. شارة دائمة في الواجهة: "أنت تتصفّح كمالك منصة — الشركة: س"
// 2. جدول ImpersonationSession قابل للإبطال (بدل الاعتماد على انتهاء التوكن وحده)
// 3. إشعار الشركة بحدوث الانتحال
```

### 11.3 `RolesGuard` مقلوب المنطق — ✅ عولج

**كان:** يُرجع `true` عند غياب `@Roles()` ⇒ أي مسار جديد يُنشأ مكشوفاً بصمت. تسبّب فعلاً في انكشاف كل الرواتب وأرقام الهويات لأي موظف.

**الإصلاح المُطبَّق:** قُلب المنطق إلى **منع افتراضي** (§5.4)، وأُضيف `@AnyEmployee()` كتصريح صريح للمسارات الذاتية. وُسِم **25 مساراً** كانت تعتمد على السماح الضمني.

**التحقق (19 فحصاً بطلبات حقيقية):**

| الفئة | النتيجة |
|---|---|
| 9 مسارات ذاتية بموظف بلا أدوار | 200 ✅ |
| 4 مسارات إدارية بموظف بلا أدوار | 403 ✅ |
| نفسها بدور `super_admin` | 200 ✅ |
| 3 مسارات بيانات موظف آخر | 403 ✅ |

**🟡 ما تبقّى:** التصريح يُفرض بمراجعة بشرية. للحماية من الانحدار يُستحسن اختبار تلقائي يمسح كل المسارات ويفشل إن وُجد مسار بلا وسم — نفس منطق السكربت المستخدم في التحقق.

### 11.3.1 ثغرتان اكتُشفتا أثناء هذا الإصلاح — ✅ عولجتا

قلب الحارس كشف مسارين كانا يعتمدان على السماح الضمني **وبلا أي فحص داخلي**:

**أ) تصعيد صلاحيات في اعتماد المباشرات** 🔴

`onboarding.decide()` في مساره الاحتياطي (بلا مسار اعتماد مُهيّأ) كان يعتمد الطلب **بلا أي فحص صلاحية** — أي موظف يعتمد أي طلب مباشرة، بما فيه طلبه هو. نظيراه في الإجازات والبدلات كانا محميّين بـ`isManager`؛ المباشرات وحدها سقطت.

```ts
// أُضيف — مطابقاً لسلوك الإجازات والبدلات
if (!isManager(actor)) throw new ForbiddenException('ليس لديك صلاحية اعتماد طلبات المباشرة')
```
**التحقق:** موظف بلا أدوار → `403` والطلب بقي `PENDING` · نفس العملية بـ`hr_manager` → `200`.

**ب) تسريب مسار الاعتماد عبر الشركات** 🔴

`getTrail(requestType, requestId)` كان يبحث في `ApprovalCase` **بلا `tenantId` إطلاقاً** — أي موظف يقرأ مسار اعتماد طلب في **شركة أخرى** (أسماء المعتمدين، أكوادهم، ملاحظاتهم). حماية الـUUID وحدها ليست تحكّماً بالوصول.

```ts
// قبل: findUnique({ where: { requestType_requestId: {...} } })
// بعد:  findFirst({ where: { tenantId, requestType, requestId } })
```
**التحقق:** طلب من شركة أخرى (بعد تفعيل وحدتها مؤقتاً لتجاوز `ModuleGuard`) → `null` · نفسه من داخل الشركة → البيانات كاملة.

> **الدرس:** السماح الافتراضي لم يكن ثغرة واحدة بل **غطاءً** أخفى ثغرات أخرى. قلب المنطق كشفها.

### 11.4 الحذف الناعم يعتمد على التذكّر 🟠

**الدليل:** `hiddenFromTenant` مطبَّق على `LeaveRequest` فقط، ويُفرَض بإضافة `hiddenFromTenant: false` **يدوياً في كل موضع قراءة**. حالياً موضعان (`getRequests` + فحص `ONCE_PER_EMPLOYMENT`).

**الأثر:** أي استعلام جديد ينسى الفلتر ⇒ يظهر سجل "محذوف" أو يؤثر في الحسابات. والنمط غير قابل للتوسّع على 34 نموذجاً آخر.

**التوصية:** فلترة مركزية عبر Prisma Client Extension بدل التكرار اليدوي:
```ts
prisma.$extends({
  query: {
    $allModels: {
      async findMany({ args, query }) {
        if (!args.where?.includeHidden) args.where = { ...args.where, hiddenFromTenant: false }
        return query(args)
      },
    },
  },
})
```
مع اصطلاح موحّد (`deletedAt: DateTime?`) عبر كل النماذج التي تحتاج حذفاً ناعماً.

### 11.5 `AuditLog` شبه معطّل — ✅ عولج

**كان:** `prisma.auditLog.create` مستدعاة من **ملف واحد فقط** (`attendance.service.ts`) من أصل **21 وحدة**. صفحة "سجل التدقيق" توحي بتغطية شاملة بينما لا تغطي إلا الحضور — إنشاء موظف، تعديل راتب، حذف شفت، اعتماد إجازة: **لا شيء منها مسجَّل**.

**الإصلاح المُطبَّق:** `AuditInterceptor` عام (§7.9) يلتقط كل `POST/PUT/PATCH/DELETE` ناجح تلقائياً، مع حجب الأسرار وحدّ للحجم واستثناء `@SkipAudit()`. وأُضيف عمود `impersonatedBy` + فهرس `[tenantId, createdAt]` (migration `20260805140000`).

**التحقق (9 فحوصات بطلبات حقيقية):**

| الفحص | النتيجة |
|---|---|
| إنشاء مسمّى وظيفي | `CREATE / job-titles / entityId ✔ / ip ✔` |
| إنشاء موظف **بكلمة مرور** | سُجّل، والكلمة ظهرت `[محجوب]` |
| تعديل داخل جلسة انتحال | `impersonatedBy = pf-admin-x` |
| نفس التعديل عادياً | `impersonatedBy = null` |
| تعديل من لوحة المنصة | لم يُضِف لسجل الشركة |
| تعديل حضور (`@SkipAudit`) | سجل واحد لا اثنان |

التغطية انتقلت من وحدة واحدة إلى تسجيل كل الوحدات تلقائياً.

**🟡 ما تبقّى:** `oldData` لا يُلتقط تلقائياً (حدّ بنيوي — الـinterceptor لا يرى الحالة قبل التعديل). من يحتاجها يسجّل يدوياً ويوسم بـ`@SkipAudit()` كما في الحضور.

### 11.6 `Role.name` بلا قيد تفرّد — ✅ عولج

**كان:** `model Role { id, tenantId, name }` بلا أي قيد — لا شيء يمنع صفَّي `super_admin` في نفس الشركة، والكود يقارن بالنص الحرفي (`role.name === 'super_admin'`) ⇒ الخطأ يظهر كفقدان صلاحيات غامض لا كخطأ صريح.

**الإصلاح المُطبَّق:**
```prisma
model Role {
  // ...
  @@unique([tenantId, name])
}
```
migration: `20260805110000_role_unique_name_per_tenant`

**التحقق:** فُحصت البيانات القائمة أولاً (**0 تكرار** في 8 صفوف) قبل تطبيق القيد، ثم جرت محاولة إنشاء دور `super_admin` مكرر ⇒ **رُفضت بـ`P2002`**.

**🟡 ما تبقّى:** أسماء الأدوار ما زالت نصوصاً متناثرة في الكود. يُستحسن ثابت مشترك في `packages/types`:
```ts
export const SYSTEM_ROLES = { SUPER_ADMIN: 'super_admin', HR: 'hr_manager', ... } as const
```

### 11.7 `Employee.email` فريد عالمياً 🟡

**الدليل:** `email String? @unique` — تفرّد عالمي لا لكل شركة، والتعليق في المخطط يوضّح السبب: "تسجيل الدخول يبحث بالبريد فقط بلا تحديد شركة".

**الأثر:** **الشخص الواحد لا يمكن أن يكون موظفاً في شركتين** على المنصة. قيد حقيقي في نظام متعدد المستأجرين (مستشار يخدم عدة شركات، أو مجموعة شركات شقيقة).

**المقايضة:** التفرّد العالمي يُبسّط تسجيل الدخول (بلا اختيار شركة). لو احتجت دعم تعدد الانتماء:
```prisma
@@unique([tenantId, email])   // بدل @unique العالمي
```
وحينها يحتاج تسجيل الدخول خطوة اختيار شركة عند تطابق البريد في أكثر من واحدة.

### 11.8 ملخص الأولويات

| # | النقطة | الخطورة | الجهد | الحالة |
|---|---|---|---|---|
| 11.1 | `EmployeeShift` بلا `planId` | 🔴 سلامة بيانات | منخفض | **مفتوح** — أعلى أولوية متبقية |
| 11.4 | الحذف الناعم يدوي | 🟠 سلامة بيانات | متوسط | **مفتوح** — يلزم قبل تعميم "لا حذف" |
| 11.7 | البريد فريد عالمياً | 🟡 وظيفي | مرتفع | مفتوح — قرار تصميمي لا خلل |
| 11.2 | توكن الانتحال | 🔴 أمني | منخفض | 🟡 **عولج جزئياً** — بقي الإبطال والتنبيه |
| 11.3 | `RolesGuard` مقلوب | 🔴 أمني | متوسط | ✅ **عولج** |
| 11.3.1أ | تصعيد صلاحيات المباشرات | 🔴 أمني | منخفض | ✅ **عولج** |
| 11.3.1ب | تسريب مسار الاعتماد عبر الشركات | 🔴 أمني | منخفض | ✅ **عولج** |
| 11.5 | `AuditLog` معطّل | 🟠 امتثال | متوسط | ✅ **عولج** |
| 11.6 | `Role` بلا تفرّد | 🟠 صحة | منخفض جداً | ✅ **عولج** |

> **الأولوية التالية الموصى بها:** §11.1 (`EmployeeShift` بلا `planId`) — جهد منخفض وأثره مباشر على سلامة بيانات الجدولة، وهو السبب الجذري الذي عالجنا عرَضه فقط بمنع العضوية المزدوجة.

---

## ملحق — مواضع الملفات المرجعية

| المكوّن | المسار |
|---|---|
| المخطط | `packages/database/prisma/schema.prisma` |
| الأنواع المشتركة | `packages/types/src/index.ts` |
| أدوات الصلاحيات | `apps/api/src/common/auth.util.ts` |
| الحُرّاس | `apps/api/src/common/guards/{jwt-auth,roles,module,platform-auth}.guard.ts` |
| تسجيل الدخول | `apps/api/src/modules/auth/auth.service.ts` |
| خوارزمية التدوير | `apps/api/src/modules/rotations/rotations.service.ts` |
| قواعد الحضور | `apps/api/src/modules/attendance/attendance.service.ts` |
| تصعيد الاعتماد | `apps/api/src/modules/approvals/approvals.service.ts` |
| إجازات نظام العمل | `apps/api/src/modules/leaves/leaves.service.ts` |
| لوحة المنصة | `apps/api/src/modules/platform/platform.service.ts` |
| عملاء الواجهة | `apps/web/src/lib/{api,platform-api,auth}.ts` |
| تقديم الملفات الثابتة | `apps/api/src/main.ts` |
