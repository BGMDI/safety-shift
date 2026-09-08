import { Injectable, NotFoundException } from '@nestjs/common'
import { prisma } from '@shift-saas/database'
import { CreateJobTitleDto, UpdateJobTitleDto } from './dto/job-title.dto'
import { parseJobTitles } from './job-titles-import'

@Injectable()
export class JobTitlesService {
  async import(tenantId: string, buffer: Buffer) {
    const rows = await parseJobTitles(buffer)
    const errors = rows.filter(row => row.errors.length).map(row => ({ row: row.row, message: row.errors.join('، ') }))
    const valid = rows.filter(row => !row.errors.length)
    const existing = await prisma.jobTitle.findMany({ where: { tenantId }, select: { name: true } })
    const names = new Set(existing.map(item => item.name.trim().toLocaleLowerCase('ar')))
    const additions: typeof valid = []
    const skippedRows: { row: number; message: string }[] = []
    for (const row of valid) {
      const key = row.name.trim().toLocaleLowerCase('ar')
      if (names.has(key)) skippedRows.push({ row: row.row, message: `المسمى «${row.name}» موجود مسبقاً` })
      else { names.add(key); additions.push(row) }
    }
    if (additions.length) {
      await prisma.jobTitle.createMany({ data: additions.map(row => ({
        tenantId, name: row.name.trim(), grade: row.grade.trim(), baseSalary: row.baseSalary!, isShiftEligible: row.isShiftEligible!,
      })) })
    }
    return { total: rows.length, added: additions.length, rejected: errors.length, skipped: skippedRows.length, errors, skippedRows }
  }

  async findAll(tenantId: string) {
    return prisma.jobTitle.findMany({
      where: { tenantId },
      include: { _count: { select: { employees: true } } },
      orderBy: { name: 'asc' },
    })
  }

  async create(tenantId: string, dto: CreateJobTitleDto) {
    return prisma.jobTitle.create({
      data: { tenantId, name: dto.name, grade: dto.grade, baseSalary: dto.baseSalary ?? 0, isShiftEligible: dto.isShiftEligible ?? true },
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
