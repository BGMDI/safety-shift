import { Injectable, NotFoundException } from '@nestjs/common'
import { prisma } from '@shift-saas/database'
import { CreateDepartmentDto, UpdateDepartmentDto } from './dto/department.dto'

@Injectable()
export class DepartmentsService {
  async findAll(tenantId: string) {
    return prisma.department.findMany({
      where: { tenantId },
      include: {
        parent: { select: { id: true, name: true } },
        branch: { select: { id: true, name: true } },
        _count: { select: { employees: true, children: true } },
      },
      orderBy: { name: 'asc' },
    })
  }

  async findOne(tenantId: string, id: string) {
    const dept = await prisma.department.findFirst({
      where: { id, tenantId },
      include: {
        parent: { select: { id: true, name: true } },
        children: { select: { id: true, name: true } },
        employees: { select: { id: true, fullName: true, employeeCode: true } },
      },
    })
    if (!dept) throw new NotFoundException('القسم غير موجود')
    return dept
  }

  async create(tenantId: string, dto: CreateDepartmentDto) {
    return prisma.department.create({
      data: { tenantId, name: dto.name, parentId: dto.parentId, branchId: dto.branchId },
    })
  }

  async update(tenantId: string, id: string, dto: UpdateDepartmentDto) {
    await this.findOne(tenantId, id)
    const data: any = {}
    if (dto.name      !== undefined) data.name      = dto.name
    if (dto.parentId  !== undefined) data.parentId  = dto.parentId  || null
    if (dto.branchId  !== undefined) data.branchId  = dto.branchId  || null
    return prisma.department.update({ where: { id }, data })
  }

  async remove(tenantId: string, id: string) {
    const dept = await this.findOne(tenantId, id)
    if ((dept as any)._count?.employees > 0)
      throw new NotFoundException('لا يمكن حذف قسم يحتوي على موظفين')
    await prisma.department.delete({ where: { id } })
    return { message: 'تم حذف القسم' }
  }
}
