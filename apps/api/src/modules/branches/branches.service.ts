import { Injectable, NotFoundException, ConflictException } from '@nestjs/common'
import { prisma } from '@shift-saas/database'

@Injectable()
export class BranchesService {
  async findAll(tenantId: string) {
    return prisma.branch.findMany({
      where: { tenantId },
      include: {
        _count: { select: { employees: true } },
        manager: { select: { id: true, fullName: true, employeeCode: true } },
        departments: {
          select: { id: true, name: true, _count: { select: { employees: true } } },
          orderBy: { name: 'asc' },
        },
      },
      orderBy: { name: 'asc' },
    })
  }

  async create(tenantId: string, data: { name: string; location?: string; managerEmployeeId?: string }) {
    return prisma.branch.create({ data: { tenantId, name: data.name, location: data.location, managerEmployeeId: data.managerEmployeeId } })
  }

  async update(tenantId: string, id: string, data: { name?: string; location?: string; managerEmployeeId?: string | null }) {
    const branch = await prisma.branch.findFirst({ where: { tenantId, id } })
    if (!branch) throw new NotFoundException('الفرع غير موجود')
    return prisma.branch.update({ where: { id }, data: { ...data, managerEmployeeId: data.managerEmployeeId || null } })
  }

  async remove(tenantId: string, id: string) {
    const branch = await prisma.branch.findFirst({
      where: { tenantId, id },
      include: { _count: { select: { employees: true } } },
    })
    if (!branch) throw new NotFoundException('الفرع غير موجود')
    if (branch._count.employees > 0)
      throw new ConflictException(`لا يمكن حذف الفرع — يوجد ${branch._count.employees} موظف مرتبط`)
    return prisma.branch.delete({ where: { id } })
  }
}
