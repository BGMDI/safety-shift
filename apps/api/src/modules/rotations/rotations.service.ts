import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common'
import { prisma } from '@shift-saas/database'

const DAY_MS = 86400000
const GROUP_NAMES = ['المجموعة أ', 'المجموعة ب', 'المجموعة ج', 'المجموعة د', 'المجموعة هـ', 'المجموعة و', 'المجموعة ز', 'المجموعة ح']

/* كتلة في دورة التدوير: شفت لعدة أيام (عدده الخاص)، أو راحة (shiftId = null) */
interface Slot { shiftId: string | null; start: number; len: number }
interface StepInput { shiftId: string; days: number }

const dateOnly = (d: Date) => d.toISOString().slice(0, 10)

@Injectable()
export class RotationsService {

  /* ── بناء دورة الشفتات من الخطوات: كتلة لكل خطوة بعدد أيامها الخاص ── */
  private buildStepSlots(steps: StepInput[]) {
    const stepSlots: Slot[] = []
    let stepsCycle = 0
    for (const step of steps) {
      const len = Math.max(1, step.days)
      stepSlots.push({ shiftId: step.shiftId, start: stepsCycle, len })
      stepsCycle += len
    }
    return { stepSlots, stepsCycle }
  }

  /* ── بناء دورة التدوير لوضعي AT_ROTATION وWEEKLY: الشفتات كاملة ثم راحة عند القلبة (لـ AT_ROTATION فقط) ── */
  private buildSlots(plan: { steps: StepInput[]; restMode: string; restDays: number }) {
    const { stepSlots, stepsCycle } = this.buildStepSlots(plan.steps)
    const slots: Slot[] = [...stepSlots]
    let acc = stepsCycle
    if (plan.restMode === 'AT_ROTATION' && plan.restDays > 0) {
      slots.push({ shiftId: null, start: acc, len: plan.restDays })
      acc += plan.restDays
    }
    return { slots, cycle: acc }
  }

  /* ── شفت المجموعة رقم gi في اليوم dayIndex منذ بداية الخطة (لوضعي AT_ROTATION وWEEKLY) ──
     كل مجموعة تبدأ من كتلة مختلفة لضمان تغطية كل الشفتات في نفس اليوم */
  private slotFor(slots: Slot[], cycle: number, gi: number, dayIndex: number): string | null {
    const offset = slots[gi % slots.length].start
    const pos = (((dayIndex + offset) % cycle) + cycle) % cycle
    const slot = slots.find(s => pos >= s.start && pos < s.start + s.len)
    return slot?.shiftId ?? null
  }

  /* ── شفت المجموعة رقم gi في اليوم dayIndex لوضع AFTER_N_DAYS ──
     فترة العمل قبل الراحة (workPeriod) رقم مستقل تماماً عن مجموع أيام خطوات الشفتات (stepsCycle).
     دورة الشفتات لا تُعاد من الصفر مع كل فترة عمل، بل تستمر تراكمياً عبر الدورات — فلو كانت فترة
     العمل أقصر من دورة الشفتات، تظهر كل الشفتات بالتناوب عبر عدة فترات عمل متتالية بدلاً من أن
     تُسقَط الشفتات المتأخرة في الترتيب نهائياً */
  private afterNDaysShiftFor(
    stepSlots: Slot[], stepsCycle: number, workPeriod: number, restDays: number,
    groupCount: number, gi: number, dayIndex: number,
  ): string | null {
    const outerCycle = workPeriod + restDays
    if (outerCycle <= 0 || stepsCycle <= 0) return null
    const groupOffset = groupCount > 0 ? Math.floor((gi * outerCycle) / groupCount) : 0
    const shifted = dayIndex + groupOffset
    const pos = ((shifted % outerCycle) + outerCycle) % outerCycle
    if (pos >= workPeriod) return null // راحة
    const fullCycles = Math.floor(shifted / outerCycle)
    const workDayIndex = fullCycles * workPeriod + pos
    const stepPos = ((workDayIndex % stepsCycle) + stepsCycle) % stepsCycle
    const slot = stepSlots.find(s => stepPos >= s.start && stepPos < s.start + s.len)
    return slot?.shiftId ?? null
  }

  /* ── مصفوفة الجدول: يوم × مجموعة → شفت أو راحة ── */
  private buildMatrix(
    plan: { steps: StepInput[]; restMode: string; restDays: number; weeklyRestDays: number[]; workDaysBeforeRest?: number; startDate: Date },
    groupCount: number,
    windowStart: Date,
    days: number,
  ) {
    const planStart = new Date(dateOnly(plan.startDate))
    const rows: Array<{ date: string; weekday: number; cells: (string | null)[] }> = []

    if (plan.restMode === 'AFTER_N_DAYS') {
      const { stepSlots, stepsCycle } = this.buildStepSlots(plan.steps)
      const workPeriod = Math.max(1, plan.workDaysBeforeRest || stepsCycle || 1)
      const restDays = Math.max(0, plan.restDays)
      for (let d = 0; d < days; d++) {
        const date = new Date(windowStart.getTime() + d * DAY_MS)
        const dayIndex = Math.round((date.getTime() - planStart.getTime()) / DAY_MS)
        const weekday = date.getUTCDay()
        const cells: (string | null)[] = []
        for (let gi = 0; gi < groupCount; gi++) {
          cells.push(dayIndex < 0 ? null : this.afterNDaysShiftFor(stepSlots, stepsCycle, workPeriod, restDays, groupCount, gi, dayIndex))
        }
        rows.push({ date: dateOnly(date), weekday, cells })
      }
      return rows
    }

    const { slots, cycle } = this.buildSlots(plan)
    for (let d = 0; d < days; d++) {
      const date = new Date(windowStart.getTime() + d * DAY_MS)
      const dayIndex = Math.round((date.getTime() - planStart.getTime()) / DAY_MS)
      const weekday = date.getUTCDay()
      const cells: (string | null)[] = []
      for (let gi = 0; gi < groupCount; gi++) {
        if (dayIndex < 0) { cells.push(null); continue } // قبل بداية الخطة
        let shiftId = cycle > 0 ? this.slotFor(slots, cycle, gi, dayIndex) : null
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
        steps: { orderBy: { order: 'asc' }, include: { shift: { select: { id: true, name: true, startTime: true, endTime: true } } } },
        groups: {
          orderBy: { order: 'asc' },
          include: {
            supervisor: { select: { id: true, fullName: true, employeeCode: true } },
            members: {
              include: {
                employee: { select: { id: true, fullName: true, employeeCode: true } },
                pinnedShift: { select: { id: true, name: true, startTime: true, endTime: true } },
              },
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
        steps: { orderBy: { order: 'asc' }, include: { shift: { select: { id: true, name: true, startTime: true, endTime: true } } } },
        groups: {
          orderBy: { order: 'asc' },
          include: {
            supervisor: { select: { id: true, fullName: true, employeeCode: true } },
            members: {
              include: {
                employee: { select: { id: true, fullName: true, employeeCode: true } },
                pinnedShift: { select: { id: true, name: true, startTime: true, endTime: true } },
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    })
  }

  async create(tenantId: string, dto: {
    name: string
    steps: StepInput[]          // كل خطوة: شفت + عدد أيامه الخاص (مثال: 3 صباحي، 2 مسائي، 1 ليلي)
    restMode: string
    restDays?: number
    weeklyRestDays?: number[]
    workDaysBeforeRest?: number // لوضع AFTER_N_DAYS: عدد أيام العمل قبل الراحة
    startDate: string
    groupCount?: number
  }) {
    if (!dto.name?.trim()) throw new BadRequestException('اسم الخطة مطلوب')
    if (!dto.steps?.length) throw new BadRequestException('أضف شفتاً واحداً على الأقل')
    for (const s of dto.steps) {
      if (!s.shiftId) throw new BadRequestException('كل خطوة تحتاج شفتاً محدَّداً')
      if (!s.days || s.days < 1) throw new BadRequestException('عدد أيام كل خطوة يجب أن يكون 1 على الأقل')
    }
    const restMode = dto.restMode === 'WEEKLY' ? 'WEEKLY' : dto.restMode === 'AFTER_N_DAYS' ? 'AFTER_N_DAYS' : 'AT_ROTATION'
    if (restMode === 'AFTER_N_DAYS' && (!dto.workDaysBeforeRest || dto.workDaysBeforeRest < 1)) {
      throw new BadRequestException('حدد عدد أيام العمل قبل الراحة (1 على الأقل)')
    }

    // تحقق أن الشفتات تابعة لنفس الشركة
    const shiftIds = dto.steps.map(s => s.shiftId)
    const shifts = await prisma.shift.findMany({ where: { tenantId, id: { in: shiftIds } } })
    if (shifts.length !== new Set(shiftIds).size) throw new BadRequestException('شفت غير صالح')

    const groupCount = Math.min(Math.max(dto.groupCount ?? dto.steps.length + 1, 1), 8)

    return prisma.rotationPlan.create({
      data: {
        tenantId,
        name: dto.name.trim(),
        restMode,
        restDays: Math.max(0, dto.restDays ?? 1),
        weeklyRestDays: dto.weeklyRestDays ?? [],
        workDaysBeforeRest: restMode === 'AFTER_N_DAYS' ? Math.max(1, dto.workDaysBeforeRest!) : 0,
        startDate: new Date(dto.startDate),
        steps: {
          create: dto.steps.map((s, i) => ({ order: i + 1, shiftId: s.shiftId, days: Math.max(1, s.days) })),
        },
        groups: {
          create: Array.from({ length: groupCount }, (_, i) => ({
            name: GROUP_NAMES[i] ?? `مجموعة ${i + 1}`,
            order: i,
          })),
        },
      },
      include: { steps: true, groups: true },
    })
  }

  async remove(tenantId: string, id: string) {
    await this.getPlan(tenantId, id)
    await prisma.rotationPlan.delete({ where: { id } }) // steps/groups/members تُحذف تلقائياً (cascade)
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

  /* ── تعيين/إلغاء مشرف الفترة لهذه المجموعة ── */
  async setGroupSupervisor(tenantId: string, groupId: string, employeeId: string | null) {
    const group = await prisma.rotationGroup.findFirst({ where: { id: groupId, plan: { tenantId } } })
    if (!group) throw new NotFoundException('المجموعة غير موجودة')

    let supervisorId: string | null = null
    if (employeeId) {
      const employee = await prisma.employee.findFirst({ where: { id: employeeId, tenantId } })
      if (!employee) throw new BadRequestException('موظف غير صالح')
      supervisorId = employee.id
    }

    return prisma.rotationGroup.update({
      where: { id: groupId },
      data: { supervisorEmployeeId: supervisorId },
      include: { supervisor: { select: { id: true, fullName: true } } },
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

  async addMembers(tenantId: string, groupId: string, employeeIds: string[], pinnedShiftId?: string | null) {
    const group = await prisma.rotationGroup.findFirst({ where: { id: groupId, plan: { tenantId } } })
    if (!group) throw new NotFoundException('المجموعة غير موجودة')
    if (!employeeIds?.length) return { added: 0 }

    const valid = await prisma.employee.findMany({
      where: { tenantId, id: { in: employeeIds }, status: 'ACTIVE' },
      select: { id: true },
    })

    let pinnedId: string | null = null
    if (pinnedShiftId) {
      const shift = await prisma.shift.findFirst({ where: { id: pinnedShiftId, tenantId } })
      if (!shift) throw new BadRequestException('شفت التثبيت غير صالح')
      pinnedId = shift.id
    }

    // أزل الموظف من أي مجموعة أخرى في نفس الخطة (لا يكون في مجموعتين)
    await prisma.rotationGroupMember.deleteMany({
      where: { employeeId: { in: valid.map(v => v.id) }, group: { planId: group.planId } },
    })

    await prisma.rotationGroupMember.createMany({
      data: valid.map(v => ({ groupId, employeeId: v.id, pinnedShiftId: pinnedId })),
      skipDuplicates: true,
    })
    return { added: valid.length }
  }

  /* ── تثبيت/إلغاء تثبيت عضو موجود على شفت معيّن (بلا تناوب) ── */
  async pinMember(tenantId: string, groupId: string, employeeId: string, shiftId: string | null) {
    const member = await prisma.rotationGroupMember.findFirst({
      where: { groupId, employeeId, group: { plan: { tenantId } } },
    })
    if (!member) throw new NotFoundException('العضو غير موجود في هذه المجموعة')

    let pinnedId: string | null = null
    if (shiftId) {
      const shift = await prisma.shift.findFirst({ where: { id: shiftId, tenantId } })
      if (!shift) throw new BadRequestException('شفت غير صالح')
      pinnedId = shift.id
    }

    return prisma.rotationGroupMember.update({
      where: { id: member.id },
      data: { pinnedShiftId: pinnedId },
      include: { pinnedShift: { select: { id: true, name: true } } },
    })
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
    const stepInputs = plan.steps.map(s => ({ shiftId: s.shiftId, days: s.days }))
    // المصفوفة تمثّل فقط الأعضاء المتناوبين — الأعضاء المثبَّتين على شفت معيّن خارج دورة التناوب تماماً
    const matrix = this.buildMatrix({ ...plan, steps: stepInputs }, plan.groups.length, windowStart, horizon)
    return {
      planId: plan.id,
      startDate: dateOnly(windowStart),
      days: horizon,
      groups: plan.groups.map(g => ({
        id: g.id,
        name: g.name,
        memberCount: g.members.filter(m => !m.pinnedShiftId).length,
        pinned: g.members
          .filter(m => m.pinnedShiftId)
          .map(m => ({ employeeId: m.employeeId, employeeName: m.employee.fullName, shiftId: m.pinnedShiftId!, shiftName: m.pinnedShift?.name ?? '؟' })),
      })),
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

    const stepInputs = plan.steps.map(s => ({ shiftId: s.shiftId, days: s.days }))
    const matrix = this.buildMatrix({ ...plan, steps: stepInputs }, plan.groups.length, windowStart, horizon)

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

    // حوّل أعمدة المصفوفة إلى فترات متصلة لكل مجموعة — للأعضاء المتناوبين فقط
    const rows: Array<{ tenantId: string; employeeId: string; shiftId: string; effectiveFrom: Date; effectiveTo: Date }> = []
    plan.groups.forEach((g, gi) => {
      const rotatingMembers = g.members.filter(m => !m.pinnedShiftId)
      if (!rotatingMembers.length) return
      let runShift: string | null = null
      let runStart = 0
      const flush = (endIdx: number) => {
        if (!runShift) return
        for (const m of rotatingMembers) {
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

    // الأعضاء المثبَّتون على شفت معيّن: تعيين واحد ثابت طوال فترة التطبيق، بلا تناوب ولا راحة
    for (const g of plan.groups) {
      for (const m of g.members) {
        if (!m.pinnedShiftId) continue
        rows.push({ tenantId, employeeId: m.employeeId, shiftId: m.pinnedShiftId, effectiveFrom: windowStart, effectiveTo: windowEnd })
      }
    }

    await prisma.employeeShift.createMany({ data: rows })

    return {
      applied: rows.length,
      employees: allMembers.length,
      from: dateOnly(windowStart),
      to: dateOnly(windowEnd),
    }
  }
}
