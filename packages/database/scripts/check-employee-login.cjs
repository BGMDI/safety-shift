// تشخيص تعذّر دخول موظف: يوضّح أي شرط من شروط تسجيل الدخول لم يتحقق.
// الاستخدام:  CHECK_EMAIL=user@example.com node scripts/check-employee-login.cjs
// ولضبط كلمة مرور له في الوقت نفسه:  CHECK_EMAIL=... SET_PASSWORD=... node scripts/check-employee-login.cjs
const bcrypt = require('bcrypt')
const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()

async function main() {
  const email = (process.env.CHECK_EMAIL || '').trim()
  if (!email) throw new Error('CHECK_EMAIL is required')

  const matches = await prisma.employee.findMany({
    where: { email: { equals: email, mode: 'insensitive' } },
    select: {
      id: true, email: true, fullName: true, employeeCode: true, status: true, passwordHash: true,
      tenant: { select: { name: true, planStatus: true, subscriptionEndsAt: true } },
      employeeRoles: { select: { role: { select: { name: true } } } },
    },
  })

  if (matches.length === 0) {
    console.log(`لا يوجد موظف بهذا البريد: ${email}`)
    const similar = await prisma.employee.findMany({
      where: { email: { contains: email.split('@')[0], mode: 'insensitive' } },
      select: { email: true, fullName: true },
      take: 5,
    })
    if (similar.length) {
      console.log('بريد مشابه موجود فعلاً:')
      similar.forEach((s) => console.log(`  - ${s.email}  (${s.fullName})`))
    }
    return
  }

  if (matches.length > 1) {
    console.log(`تنبيه: ${matches.length} حسابات تتطابق مع هذا البريد باختلاف حالة الأحرف — وحّدها.`)
  }

  for (const employee of matches) {
    const expired = employee.tenant.subscriptionEndsAt
      ? employee.tenant.subscriptionEndsAt < new Date()
      : false
    console.log('────────────────────────────')
    console.log(`الاسم:              ${employee.fullName} (${employee.employeeCode})`)
    console.log(`البريد المخزَّن:     «${employee.email}»`)
    console.log(`الشركة:             ${employee.tenant.name}`)
    console.log(`الحالة:             ${employee.status}${employee.status === 'ACTIVE' ? '' : '  ← الدخول مرفوض'}`)
    console.log(`كلمة المرور:        ${employee.passwordHash ? 'مضبوطة' : 'غير مضبوطة  ← الدخول مرفوض'}`)
    console.log(`اشتراك الشركة:      ${employee.tenant.planStatus}${expired ? ' (منتهٍ بالتاريخ)  ← الدخول مرفوض' : ''}`)
    console.log(`الأدوار:            ${employee.employeeRoles.map((r) => r.role.name).join('، ') || 'بلا أدوار'}`)

    if (process.env.SET_PASSWORD) {
      if (process.env.SET_PASSWORD.length < 8) throw new Error('SET_PASSWORD must contain at least 8 characters')
      if (matches.length > 1) throw new Error('أكثر من حساب مطابق — وحّد البريد أولاً قبل ضبط كلمة المرور')
      await prisma.employee.update({
        where: { id: employee.id },
        data: { passwordHash: await bcrypt.hash(process.env.SET_PASSWORD, 12), email: employee.email.toLowerCase() },
      })
      console.log('✔ تم ضبط كلمة المرور وتوحيد البريد بأحرف صغيرة')
    }
  }
}

main()
  .catch((error) => {
    console.error(error.message)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
