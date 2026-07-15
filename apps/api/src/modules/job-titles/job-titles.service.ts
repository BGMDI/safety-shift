import { Injectable, NotFoundException } from '@nestjs/common'
import { prisma } from '@shift-saas/database'
import { CreateJobTitleDto, UpdateJobTitleDto } from './dto/job-title.dto'

@Injectable()
export class JobTitlesService {
  async findAll(tenantId: string) {
    return prisma.jobTitle.findMany({
      where: { tenantId },
      include: { _count: { select: { employees: true } } },
      orderBy: { name: 'asc' },
    })
  }

  async create(tenantId: string, dto: CreateJobTitleDto) {
    return prisma.jobTitle.create({
      data: { tenantId, name: dto.name, grade: dto.grade, baseSalary: dto.baseSalary ?? 0 },
    })
  }

  async update(tenantId: string, id: string, dto: UpdateJobTitleDto) {
    const existing = await prisma.jobTitle.findFirst({ where: { id, tenantId } })
    if (!existing) throw new NotFoundException('الوظيفة غير موجودة')
    return prisma.jobTitle.update({ where: { id }, data: dto })
  }

  async remove(tenantId: string, id: string) {
    const jt = await prisma.jobTitle.findFirst({
      where: { id, tenantId },
      include: { _count: { select: { employees: true } } },
    })
    if (!jt) throw new NotFoundException('الوظيفة غير موجودة')
    if ((jt as any)._count.employees > 0) throw new NotFoundException('لا يمكن حذف وظيفة مرتبطة بموظفين')
    await prisma.jobTitle.delete({ where: { id } })
    return { message: 'تم حذف الوظيفة' }
  }
}
