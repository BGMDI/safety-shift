# تقرير أعمال الجلسة — نظام الشِّفتات (shift-saas)

**الفترة:** 28 – 29 يوليو 2026
**آخر commit مدفوع:** `89299ab`
**حالة العمل الحالي:** كل التعديلات أدناه **غير مُودَعة (uncommitted)** — تحتاج `git add` + `git commit`.

---

## فهرس سريع

| # | العمل | الحالة |
|---|---|---|
| 0 | دفع الـ commit المعلّق إلى GitHub | ✅ تم |
| 1 | تشخيص "الجدول لا يظهر للموظف" + اختيار مدة التطبيق | ✅ تم ومُتحقَّق |
| 2 | منع تعارض عضوية الموظف بين خطط التدوير | ✅ تم ومُتحقَّق |
| 3 | تنبيه الموظفين النشطين غير المغطّين بجدول | ✅ تم ومُتحقَّق |
| 4 | إصلاح خطأ 500 عند حذف نوع إجازة | ✅ تم ومُتحقَّق |
| 5 | حذف/تعديل أرصدة الإجازات (فردي + جماعي) | ✅ تم ومُتحقَّق |
| 6 | حذف طلبات الإجازة — لمالك المنصة حصراً | ✅ تم ومُتحقَّق |
| 7 | تحكّم كامل لمالك المنصة (انتحال شخصية الأدمن) | ✅ تم (الواجهة لم تُعايَن بصرياً) |
| 8 | لا حذف فعلي أبداً + سجل تدقيق منفصل | ✅ تم ومُتحقَّق |

---

## 0. دفع الـ commit المعلّق

كان الـ commit `89299ab` (ميزات لوحة مالك المنصة: حدود المقاعد، تفاصيل الاشتراك، هوية الشركة) عالقاً محلياً بسبب فشل مصادقة GitHub في الجلسات السابقة.

```
536ad35..89299ab  main -> main
```

نجح الدفع هذه المرة — مشكلة المصادقة انحلّت. `origin/main` يشير الآن إلى `89299ab`.

---

## 1. "الجدول لا يظهر للموظف في صفحته"

### التشخيص
**لم تكن علّة برمجية.** استدعيتُ `generateSchedule` مباشرة لموظف حقيقي (`worker@shift.com`) وأعاد الجدول صحيحاً.

**السبب الفعلي:** خطط التدوير تُنتج **معاينة** فقط. التعيينات الحقيقية (`EmployeeShift`) لا تُكتب في قاعدة البيانات إلا بعد الضغط على زر **"تطبيق"** — وهذا لم يحدث لمعظم الموظفين.

**الدليل الرقمي من قاعدة البيانات:**
- 60 عضوية في مجموعات تدوير عبر 6 خطط
- مقابل **5 تعيينات شفت فعلية نشطة** فقط

### التعديل المُنفَّذ
إضافة قائمة اختيار مدة التطبيق (**7 / 14 / 30 يوماً**) بدل القيمة الثابتة 30.

| الملف | التغيير |
|---|---|
| `apps/web/src/app/(dashboard)/shifts/page.tsx` | حالة `applyDays` + قائمة منسدلة + نص الزر ديناميكي |

> الـ backend في `rotations.controller.ts` كان يدعم باراميتر `days` مسبقاً — لم يحتج تعديلاً.

### التحقق
اختيار "7 أيام" ← تحدّث نص الزر إلى «✓ تطبيق الجدول (7 يوم)» ورسالة التأكيد إلى «تطبيق الجدول لمدة 7 يوماً على 10 موظف؟».

---

## 2. منع تعارض عضوية الموظف بين خطط التدوير

### المشكلة
`EmployeeShift` **لا يحمل أي ربط** بالخطة التي أنشأته (لا يوجد `planId`). عند تطبيق خطة جديدة، الفلترة تعتمد على `employeeId` + التداخل الزمني فقط — فتُستبدَل تعيينات الخطة الأخرى **بصمت**، ويبقى الموظف بلا شفت بعد انتهاء الفترة الجديدة.

### الحل
دالة `crossPlanConflicts` تمنع إضافة موظف عضو بالفعل في خطة تدوير **أخرى**، وتُعيد قائمة `blocked` بالاسم واسم الخطة المتعارضة.

| الملف | التغيير |
|---|---|
| `apps/api/src/modules/rotations/rotations.service.ts` | `crossPlanConflicts()` + تعديل `addMembers()` و`distribute()` |
| `apps/web/src/app/(dashboard)/shifts/page.tsx` | `showBlocked()` — تنبيه بأسماء الموظفين والخطة المتعارضة |

### التحقق
```json
POST /rotations/groups/{amn}/members  { employeeIds: ["علي محمد"] }
→ { "added": 0, "blocked": [{ "employeeName": "علي محمد", "planName": "عزوز" }] }
```
أعضاء المجموعة الهدف لم يتغيّروا.

---

## 3. تنبيه الموظفين النشطين غير المغطّين

### الحل
`preview()` تُعيد الآن `uncoveredActive`: الموظفون **النشطون** غير المنضمين للخطة و**ليس لديهم إجازة معتمدة** تتقاطع مع فترة التطبيق.

| الملف | التغيير |
|---|---|
| `apps/api/src/modules/rotations/rotations.service.ts` | `preview()` يحسب `uncoveredActive` (فحص `LeaveRequest` بحالة `APPROVED` متداخلة زمنياً) |
| `apps/web/src/app/(dashboard)/shifts/page.tsx` | بانر أحمر في المعاينة + تحذير داخل رسالة تأكيد التطبيق |

### التحقق
خطة "تجربة" (8 أعضاء من ~11 نشط) أعادت **3 موظفين** مكشوفين بالاسم:
`بندر عبدالله مسفر الغامدي، موظف تجريبي، نديم اشرف`

---

## 4. إصلاح خطأ 500 عند حذف نوع إجازة

### المشكلة
زر حذف "إجازة الحج" كان يُرجع **`Internal server error`** عاماً.

**السبب:** `removeLeaveType` كان يفحص وجود `LeaveRequest` مرتبطة فقط، **ونسي فحص `LeaveBalance`**. عند وجود 11 رصيداً مسنداً، فشل الحذف بخطأ قيد مفتاح أجنبي غير معالَج في Prisma → سقط كخطأ خادم عام.

### الحل
| الملف | التغيير |
|---|---|
| `apps/api/src/modules/leaves/leaves.service.ts` | فحص `leaveBalance.count()` قبل الحذف برسالة عربية واضحة |

### التحقق
```json
DELETE /leaves/types/{hajj}
→ 400 { "message": "لا يمكن الحذف — يوجد 11 رصيد إجازة مسند لموظفين لهذا النوع" }
```
والنوع بقي سليماً (لم يُحذف جزئياً).

---

## 5. حذف/تعديل أرصدة الإجازات

لم تكن هناك **أي** طريقة لحذف رصيد إجازة — لا في الواجهة ولا في الـ API.

### ما أُضيف
| الطريقة | الـ Endpoint | الموقع في الواجهة |
|---|---|---|
| حذف فردي | `DELETE /leaves/balances/:id` | زر 🗑 بجانب "حفظ" لكل صف في تبويب الأرصدة |
| حذف جماعي حسب النوع | `DELETE /leaves/types/:id/balances` | زر 🗑⚖ بجانب كل نوع في تبويب الأنواع |

**حماية:** كلا المسارين يرفضان الحذف إن كانت هناك أيام مُستخدَمة فعلاً (`usedDays > 0`) — لتجنّب فقدان سجل استخدام حقيقي بصمت.

| الملف | التغيير |
|---|---|
| `apps/api/src/modules/leaves/leaves.service.ts` | `deleteLeaveBalance()` + `deleteBalancesByType()` |
| `apps/api/src/modules/leaves/leaves.controller.ts` | مساران جديدان بـ `@Roles('super_admin','hr_manager')` |
| `apps/web/src/app/(dashboard)/leaves/page.tsx` | زرّا الحذف + تأكيدات |

### التحقق
```json
DELETE /leaves/types/{hajj}/balances  → { "deleted": 11 }
DELETE /leaves/types/{hajj}           → { "message": "تم الحذف" }   ← أُغلقت المشكلة الأصلية
```

---

## 6. حذف طلبات الإجازة — لمالك المنصة حصراً

**المطلوب:** حذف الطلبات **المقبولة أو المعلّقة** فقط، ومن **لوحة مالك المنصة فقط**.

| الملف | التغيير |
|---|---|
| `apps/api/src/modules/platform/platform.service.ts` | `listTenantLeaveRequests()` + `deleteTenantLeaveRequest()` |
| `apps/api/src/modules/platform/platform.controller.ts` | `GET/DELETE /platform/tenants/:id/leave-requests` |
| `apps/web/src/app/platform/tenants/page.tsx` | قسم «🌴 طلبات الإجازة» داخل تفاصيل كل شركة |

**استعادة الرصيد:** عند حذف طلب **مقبول** تُعاد الأيام المخصومة تلقائياً لرصيد الموظف، بدل أن تبقى مفقودة للأبد.

### التحقق — عزل الصلاحية
| التوكن | النتيجة |
|---|---|
| توكن شركة (`super_admin`) | **401 مرفوض** |
| توكن مالك المنصة | **200 نجاح** |

استعادة الرصيد: `usedDays: 2` ← `usedDays: 0` ✅

---

## 7. تحكّم كامل لمالك المنصة بلا قيود أدوار

**القرار المتّفق عليه:** تجاوز قيود **الأدوار/الصلاحيات** فقط — مع إبقاء فحوصات سلامة البيانات الجوهرية التي تمنع كسر قاعدة البيانات.

### النهج
بدل إعادة بناء عشرات شاشات CRUD لكل جدول، يصكّ مالك المنصة **توكن دخول تينانت عادي** لأدمن الشركة (`super_admin`) — فيفتح لوحة الشركة الحقيقية بكامل الصلاحيات، ويتحكم في **كل** الجداول عبر الواجهة الموجودة أصلاً مع كل فحوصاتها.

| الملف | التغيير |
|---|---|
| `apps/api/src/modules/platform/platform.module.ts` | `JwtModule` مُهيّأ بـ `JWT_SECRET` (سرّ توكن الشركات) |
| `apps/api/src/modules/platform/platform.service.ts` | `impersonateTenant()` — يصكّ `accessToken` + `refreshToken` بنفس شكل تسجيل الدخول |
| `apps/api/src/modules/platform/platform.controller.ts` | `POST /platform/tenants/:id/impersonate` |
| `apps/web/src/app/impersonate/page.tsx` | **صفحة جديدة** — جسر يخزّن التوكن ويُحوّل للوحة التحكم |
| `apps/web/src/app/platform/tenants/page.tsx` | زر «🔑 دخول كإدارة الشركة» |

**ملاحظة أمنية:** صفحة الجسر تمسح التوكن من شريط العنوان عبر `history.replaceState` فور تخزينه.

### التحقق
```json
POST /platform/tenants/{id}/impersonate
→ 201  adminName: "مدير النظام"
→ payload: { sub: "dddddddd-...", tenantId: "aaaaaaaa-...", roles: ["super_admin"] }
```

---

## 8. لا حذف فعلي أبداً + سجل تدقيق منفصل ⭐

**المبدأ المطلوب:** أي شيء له ريكورد لا يُحذف مهما كان — يُحذف من سجل الشركة لكن **يبقى في حساب مالك المنصة**. ولا يُضاف شيء لسجل تدقيق الشركة، بل لسجل مالك المنصة فقط.

### تغييرات المخطط (Prisma)

```prisma
model LeaveRequest {
  // ...
  // حذف مالك المنصة لا يمسح السجل فعلياً — يُخفى فقط عن الشركة
  hiddenFromTenant Boolean @default(false)
}

/// سجل تدقيق خاص بمالك المنصة فقط — لا يظهر إطلاقاً في سجل تدقيق الشركة
model PlatformAuditLog {
  id        String   @id @default(uuid())
  tenantId  String
  action    String   // LEAVE_REQUEST_DELETE, TENANT_IMPERSONATE
  entityId  String?
  details   Json?
  createdAt DateTime @default(now())
  @@map("platform_audit_logs")
}
```

> طُبِّق على قاعدة البيانات عبر `prisma db push` ✅

### التطبيق
| الملف | التغيير |
|---|---|
| `apps/api/src/modules/platform/platform.service.ts` | `logPlatformAction()` خاص + `listPlatformAuditForTenant()` + تحويل الحذف إلى `update({ hiddenFromTenant: true })` |
| `apps/api/src/modules/platform/platform.controller.ts` | `GET /platform/tenants/:id/platform-audit` |
| `apps/api/src/modules/leaves/leaves.service.ts` | `getRequests()` يفلتر `hiddenFromTenant: false` |
| `apps/web/src/app/platform/tenants/page.tsx` | شارة «🙈 مخفي عن الشركة» + قسم «🕵️ سجل تدقيق مالك المنصة» |

### التحقق الشامل (طلبات API حقيقية)

| الفحص | النتيجة |
|---|---|
| السجل بعد الحذف | **باقٍ في قاعدة البيانات** — `hidden: true` |
| رؤية الشركة | `[]` — اختفى تماماً |
| رؤية مالك المنصة | يراه كاملاً |
| سجل تدقيق مالك المنصة | `['TENANT_IMPERSONATE', 'LEAVE_REQUEST_DELETE']` |
| **سجل تدقيق الشركة** | **لا شيء جديد** — أحدث سجل ما زال `2026-07-28` |

---

## علل حقيقية اكتُشِفت وأُصلِحت أثناء العمل

### ١. `distribute()` كان يُفرِغ الخطة بالكامل بلا بديل
**الاكتشاف:** أثناء اختبار منع التعارض، فرّغت خطة "الأمن" الحقيقية (11 عضوية) عن غير قصد.

**السبب الجذري:** الكود كان يمسح كل أعضاء الخطة **بلا شرط** ثم يعيد التوزيع — فإن لم يتبقَّ أحد (كلهم متعارضون) تبقى الخطة فارغة.

**الإجراء:** استعدتُ العضويات الـ11 فوراً من نسخة سجّلتها قبل الاختبار، ثم أصلحت الكود:
```ts
if (toDistribute.length) {   // لا مسح إلا إن وُجد بديل
  await prisma.rotationGroupMember.deleteMany(...)
  await prisma.rotationGroupMember.createMany(...)
}
```
**التحقق بعد الإصلاح:** توزيع بموظفين متعارضين بالكامل ← العضويات الحالية **بقيت سليمة**.

### ٢. فحص "إجازة الحج مرة واحدة" كان يحتسب الطلبات المخفية
`ONCE_PER_EMPLOYMENT` كان سيعتبر طلباً حذفه مالك المنصة "مُستخدَماً" ويمنح الموظف 0 يوم ظلماً. أُضيف `hiddenFromTenant: false` للفحص.

### ٣. تعارض قائم في البيانات الحالية
"علي محمد" و"عبدالله منصور" كانا **بالفعل** عضوين في خطتي "عزوز" و"الأمن" معاً — وهو التعارض المطلوب منعه. الميزة الجديدة تمنع تكراره مستقبلاً لكنها **لا تُصلح الحالات القائمة تلقائياً**.

---

## ملخص الملفات المعدّلة

### Backend (`apps/api`)
```
src/modules/rotations/rotations.service.ts   منع التعارض + uncoveredActive + إصلاح distribute
src/modules/leaves/leaves.service.ts         فحص الأرصدة + حذف الأرصدة + فلترة المخفي
src/modules/leaves/leaves.controller.ts      مسارا حذف الأرصدة
src/modules/platform/platform.service.ts     انتحال + طلبات الإجازة + سجل التدقيق
src/modules/platform/platform.controller.ts  5 مسارات جديدة
src/modules/platform/platform.module.ts      JwtModule بسرّ الشركات
```

### Frontend (`apps/web`)
```
src/app/(dashboard)/shifts/page.tsx      مدة التطبيق + تنبيهات التعارض والتغطية
src/app/(dashboard)/leaves/page.tsx      أزرار حذف الأرصدة
src/app/platform/tenants/page.tsx        طلبات الإجازة + سجل التدقيق + زر الانتحال
src/app/impersonate/page.tsx             ✨ ملف جديد — صفحة جسر الدخول
```

### Database
```
packages/database/prisma/schema.prisma   LeaveRequest.hiddenFromTenant + PlatformAuditLog
```

---

## Endpoints جديدة

| Method | المسار | الحماية |
|---|---|---|
| `DELETE` | `/leaves/balances/:id` | `super_admin`, `hr_manager` |
| `DELETE` | `/leaves/types/:id/balances` | `super_admin`, `hr_manager` |
| `GET` | `/platform/tenants/:id/leave-requests` | **مالك المنصة فقط** |
| `DELETE` | `/platform/tenants/:id/leave-requests/:requestId` | **مالك المنصة فقط** |
| `GET` | `/platform/tenants/:id/platform-audit` | **مالك المنصة فقط** |
| `POST` | `/platform/tenants/:id/impersonate` | **مالك المنصة فقط** |

---

## ⚠️ ملاحظات ونقاط معلّقة

1. **لم تُعايَن بصرياً:** واجهة `/platform/tenants` بعد آخر تعديل — مصنّف الأمان منع توليد توكن مالك منصة. الكود يجتاز فحص الأنواع، والسيرفر يعمل بلا أخطاء، وصفحة `/impersonate` تعمل وتتعامل مع الروابط غير الصالحة بشكل صحيح. **يُنصح بتجربتها بتسجيل دخول حقيقي** من `/platform/login`.

2. **نطاق "لا حذف فعلي":** مُطبَّق حالياً على **طلبات الإجازة فقط**. لتعميم النمط (إخفاء + سجل منفصل) على جداول أخرى، يلزم تكرار نفس الآلية لكل جدول.

3. **قوة صلاحية الانتحال:** تمنح أدمن كامل لأي شركة بضغطة واحدة بلا كلمة مرور. مُسجَّلة في سجل مالك المنصة، لكن **لا يوجد حد زمني أو تنبيه للشركة**.

4. **كل التعديلات غير مُودَعة** — تحتاج commit:
   ```bash
   git add -A && git commit -m "..."
   ```

5. **ملفات غير متتبَّعة موجودة:** `apps/api/uploads/tenants/` (شعارات مرفوعة)، `apps/web/tsconfig.tsbuildinfo` — راجعها قبل `git add -A`.

---

## بيئة التشغيل

- الـ API **بلا file-watch** — يحتاج إعادة تشغيل يدوية بعد أي تعديل خلفي.
- التشغيل عبر أداة المعاينة بـ `name:"api"` / `name:"web"` (الإعدادات في `C:\Users\04101690\safty\.claude\launch.json`).
- أوامر `npm`/`npx`/`node`/Prisma تعمل عبر **PowerShell** (أداة Bash معطّلة لها في هذه البيئة).
- عند استخدام PowerShell لأوامر Prisma يجب تحميل `.env` يدوياً.
