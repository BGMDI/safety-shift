/**
 * بذرة عرض — بيانات واقعية الشكل لكن **وهمية بالكامل**.
 * لا أرقام هوية ولا رواتب ولا حسابات بنكية حقيقية لأي موظف فعلي،
 * لأن الغرض عرض النظام على طرف خارجي.
 *
 * التشغيل:  DATABASE_URL=<neon> npx ts-node prisma/seed-demo.ts
 * قابلة لإعادة التشغيل: تحذف بيانات المستأجر التجريبي أولاً ثم تُعيد بناءها.
 */
import { PrismaClient } from '@prisma/client'
import * as bcrypt from 'bcrypt'

const prisma = new PrismaClient()

const TENANT_ID = 'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa'
const ALL_MODULES = [
  'ATTENDANCE', 'SHIFTS', 'LEAVES', 'PAYROLL', 'CUSTODY',
  'UNIFORMS', 'ONBOARDING', 'APPROVALS', 'ROLES', 'AUDIT',
] as const

const DEFAULT_ROLES = ['super_admin', 'hr_manager', 'supervisor', 'employee']

/* أسماء عرض — لا تخصّ أي موظف حقيقي */
const PEOPLE = [
  { first: 'منى',    family: 'الحربي',   role: 'hr_manager', job: 'مديرة الموارد البشرية' },
  { first: 'خالد',   family: 'المطيري',  role: 'supervisor', job: 'مشرف أمن' },
  { first: 'سارة',   family: 'العتيبي',  role: 'employee',   job: 'حارس أمن' },
  { first: 'فهد',    family: 'القرني',   role: 'employee',   job: 'حارس أمن' },
  { first: 'نورة',   family: 'الدوسري',  role: 'employee',   job: 'حارس أمن' },
  { first: 'تركي',   family: 'العنزي',   role: 'employee',   job: 'حارس أمن' },
  { first: 'ريم',    family: 'الشهري',   role: 'employee',   job: 'حارس أمن' },
  { first: 'ماجد',   family: 'الغامدي',  role: 'supervisor', job: 'مشرف أمن' },
  { first: 'هند',    family: 'الزهراني', role: 'employee',   job: 'حارس أمن' },
  { first: 'سلطان',  family: 'البقمي',   role: 'employee',   job: 'حارس أمن' },
  { first: 'لمى',    family: 'الحارثي',  role: 'employee',   job: 'حارس أمن' },
  { first: 'عبدالله', family: 'السبيعي', role: 'employee',   job: 'حارس أمن' },
]

const dayOffset = (n: number) => { const d = new Date(); d.setDate(d.getDate() + n); d.setHours(0,0,0,0); return d }
const at = (base: Date, h: number, m = 0) => { const d = new Date(base); d.setHours(h, m, 0, 0); return d }

async function wipe() {
  // ترتيب عكسي للتبعيات
  await prisma.approvalAction.deleteMany({ where: { case: { tenantId: TENANT_ID } } })
  await prisma.approvalCase.deleteMany({ where: { tenantId: TENANT_ID } })
  await prisma.approvalStep.deleteMany({ where: { workflow: { tenantId: TENANT_ID } } })
  await prisma.approvalWorkflow.deleteMany({ where: { tenantId: TENANT_ID } })
  await prisma.auditLog.deleteMany({ where: { tenantId: TENANT_ID } })
  await prisma.platformAuditLog.deleteMany({ where: { tenantId: TENANT_ID } })
  await prisma.rotationGroupMember.deleteMany({ where: { group: { plan: { tenantId: TENANT_ID } } } })
  await prisma.rotationGroup.deleteMany({ where: { plan: { tenantId: TENANT_ID } } })
  await prisma.rotationStep.deleteMany({ where: { plan: { tenantId: TENANT_ID } } })
  await prisma.rotationPlan.deleteMany({ where: { tenantId: TENANT_ID } })
  await prisma.attendanceLog.deleteMany({ where: { tenantId: TENANT_ID } })
  await prisma.employeeShift.deleteMany({ where: { tenantId: TENANT_ID } })
  await prisma.leaveRequest.deleteMany({ where: { tenantId: TENANT_ID } })
  await prisma.leaveBalance.deleteMany({ where: { tenantId: TENANT_ID } })
  await prisma.leaveType.deleteMany({ where: { tenantId: TENANT_ID } })
  await prisma.uniformRequest.deleteMany({ where: { tenantId: TENANT_ID } })
  await prisma.onboardingRequest.deleteMany({ where: { tenantId: TENANT_ID } })
  await prisma.custodyItem.deleteMany({ where: { tenantId: TENANT_ID } })
  await prisma.payrollDetail.deleteMany({ where: { payrollRun: { tenantId: TENANT_ID } } })
  await prisma.payrollRun.deleteMany({ where: { tenantId: TENANT_ID } })
  await prisma.salaryComponent.deleteMany({ where: { tenantId: TENANT_ID } })
  await prisma.employeeRole.deleteMany({ where: { employee: { tenantId: TENANT_ID } } })
  await prisma.shift.deleteMany({ where: { tenantId: TENANT_ID } })
  await prisma.employee.deleteMany({ where: { tenantId: TENANT_ID } })
  await prisma.jobTitle.deleteMany({ where: { tenantId: TENANT_ID } })
  await prisma.department.deleteMany({ where: { tenantId: TENANT_ID } })
  await prisma.branch.deleteMany({ where: { tenantId: TENANT_ID } })
  await prisma.role.deleteMany({ where: { tenantId: TENANT_ID } })
  await prisma.tenant.deleteMany({ where: { id: TENANT_ID } })
}

async function main() {
  console.log('تنظيف بيانات العرض السابقة...')
  await wipe()

  const tenant = await prisma.tenant.create({
    data: {
      id: TENANT_ID,
      name: 'شركة الأفق للتجارة والمقاولات',
      plan: 'ANNUAL', planStatus: 'ACTIVE',
      enabledModules: [...ALL_MODULES] as any,
      maxUsers: 50,
      subscriptionStartsAt: dayOffset(-120),
      subscriptionEndsAt: dayOffset(245),
    },
  })

  const roles: Record<string, string> = {}
  for (const name of DEFAULT_ROLES) {
    const r = await prisma.role.create({ data: { tenantId: tenant.id, name } })
    roles[name] = r.id
  }

  const riyadh = await prisma.branch.create({ data: { tenantId: tenant.id, name: 'الرياض — المقر الرئيسي', location: 'حي العليا' } })
  const jeddah = await prisma.branch.create({ data: { tenantId: tenant.id, name: 'جدة', location: 'حي الروضة' } })

  const secDept = await prisma.department.create({ data: { tenantId: tenant.id, branchId: riyadh.id, name: 'الأمن والسلامة' } })
  const hrDept  = await prisma.department.create({ data: { tenantId: tenant.id, branchId: riyadh.id, name: 'الموارد البشرية' } })

  const jobGuard = await prisma.jobTitle.create({ data: { tenantId: tenant.id, name: 'حارس أمن', baseSalary: 4500, isShiftEligible: true } })
  const jobSup   = await prisma.jobTitle.create({ data: { tenantId: tenant.id, name: 'مشرف أمن', baseSalary: 7000, isShiftEligible: true } })
  const jobHR    = await prisma.jobTitle.create({ data: { tenantId: tenant.id, name: 'مديرة الموارد البشرية', baseSalary: 12000, isShiftEligible: false } })
  const jobByName: Record<string, string> = { 'حارس أمن': jobGuard.id, 'مشرف أمن': jobSup.id, 'مديرة الموارد البشرية': jobHR.id }

  const pass = await bcrypt.hash('Admin@123456', 12)

  // مدير النظام — حساب الدخول للعرض
  const admin = await prisma.employee.create({
    data: {
      tenantId: tenant.id, branchId: riyadh.id, departmentId: hrDept.id, jobTitleId: jobHR.id,
      employeeCode: 'EMP-0001', fullName: 'منى الحربي', firstName: 'منى', familyName: 'الحربي',
      email: 'admin@shift.com', phone: '0500000001', hireDate: dayOffset(-1200),
      status: 'ACTIVE', passwordHash: pass,
    },
  })
  await prisma.employeeRole.create({ data: { employeeId: admin.id, roleId: roles['super_admin'] } })
  await prisma.employeeRole.create({ data: { employeeId: admin.id, roleId: roles['hr_manager'] } })

  const employees = [admin]
  for (let i = 1; i < PEOPLE.length; i++) {
    const p = PEOPLE[i]
    const branch = i % 3 === 0 ? jeddah : riyadh
    const e = await prisma.employee.create({
      data: {
        tenantId: tenant.id, branchId: branch.id, departmentId: secDept.id, jobTitleId: jobByName[p.job],
        employeeCode: `EMP-${String(i + 1).padStart(4, '0')}`,
        fullName: `${p.first} ${p.family}`, firstName: p.first, familyName: p.family,
        email: `demo${i + 1}@shift.local`, phone: `05000000${String(i + 1).padStart(2, '0')}`,
        hireDate: dayOffset(-(200 + i * 40)), status: 'ACTIVE',
      },
    })
    await prisma.employeeRole.create({ data: { employeeId: e.id, roleId: roles[p.role] } })
    employees.push(e)
  }

  // ورديات بأطوال مختلفة — 9 و8 و7 ساعات
  const shiftMorning = await prisma.shift.create({ data: { tenantId: tenant.id, branchId: riyadh.id, name: 'شفت الصباح', startTime: '08:00', endTime: '17:00', workingDays: [0,1,2,3,4,5,6], minStaffing: 5, lateAfterMinutes: 10, absentAfterMinutes: 60 } })
  const shiftEvening = await prisma.shift.create({ data: { tenantId: tenant.id, branchId: riyadh.id, name: 'شفت الظهر',  startTime: '17:00', endTime: '01:00', workingDays: [0,1,2,3,4,5,6], minStaffing: 4, lateAfterMinutes: 10, absentAfterMinutes: 60 } })
  const shiftNight   = await prisma.shift.create({ data: { tenantId: tenant.id, branchId: riyadh.id, name: 'شفت الليل',  startTime: '01:00', endTime: '08:00', workingDays: [0,1,2,3,4,5,6], minStaffing: 3, isNightShift: true, lateAfterMinutes: 10, absentAfterMinutes: 60 } })
  const shifts = [shiftMorning, shiftEvening, shiftNight]

  // تعيينات سارية
  const rotating = employees.filter((e) => e.id !== admin.id)
  for (let i = 0; i < rotating.length; i++) {
    await prisma.employeeShift.create({
      data: { tenantId: tenant.id, employeeId: rotating[i].id, shiftId: shifts[i % 3].id, effectiveFrom: dayOffset(-14), effectiveTo: null },
    })
  }

  // حضور آخر ١٤ يوماً — بحالات متنوّعة ليمتلئ الكشف
  let present = 0, late = 0, absent = 0
  for (let d = 14; d >= 1; d--) {
    const date = dayOffset(-d)
    for (let i = 0; i < rotating.length; i++) {
      const roll = (d * 7 + i * 3) % 20
      if (roll === 0) { // غياب
        await prisma.attendanceLog.create({ data: { tenantId: tenant.id, employeeId: rotating[i].id, date, status: 'ABSENT', source: 'MANUAL' } })
        absent++
      } else if (roll < 4) { // تأخير
        const lateMin = 12 + (roll * 5)
        await prisma.attendanceLog.create({
          data: { tenantId: tenant.id, employeeId: rotating[i].id, date, checkIn: at(date, 8, lateMin), checkOut: at(date, 17, 5), status: 'LATE', lateMinutes: lateMin, source: 'BIOMETRIC' },
        })
        late++
      } else {
        await prisma.attendanceLog.create({
          data: { tenantId: tenant.id, employeeId: rotating[i].id, date, checkIn: at(date, 7, 52), checkOut: at(date, 17, 8), status: 'PRESENT', overtimeMinutes: 8, source: 'BIOMETRIC' },
        })
        present++
      }
    }
  }

  // أنواع الإجازات وفق نظام العمل السعودي
  const annual = await prisma.leaveType.create({ data: { tenantId: tenant.id, name: 'الإجازة السنوية', description: 'المادة 109 — 21 يوماً لمن لم تبلغ خدمته 5 سنوات، و30 يوماً لمن بلغها.', maxDays: 30, minDays: 21, seniorityThreshold: 5, calculationType: 'SENIORITY_BASED', requiresApproval: true, color: '#3B82F6', isSystemDefault: true } })
  const sick   = await prisma.leaveType.create({ data: { tenantId: tenant.id, name: 'الإجازة المرضية', description: 'المادة 117 — 30 يوماً بأجر كامل، ثم 60 بـ75%، ثم 30 بلا أجر.', maxDays: 30, maxDaysHalfPay: 60, maxDaysUnpaid: 30, calculationType: 'SICK_TIERED', requiresApproval: true, color: '#EF4444', isSystemDefault: true } })
  const marriage = await prisma.leaveType.create({ data: { tenantId: tenant.id, name: 'إجازة الزواج', description: 'المادة 113/ب — 3 أيام بأجر كامل.', maxDays: 3, calculationType: 'PER_EVENT', requiresApproval: false, color: '#10B981', isSystemDefault: true } })

  const year = new Date().getFullYear()
  for (const e of employees) {
    await prisma.leaveBalance.create({ data: { tenantId: tenant.id, employeeId: e.id, leaveTypeId: annual.id, year, entitledDays: 21, usedDays: 0 } })
    await prisma.leaveBalance.create({ data: { tenantId: tenant.id, employeeId: e.id, leaveTypeId: sick.id,   year, entitledDays: 30, usedDays: 0 } })
  }

  // طلبات إجازة — معلّقة ومقبولة ومرفوضة
  await prisma.leaveRequest.create({ data: { tenantId: tenant.id, employeeId: rotating[1].id, leaveTypeId: annual.id, startDate: dayOffset(6), endDate: dayOffset(11), status: 'PENDING', notes: 'سفر عائلي' } })
  await prisma.leaveRequest.create({ data: { tenantId: tenant.id, employeeId: rotating[3].id, leaveTypeId: sick.id,   startDate: dayOffset(-3), endDate: dayOffset(-1), status: 'PENDING', notes: 'تقرير طبي مرفق' } })
  await prisma.leaveRequest.create({ data: { tenantId: tenant.id, employeeId: rotating[5].id, leaveTypeId: marriage.id, startDate: dayOffset(20), endDate: dayOffset(22), status: 'PENDING' } })
  await prisma.leaveRequest.create({ data: { tenantId: tenant.id, employeeId: rotating[2].id, leaveTypeId: annual.id, startDate: dayOffset(-30), endDate: dayOffset(-25), status: 'APPROVED', approvedBy: admin.id } })
  await prisma.leaveRequest.create({ data: { tenantId: tenant.id, employeeId: rotating[4].id, leaveTypeId: annual.id, startDate: dayOffset(-10), endDate: dayOffset(-8), status: 'REJECTED', approvedBy: admin.id, notes: 'ذروة تشغيلية' } })

  // بدلة عمل وعهد ومباشرات
  await prisma.uniformRequest.create({ data: { tenantId: tenant.id, employeeId: rotating[0].id, uniformType: 'قميص رسمي', size: 'L', quantity: 2, status: 'PENDING' } })
  await prisma.uniformRequest.create({ data: { tenantId: tenant.id, employeeId: rotating[6].id, uniformType: 'حذاء سلامة', size: '43', quantity: 1, status: 'APPROVED', approvedBy: admin.id } })
  await prisma.custodyItem.create({ data: { tenantId: tenant.id, employeeId: rotating[0].id, itemName: 'جهاز لاسلكي', assignedDate: dayOffset(-60), status: 'active' } })
  await prisma.custodyItem.create({ data: { tenantId: tenant.id, employeeId: rotating[1].id, itemName: 'كشّاف يدوي', assignedDate: dayOffset(-45), status: 'active' } })
  await prisma.custodyItem.create({ data: { tenantId: tenant.id, employeeId: rotating[2].id, itemName: 'جهاز لاسلكي', assignedDate: dayOffset(-90), returnedDate: dayOffset(-5), status: 'returned' } })
  await prisma.onboardingRequest.create({ data: { tenantId: tenant.id, employeeId: rotating[7].id, type: 'RETURN_FROM_LEAVE', scheduledDate: dayOffset(2), status: 'PENDING', notes: 'عودة بعد إجازة سنوية' } })

  // بدلات على الرواتب
  for (const e of employees) {
    await prisma.salaryComponent.create({ data: { tenantId: tenant.id, employeeId: e.id, type: 'ALLOWANCE', name: 'بدل سكن', amount: 1000, effectiveDate: dayOffset(-365) } })
    await prisma.salaryComponent.create({ data: { tenantId: tenant.id, employeeId: e.id, type: 'ALLOWANCE', name: 'بدل مواصلات', amount: 500, effectiveDate: dayOffset(-365) } })
  }

  console.log(`
✅ بذرة العرض جاهزة
   الشركة: ${tenant.name}
   الموظفون: ${employees.length}   الفروع: 2   الورديات: 3 (9/8/7 ساعات)
   الحضور: ${present} حاضر · ${late} متأخر · ${absent} غائب  (١٤ يوماً)
   الإجازات: 5 طلبات (3 معلّقة)  ·  البدلات والعهد والمباشرات: مزروعة

   الدخول:  admin@shift.com  /  Admin@123456
`)
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
