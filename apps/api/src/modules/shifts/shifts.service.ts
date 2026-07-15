import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common'
import { prisma } from '@shift-saas/database'
import { ShiftScheduleEntry } from '@shift-saas/types'

@Injectable()
export class ShiftsService {
  async findAll(tenantId: string) {
    return prisma.shift.findMany({
      where: { tenantId },
      include: { branch: { select: { id: true, name: true } } },
      orderBy: { startTime: 'asc' },
    })
  }

  async create(tenantId: string, data: {
    branchId?: string
    name: string
    startTime: string
    endTime: string
    breakMinutes?: number
    isNightShift?: boolean
    workingDays: number[]
  }) {
    // تحقق أن الفرع تابع للشركة — وإلا استخدم أول فرع
    let branchId = data.branchId
    const valid = branchId
      ? await prisma.branch.findFirst({ where: { id: branchId, tenantId } })
      : null
    if (!valid) {
      const first = await prisma.branch.findFirst({ where: { tenantId }, orderBy: { createdAt: 'asc' } })
      if (!first) throw new BadRequestException('أنشئ فرعاً أولاً من صفحة الهيكل التنظيمي')
      branchId = first.id
    }
    return prisma.shift.create({ data: { ...data, branchId: branchId!, tenantId } })
  }

  async assignEmployeeToShift(tenantId: string, data: {
    employeeId: string
    shiftId: string
    effectiveFrom: Date
    effectiveTo?: Date
  }) {
    // Close any active assignment first
    await prisma.employeeShift.updateMany({
      where: { tenantId, employeeId: data.employeeId, effectiveTo: null },
      data: { effectiveTo: data.effectiveFrom },
    })

    return prisma.employeeShift.create({ data: { ...data, tenantId } })
  }

  // Automatic scheduling: generate schedule for a date range (optionally for a single employee)
  async generateSchedule(tenantId: string, startDate: Date, endDate: Date, employeeId?: string): Promise<ShiftScheduleEntry[]> {
    const assignments = await prisma.employeeShift.findMany({
      where: {
        tenantId,
        ...(employeeId ? { employeeId } : {}),
        effectiveFrom: { lte: endDate },
        OR: [{ effectiveTo: null }, { effectiveTo: { gte: startDate } }],
      },
      include: {
        employee: { select: { id: true, fullName: true } },
        shift: true,
      },
    })

    const schedule: ShiftScheduleEntry[] = []
    const current = new Date(startDate)

    while (current <= endDate) {
      const dayOfWeek = current.getDay()

      for (const assignment of assignments) {
        // التعيين يغطي هذا اليوم تحديداً (مهم لفترات التدوير القصيرة)
        const covers =
          assignment.effectiveFrom <= current &&
          (assignment.effectiveTo === null || assignment.effectiveTo >= current)
        if (covers && assignment.shift.workingDays.includes(dayOfWeek)) {
          schedule.push({
            employeeId: assignment.employee.id,
            employeeName: assignment.employee.fullName,
            shiftId: assignment.shift.id,
            shiftName: assignment.shift.name,
            date: current.toISOString().split('T')[0],
            startTime: assignment.shift.startTime,
            endTime: assignment.shift.endTime,
          })
        }
      }

      current.setDate(current.getDate() + 1)
    }

    return schedule
  }
}
