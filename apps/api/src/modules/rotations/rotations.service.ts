import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common'
import { prisma } from '@shift-saas/database'

const DAY_MS = 86400000
const GROUP_NAMES = ['المجموعة أ', 'المجموعة ب', 'المجموعة ج', 'المجموعة د', 'المجموعة هـ', 'المجموعة و', 'المجموعة ز', 'المجموعة ح']

/* كتلة في دورة التدوير: شفت لعدة أيام، أو راحة (shiftId = null) */
interface Slot { shiftId: string | null; start: number; len: number }

const dateOnly = (d: Date) => d.toISOString().slice(0, 10)

@Injectable()
export class RotationsService {

  /* ── بناء دورة التدوير: كتلة لكل شفت بالترتيب + كتلة راحة عند القلبة ── */
  private buildSlots(plan: { shiftIds: string[]; rotateEveryDays: number; restMode: string; restDays: number }) {
    const R = Math.max(1, plan.rotateEveryDays)
    const slots: Slot[] = []
    let acc = 0
    for (const sid of plan.shiftIds) {
      slots.push({ shiftId: sid, start: acc, len: R })
      acc += R
    }
    if (plan.restMode === 'AT_ROTATION' && plan.restDays > 0) {
      slots.push({ shiftId: null, start: acc, len: plan.restDays })
      acc += plan.restDays
    }
    return { slots, cycle: acc }
  }

  /* ── شفت المجموعة رقم gi في اليوم dayIndex منذ بداية الخطة ──
     كل مجموعة تبدأ من كتلة مختلفة لضمان تغطية كل الشفتات في نفس اليوم */
  private slotFor(slots: Slot[], cycle: number, gi: number, dayIndex: number): string | null {
    const offset = slots[gi % slots.length].start
    const pos = (((dayIndex + offset) % cycle) + cycle) % cycle
    const slot = slots.find(s => pos >= s.start && pos < s.start + s.len)
    return slot?.shiftId ?? null
  }

  /* ── مصفوفة الجدول: يوم × مجموعة → شفت أو راحة ── */
  private buildMatrix(
    plan: { shiftIds: string[]; rotateEveryDays: number; restMode: string; restDays: number; weeklyRestDays: number[]; startDate: Date },
    groupCount: number,
    windowStart: Date,
    days: number,
  ) {
    const { slots, cycle } = this.buildSlots(plan)
    const planStart = new Date(dateOnly(plan.startDate))
    const rows: Array<{ date: string; weekday: number; cells: (string | null)[] }> = []

    for (let d = 0; d < days; d++) {
      const date = new Date(windowStart.getTime() + d * DAY_MS)
      const dayIndex = Math.round((date.getTime() - planStart.getTime()) / DAY_MS)
      const weekday = date.getUTCDay()
      const cells: (string | null)[] = []
      for (let gi = 0; gi < groupCount; gi++) {
        if (dayIndex < 0) { cells.push(null); continue } // قبل بداية الخطة
        let shiftId = this.slotFor(slots, cycle, gi, dayIndex)
        if (plan.restMode === 'WEEKLY' && plan.weeklyRestDays.includes(weekday)) shiftId = null
        cells.push(shiftId)
      }
      rows.push({ date: dateOnly(date), weekday, cells })
    }
    return rows
  }

  private async getPlan(tenantId: string, id: string) {
    const plan = await prisma.rotationPlan.findFirst({
      where: { id, tenantId },
      include: {
        groups: {
          orderBy: { order: 'asc' },
          include: {
            members: {
              include: { employee: { select: { id: true, fullName: true, employeeCode: true } } },
            },
          },
        },
      },
    })
    if (!plan) throw new NotFoundException('خطة التدوير غير موجودة')
    return plan
  }

  /* ══════════ CRUD ══════════ */

  async findAll(tenantId: string) {
    return prisma.rotationPlan.findMany({
      where: { tenantId },
      include: {
        groups: {
          orderBy: { order: 'asc' },
          include: {
            members: {
              include: { employee: { select: { id: true, fullName: true, employeeCode: true } } },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    })
  }

  async create(tenantId: string, dto: {
    name: string
    shiftIds: string[]
    rotateEveryDays: number
    restMode: string
    restDays?: number
    weeklyRestDays?: number[]
    startDate: string
    groupCount?: number
  }) {
    if (!dto.name?.trim()) throw new BadRequestException('اسم الخطة مطلوب')
    if (!dto.shiftIds?.length) throw new BadRequestException('اختر شفتاً واحداً على الأقل')

    // تحقق أن الشفتات تابعة لنفس الشركة
    const shifts = await prisma.shift.findMany({ where: { tenantId, id: { in: dto.shiftIds } } })
    if (shifts.length !== dto.shiftIds.length) throw new BadRequestException('شفت غير صالح')

    const groupCount = Math.min(Math.max(dto.groupCount ?? dto.shiftIds.length + 1, 1), 8)

    return prisma.rotationPlan.create({
      data: {
        tenantId,
        name: dto.name.trim(),
        shiftIds: dto.shiftIds,
        rotateEveryDays: Math.max(1, dto.rotateEveryDays ?? 3),
        restMode: dto.restMode === 'WEEKLY' ? 'WEEKLY' : 'AT_ROTATION',
        restDays: Math.max(0, dto.restDays ?? 1),
        weeklyRestDays: dto.weeklyRestDays ?? [],
        startDate: new Date(dto.startDate),
        groups: {
          create: Array.from({ length: groupCount }, (_, i) => ({
            name: GROUP_NAMES[i] ?? `مجموعة ${i + 1}`,
            order: i,
          })),
        },
      },
      include: { groups: true },
    })
  }

  async remove(tenantId: string, id: string) {
    await this.getPlan(tenantId, id)
    await prisma.rotationPlan.delete({ where: { id } }) // groups/members تُحذف تلقائياً (cascade)
    return { message: 'تم حذف الخطة' }
  }

  /* ══════════ المجموعات والأعضاء ══════════ */

  async addGroup(tenantId: string, planId: string, name?: string) {
    const plan = await this.getPlan(tenantId, planId)
    if (plan.groups.length >= 8) throw new BadRequestException('الحد الأقصى 8 مجموعات')
    return prisma.rotationGroup.create({
      data: {
        planId,
        name: name?.trim() || GROUP_NAMES[plan.groups.length] || `مجموعة ${plan.groups.length + 1}`,
        order: plan.groups.length,
      },
    })
  }

  async removeGroup(tenantId: string, groupId: string) {
    const group = await prisma.rotationGroup.findFirst({
      where: { id: groupId, plan: { tenantId } },
    })
    if (!group) throw new NotFoundException('المجموعة غير موجودة')
    await prisma.rotationGroup.delete({ where: { id: groupId } })
    return { message: 'تم حذف المجموعة' }
  }

  async addMembers(tenantId: string, groupId: string, employeeIds: string[]) {
    const group = await prisma.rotationGroup.findFirst({ where: { id: groupId, plan: { tenantId } } })
    if (!group) throw new NotFoundException('المجموعة غير موجودة')
    if (!employeeIds?.length) return { added: 0 }

    const valid = await prisma.employee.findMany({
      where: { tenantId, id: { in: employeeIds }, status: 'ACTIVE' },
      select: { id: true },
    })

    // أزل الموظف من أي مجموعة أخرى في نفس الخطة (لا يكون في مجموعتين)
    await prisma.rotationGroupMember.deleteMany({
      where: { employeeId: { in: valid.map(v => v.id) }, group: { planId: group.planId } },
    })

    await prisma.rotationGroupMember.createMany({
      data: valid.map(v => ({ groupId, employeeId: v.id })),
      skipDuplicates: true,
    })
    return { added: valid.length }
  }

  async removeMember(tenantId: string, groupId: string, employeeId: string) {
    await prisma.rotationGroupMember.deleteMany({
      where: { groupId, employeeId, group: { plan: { tenantId } } },
    })
    return { message: 'تمت الإزالة' }
  }

  /* ── توزيع تلقائي بالتساوي على المجموعات ── */
  async distribute(tenantId: string, planId: string, employeeIds: string[]) {
    const plan = await this.getPlan(tenantId, planId)
    if (!plan.groups.length) throw new BadRequestException('لا توجد مجموعات في الخطة')
    if (!employeeIds?.length) throw new BadRequestException('اختر موظفين للتوزيع')

    const valid = await prisma.employee.findMany({
      where: { tenantId, id: { in: employeeIds }, status: 'ACTIVE' },
      select: { id: true },
    })

    // امسح العضويات الحالية ثم وزّع بالتناوب
    await prisma.rotationGroupMember.deleteMany({ where: { group: { planId } } })
    await prisma.rotationGroupMember.createMany({
      data: valid.map((v, i) => ({
        groupId: plan.groups[i % plan.groups.length].id,
        employeeId: v.id,
      })),
    })
    return { distributed: valid.length, groups: plan.groups.length }
  }

  /* ══════════ المعاينة والتطبيق ══════════ */

  async preview(tenantId: string, planId: string, days = 14, startDate?: string) {
    const plan = await this.getPlan(tenantId, planId)
    const horizon = Math.min(Math.max(days, 1), 90)
    const windowStart = new Date(startDate ?? dateOnly(plan.startDate > new Date() ? plan.startDate : new Date()))
    const matrix = this.buildMatrix(plan, plan.groups.length, windowStart, horizon)
    return {
      planId: plan.id,
      startDate: dateOnly(windowStart),
      days: horizon,
      groups: plan.groups.map(g => ({ id: g.id, name: g.name, memberCount: g.members.length })),
      matrix,
    }
  }

  /* ── التطبيق: كتابة تعيينات الشفتات الفعلية للموظفين ── */
  async apply(tenantId: string, planId: string, days = 30, startDate?: string) {
    const plan = await this.getPlan(tenantId, planId)
    const horizon = Math.min(Math.max(days, 1), 90)
    const windowStart = new Date(startDate ?? dateOnly(plan.startDate > new Date() ? plan.startDate : new Date()))
    const windowEnd = new Date(windowStart.getTime() + (horizon - 1) * DAY_MS)

    const allMembers = plan.groups.flatMap(g => g.members.map(m => m.employeeId))
    if (!allMembers.length) throw new BadRequestException('لا يوجد موظفون في مجموعات الخطة — أضفهم أولاً')

    const matrix = this.buildMatrix(plan, plan.groups.length, windowStart, horizon)

    // نظّف التعيينات المتداخلة مع الفترة
    const dayBefore = new Date(windowStart.getTime() - DAY_MS)
    await prisma.employeeShift.deleteMany({
      where: { tenantId, employeeId: { in: allMembers }, effectiveFrom: { gte: windowStart, lte: windowEnd } },
    })
    await prisma.employeeShift.updateMany({
      where: {
        tenantId,
        employeeId: { in: allMembers },
        effectiveFrom: { lt: windowStart },
        OR: [{ effectiveTo: null }, { effectiveTo: { gte: windowStart } }],
      },
      data: { effectiveTo: dayBefore },
    })

    // حوّل أعمدة المصفوفة إلى فترات متصلة لكل مجموعة
    const rows: Array<{ tenantId: string; employeeId: string; shiftId: string; effectiveFrom: Date; effectiveTo: Date }> = []
    plan.groups.forEach((g, gi) => {
      let runShift: string | null = null
      let runStart = 0
      const flush = (endIdx: number) => {
        if (!runShift) return
        for (const m of g.members) {
          rows.push({
            tenantId,
            employeeId: m.employeeId,
            shiftId: runShift,
            effectiveFrom: new Date(matrix[runStart].date),
            effectiveTo: new Date(matrix[endIdx].date),
          })
        }
      }
      matrix.forEach((row, di) => {
        const s = row.cells[gi]
        if (s !== runShift) {
          flush(di - 1)
          runShift = s
          runStart = di
        }
      })
      flush(matrix.length - 1)
    })

    await prisma.employeeShift.createMany({ data: rows })

    return {
      applied: rows.length,
      employees: allMembers.length,
      from: dateOnly(windowStart),
      to: dateOnly(windowEnd),
    }
  }
}
