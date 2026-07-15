import { Injectable, NotFoundException, ConflictException, BadRequestException } from '@nestjs/common'
import { prisma } from '@shift-saas/database'
import { CreateRoleDto } from './dto/create-role.dto'

// الأدوار المحمية التي لا يمكن حذفها
const PROTECTED_ROLES = ['super_admin', 'hr_manager', 'supervisor', 'employee']

@Injectable()
export class RolesService {

  /* ── قائمة الأدوار مع عدد الموظفين لكل دور ── */
  async findAll(tenantId: string) {
    const roles = await prisma.role.findMany({
      where: { tenantId },
      include: { _count: { select: { employeeRoles: true } } },
      orderBy: { name: 'asc' },
    })
    return roles.map(r => ({
      id: r.id,
      name: r.name,
      employeeCount: r._count.employeeRoles,
      isProtected: PROTECTED_ROLES.includes(r.name),
    }))
  }

  /* ── إنشاء دور جديد ── */
  async create(tenantId: string, dto: CreateRoleDto) {
    const existing = await prisma.role.findFirst({ where: { tenantId, name: dto.name } })
    if (existing) throw new ConflictException('يوجد دور بهذا الاسم مسبقاً')
    return prisma.role.create({ data: { tenantId, name: dto.name } })
  }

  /* ── تعديل اسم دور ── */
  async update(tenantId: string, id: string, dto: CreateRoleDto) {
    const role = await prisma.role.findFirst({ where: { id, tenantId } })
    if (!role) throw new NotFoundException('الدور غير موجود')
    if (PROTECTED_ROLES.includes(role.name))
      throw new BadRequestException('لا يمكن تعديل الأدوار الأساسية')
    const dup = await prisma.role.findFirst({ where: { tenantId, name: dto.name, NOT: { id } } })
    if (dup) throw new ConflictException('يوجد دور بهذا الاسم مسبقاً')
    return prisma.role.update({ where: { id }, data: { name: dto.name } })
  }

  /* ── حذف دور ── */
  async remove(tenantId: string, id: string) {
    const role = await prisma.role.findFirst({ where: { id, tenantId } })
    if (!role) throw new NotFoundException('الدور غير موجود')
    if (PROTECTED_ROLES.includes(role.name))
      throw new BadRequestException('لا يمكن حذف الأدوار الأساسية')
    // احذف تعيينات الدور أولاً
    await prisma.employeeRole.deleteMany({ where: { roleId: id } })
    await prisma.role.delete({ where: { id } })
    return { message: 'تم حذف الدور' }
  }

  /* ── قائمة الموظفين مع أدوارهم ── */
  async findEmployeesWithRoles(tenantId: string, search?: string) {
    const employees = await prisma.employee.findMany({
      where: {
        tenantId,
        status: { not: 'TERMINATED' },
        ...(search ? {
          OR: [
            { fullName: { contains: search, mode: 'insensitive' } },
            { employeeCode: { contains: search, mode: 'insensitive' } },
          ],
        } : {}),
      },
      select: {
        id: true,
        fullName: true,
        employeeCode: true,
        photo: true,
        jobTitle: { select: { name: true } },
        employeeRoles: { select: { id: true, role: { select: { id: true, name: true } } } },
      },
      orderBy: { fullName: 'asc' },
      take: 50,
    })
    return employees
  }

  /* ── تعيين دور لموظف ── */
  async assignRole(tenantId: string, employeeId: string, roleId: string) {
    // تحقق أن الموظف والدور ينتميان لنفس المستأجر
    const [emp, role] = await Promise.all([
      prisma.employee.findFirst({ where: { id: employeeId, tenantId } }),
      prisma.role.findFirst({ where: { id: roleId, tenantId } }),
    ])
    if (!emp)  throw new NotFoundException('الموظف غير موجود')
    if (!role) throw new NotFoundException('الدور غير موجود')

    const existing = await prisma.employeeRole.findUnique({
      where: { employeeId_roleId: { employeeId, roleId } },
    })
    if (existing) throw new ConflictException('الموظف يمتلك هذا الدور مسبقاً')

    return prisma.employeeRole.create({ data: { employeeId, roleId } })
  }

  /* ── إزالة دور من موظف ── */
  async removeRole(tenantId: string, employeeId: string, roleId: string) {
    const emp = await prisma.employee.findFirst({ where: { id: employeeId, tenantId } })
    if (!emp) throw new NotFoundException('الموظف غير موجود')

    await prisma.employeeRole.deleteMany({ where: { employeeId, roleId } })
    return { message: 'تم إزالة الدور' }
  }

  /* ── إنشاء الأدوار الافتراضية عند أول تشغيل ── */
  async seedDefaultRoles(tenantId: string) {
    const defaults = [
      { name: 'super_admin',  label: 'مدير النظام' },
      { name: 'hr_manager',   label: 'مدير الموارد البشرية' },
      { name: 'supervisor',   label: 'مشرف' },
      { name: 'employee',     label: 'موظف' },
    ]
    const results = []
    for (const d of defaults) {
      const exists = await prisma.role.findFirst({ where: { tenantId, name: d.name } })
      if (!exists) {
        const r = await prisma.role.create({ data: { tenantId, name: d.name } })
        results.push(r)
      }
    }
    return { seeded: results.length, message: results.length ? 'تم إنشاء الأدوار الافتراضية' : 'الأدوار موجودة مسبقاً' }
  }
}
