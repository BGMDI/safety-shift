import { PrismaClient } from '@prisma/client'
import * as bcrypt from 'bcrypt'

const prisma = new PrismaClient()

// UUIDs ثابتة وصالحة للـ seed
const TENANT_ID  = 'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa'
const BRANCH_ID  = 'bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbbbb'
const ROLE_ID    = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'
const EMP_ID     = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd'
const EMP_ROLE_ID = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee'

async function main() {
  const tenant = await prisma.tenant.upsert({
    where: { id: TENANT_ID },
    update: {},
    create: { id: TENANT_ID, name: 'شركة تجريبية', plan: 'TRIAL', planStatus: 'TRIAL' },
  })

  const branch = await prisma.branch.upsert({
    where: { id: BRANCH_ID },
    update: {},
    create: { id: BRANCH_ID, tenantId: tenant.id, name: 'المقر الرئيسي', timezone: 'Asia/Riyadh' },
  })

  const adminRole = await prisma.role.upsert({
    where: { id: ROLE_ID },
    update: {},
    create: { id: ROLE_ID, tenantId: tenant.id, name: 'super_admin' },
  })

  const passwordHash = await bcrypt.hash('Admin@123456', 12)

  const admin = await prisma.employee.upsert({
    where: { id: EMP_ID },
    update: {},
    create: {
      id: EMP_ID,
      tenantId: tenant.id,
      branchId: branch.id,
      employeeCode: 'ADMIN001',
      fullName: 'مدير النظام',
      email: 'admin@shift.com',
      passwordHash,
      hireDate: new Date(),
      status: 'ACTIVE',
    },
  })

  await prisma.employeeRole.upsert({
    where: { id: EMP_ROLE_ID },
    update: {},
    create: { id: EMP_ROLE_ID, employeeId: admin.id, roleId: adminRole.id },
  })

  console.log('✅ تم إنشاء البيانات الأولية')
  console.log('📧 البريد: admin@shift.com')
  console.log('🔑 كلمة المرور: Admin@123456')
  console.log('🏪 الفرع ID:', branch.id)
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
