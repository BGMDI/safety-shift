import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common'
import { prisma } from '@shift-saas/database'
import {
  CreateLeaveTypeDto, UpdateLeaveTypeDto,
  AutoAssignBalancesDto,
  CreateLeaveBalanceDto, CreateLeaveRequestDto, ApproveLeaveDto,
} from './dto/leave.dto'

/**
 * أنواع طريقة الاحتساب:
 *  FIXED               – نفس الأيام لجميع الموظفين (الزواج، الوفاة، الأبوة...)
 *  SENIORITY_BASED     – يعتمد على سنوات الخدمة (الإجازة السنوية: 21 أو 30)
 *  SICK_TIERED         – متدرّج: maxDays (كامل) + maxDaysHalfPay (نصف) + maxDaysUnpaid (بدون)
 *  ONCE_PER_EMPLOYMENT – مرة واحدة طوال الخدمة (الحج)
 *  PER_EVENT           – تُضاف عند وقوع الحدث (الأمومة، الزواج، الوفاة)
 */
export const CALC_TYPES = ['FIXED', 'SENIORITY_BASED', 'SICK_TIERED', 'ONCE_PER_EMPLOYMENT', 'PER_EVENT'] as const
export type CalcType = (typeof CALC_TYPES)[number]

export const CALC_LABELS: Record<CalcType, string> = {
  FIXED:               'ثابت للجميع',
  SENIORITY_BASED:     'يعتمد على سنوات الخدمة',
  SICK_TIERED:         'متدرّج (كامل / نصف / بدون)',
  ONCE_PER_EMPLOYMENT: 'مرة واحدة في الخدمة',
  PER_EVENT:           'يُضاف عند وقوع الحدث',
}

/** الأنواع الافتراضية وفق نظام العمل السعودي */
const SAUDI_LABOR_DEFAULTS = [
  {
    name: 'الإجازة السنوية',
    description: 'المادة 109 – 21 يومًا للموظف الذي لم تبلغ مدة خدمته 5 سنوات، 30 يومًا لمن بلغت مدة خدمته 5 سنوات فأكثر.',
    maxDays: 30, minDays: 21, seniorityThreshold: 5,
    requiresApproval: true, color: '#3B82F6',
    isSystemDefault: true, calculationType: 'SENIORITY_BASED',
  },
  {
    name: 'الإجازة المرضية',
    description: 'المادة 117 – 30 يومًا براتب كامل، ثم 60 يومًا بـ75%، ثم 30 يومًا بدون راتب خلال السنة.',
    maxDays: 30, maxDaysHalfPay: 60, maxDaysUnpaid: 30,
    requiresApproval: true, color: '#EF4444',
    isSystemDefault: true, calculationType: 'SICK_TIERED',
  },
  {
    name: 'إجازة الوضع (الأمومة)',
    description: 'المادة 151 – 12 أسبوعًا (84 يومًا) براتب كامل تُمنح عند الولادة.',
    maxDays: 84,
    requiresApproval: false, color: '#EC4899',
    isSystemDefault: true, calculationType: 'PER_EVENT',
  },
  {
    name: 'إجازة الأبوة',
    description: 'المادة 113/أ – 3 أيام براتب كامل عند ولادة المولود.',
    maxDays: 3,
    requiresApproval: false, color: '#8B5CF6',
    isSystemDefault: true, calculationType: 'PER_EVENT',
  },
  {
    name: 'إجازة الحج',
    description: 'المادة 113 – مرة واحدة طوال مدة الخدمة، لا تزيد على 10 أيام ولا تُخصم من الإجازة السنوية.',
    maxDays: 10,
    requiresApproval: true, color: '#F59E0B',
    isSystemDefault: true, calculationType: 'ONCE_PER_EMPLOYMENT',
  },
  {
    name: 'إجازة الزواج',
    description: 'المادة 113/ب – 3 أيام براتب كامل بمناسبة زواج الموظف.',
    maxDays: 3,
    requiresApproval: false, color: '#10B981',
    isSystemDefault: true, calculationType: 'PER_EVENT',
  },
  {
    name: 'إجازة الوفاة',
    description: 'المادة 113/ج – 3 أيام براتب كامل عند وفاة أحد أفراد الأسرة.',
    maxDays: 3,
    requiresApproval: false, color: '#6B7280',
    isSystemDefault: true, calculationType: 'PER_EVENT',
  },
  {
    name: 'إجازة العدة',
    description: 'المادة 160 – 4 أشهر و10 أيام براتب كامل للموظفة المسلمة عند وفاة زوجها.',
    maxDays: 130,
    requiresApproval: false, color: '#9CA3AF',
    isSystemDefault: true, calculationType: 'PER_EVENT',
  },
  {
    name: 'الإجازة الدراسية',
    description: 'المادة 115 – يحق للموظف إجازة لأداء الامتحانات بعدد أيام الامتحان الفعلية، وتُمنح مرة واحدة لنفس المستوى.',
    maxDays: 30,
    requiresApproval: true, color: '#06B6D4',
    isSystemDefault: true, calculationType: 'FIXED',
  },
]

@Injectable()
export class LeavesService {

  // ── أنواع الإجازات ─────────────────────────────────────────────────
  async getLeaveTypes(tenantId: string) {
    return prisma.leaveType.findMany({
      where: { tenantId },
      include: { _count: { select: { leaveRequests: true } } },
      orderBy: [{ isSystemDefault: 'desc' }, { name: 'asc' }],
    })
  }

  async createLeaveType(tenantId: string, dto: CreateLeaveTypeDto) {
    return prisma.leaveType.create({
      data: {
        tenantId,
        name: dto.name,
        description: dto.description,
        maxDays: dto.maxDays,
        maxDaysHalfPay: dto.maxDaysHalfPay,
        maxDaysUnpaid: dto.maxDaysUnpaid,
        requiresApproval: dto.requiresApproval ?? true,
        color: dto.color,
        isSystemDefault: dto.isSystemDefault ?? false,
        calculationType: dto.calculationType ?? 'FIXED',
        minDays: dto.minDays,
        seniorityThreshold: dto.seniorityThreshold,
      },
    })
  }

  async updateLeaveType(tenantId: string, id: string, dto: UpdateLeaveTypeDto) {
    const lt = await prisma.leaveType.findFirst({ where: { id, tenantId } })
    if (!lt) throw new NotFoundException('نوع الإجازة غير موجود')
    return prisma.leaveType.update({
      where: { id },
      data: {
        ...(dto.name !== undefined             && { name: dto.name }),
        ...(dto.description !== undefined      && { description: dto.description }),
        ...(dto.maxDays !== undefined          && { maxDays: dto.maxDays }),
        ...(dto.maxDaysHalfPay !== undefined   && { maxDaysHalfPay: dto.maxDaysHalfPay }),
        ...(dto.maxDaysUnpaid !== undefined    && { maxDaysUnpaid: dto.maxDaysUnpaid }),
        ...(dto.requiresApproval !== undefined && { requiresApproval: dto.requiresApproval }),
        ...(dto.color !== undefined            && { color: dto.color }),
        ...(dto.calculationType !== undefined  && { calculationType: dto.calculationType }),
        ...(dto.minDays !== undefined          && { minDays: dto.minDays }),
        ...(dto.seniorityThreshold !== undefined && { seniorityThreshold: dto.seniorityThreshold }),
      },
    })
  }

  async removeLeaveType(tenantId: string, id: string) {
    const lt = await prisma.leaveType.findFirst({ where: { id, tenantId } })
    if (!lt) throw new NotFoundException('نوع الإجازة غير موجود')
    const count = await prisma.leaveRequest.count({ where: { leaveTypeId: id } })
    if (count > 0) throw new BadRequestException(`لا يمكن الحذف — يوجد ${count} طلب إجازة مرتبط`)
    await prisma.leaveType.delete({ where: { id } })
    return { message: 'تم الحذف' }
  }

  /** إنشاء أنواع نظام العمل السعودي تلقائياً */
  async seedSaudiDefaults(tenantId: string) {
    const existing = await prisma.leaveType.findMany({ where: { tenantId }, select: { name: true } })
    const existingNames = new Set(existing.map(e => e.name))
    const toCreate = SAUDI_LABOR_DEFAULTS.filter(d => !existingNames.has(d.name))
    if (toCreate.length === 0) return { created: 0, message: 'جميع الأنواع موجودة مسبقاً' }
    await prisma.leaveType.createMany({ data: toCreate.map(d => ({ ...d, tenantId })) })
    return { created: toCreate.length, message: `تم إنشاء ${toCreate.length} نوع إجازة` }
  }

  // ── الاحتساب التلقائي للأرصدة ────────────────────────────────────
  async autoAssignBalances(tenantId: string, dto: AutoAssignBalancesDto) {
    const { year, employeeId } = dto
    const yearStart = new Date(year, 0, 1)   // 1 يناير من السنة

    const employees = await prisma.employee.findMany({
      where: { tenantId, status: 'ACTIVE', ...(employeeId ? { id: employeeId } : {}) },
      select: { id: true, hireDate: true, fullName: true },
    })
    if (employees.length === 0) throw new BadRequestException('لا يوجد موظفون نشطون')

    const leaveTypes = await prisma.leaveType.findMany({ where: { tenantId } })

    let assigned = 0
    const skipped: string[] = []

    for (const emp of employees) {
      // سنوات الخدمة حتى بداية السنة
      const msPerYear   = 365.25 * 24 * 60 * 60 * 1000
      const yearsService = (yearStart.getTime() - emp.hireDate.getTime()) / msPerYear

      for (const lt of leaveTypes) {
        let entitledDays: number | null = null

        switch (lt.calculationType) {
          case 'SENIORITY_BASED': {
            // الإجازة السنوية: 21 يوم قبل العتبة، maxDays بعدها
            const threshold = lt.seniorityThreshold ?? 5
            const junior    = lt.minDays ?? lt.maxDays
            entitledDays = yearsService >= threshold ? lt.maxDays : junior
            break
          }

          case 'SICK_TIERED':
            // تُمنح أيام الراتب الكامل فقط كرصيد أساسي
            entitledDays = lt.maxDays
            break

          case 'FIXED':
            entitledDays = lt.maxDays
            break

          case 'ONCE_PER_EMPLOYMENT': {
            // الحج: تحقق هل استُخدم في أي سنة سابقة
            const prevUsage = await prisma.leaveBalance.findFirst({
              where: { tenantId, employeeId: emp.id, leaveTypeId: lt.id, usedDays: { gt: 0 } },
            })
            // تحقق أيضاً من طلبات مقبولة
            const approvedReq = await prisma.leaveRequest.findFirst({
              where: { tenantId, employeeId: emp.id, leaveTypeId: lt.id, status: 'APPROVED' },
            })
            entitledDays = (prevUsage || approvedReq) ? 0 : lt.maxDays
            break
          }

          case 'PER_EVENT':
            // لا تُضاف تلقائياً — تُمنح عند الحدث
            skipped.push(lt.name)
            continue

          default:
            entitledDays = lt.maxDays
        }

        if (entitledDays !== null) {
          await prisma.leaveBalance.upsert({
            where: {
              employeeId_leaveTypeId_year: {
                employeeId: emp.id,
                leaveTypeId: lt.id,
                year,
              },
            },
            update:  { entitledDays },
            create:  { tenantId, employeeId: emp.id, leaveTypeId: lt.id, year, entitledDays },
          })
          assigned++
        }
      }
    }

    const skippedUniq = [...new Set(skipped)]
    return {
      employees: employees.length,
      assigned,
      skippedTypes: skippedUniq,
      message: `تم توزيع ${assigned} رصيد على ${employees.length} موظف لسنة ${year}`,
      note: skippedUniq.length
        ? `الأنواع التالية لم تُحتسب تلقائياً (تُمنح عند الحدث): ${skippedUniq.join('، ')}`
        : undefined,
    }
  }

  // ── أرصدة الإجازات ──────────────────────────────────────────────
  async getEmployeeBalances(tenantId: string, employeeId: string) {
    return prisma.leaveBalance.findMany({
      where: { tenantId, employeeId },
      include: { leaveType: { select: { name: true, maxDays: true } } },
      orderBy: { year: 'desc' },
    })
  }

  async setLeaveBalance(tenantId: string, dto: CreateLeaveBalanceDto) {
    return prisma.leaveBalance.upsert({
      where: {
        employeeId_leaveTypeId_year: {
          employeeId: dto.employeeId,
          leaveTypeId: dto.leaveTypeId,
          year: dto.year,
        },
      },
      update:  { entitledDays: dto.entitledDays },
      create:  { tenantId, employeeId: dto.employeeId, leaveTypeId: dto.leaveTypeId, year: dto.year, entitledDays: dto.entitledDays },
    })
  }

  // ── طلبات الإجازات ──────────────────────────────────────────────
  async getRequests(tenantId: string, employeeId?: string, status?: string) {
    return prisma.leaveRequest.findMany({
      where: {
        tenantId,
        ...(employeeId ? { employeeId } : {}),
        ...(status ? { status: status as any } : {}),
      },
      include: {
        employee: { select: { fullName: true, employeeCode: true } },
        leaveType: { select: { name: true } },
      },
      orderBy: { createdAt: 'desc' },
    })
  }

  async submitRequest(tenantId: string, employeeId: string, dto: CreateLeaveRequestDto) {
    const start = new Date(dto.startDate)
    const end   = new Date(dto.endDate)
    const days  = Math.ceil((end.getTime() - start.getTime()) / 86400000) + 1

    const balance = await prisma.leaveBalance.findFirst({
      where: { tenantId, employeeId, leaveTypeId: dto.leaveTypeId, year: start.getFullYear() },
    })
    if (!balance) throw new BadRequestException('لا يوجد رصيد إجازة لهذا النوع')
    const remaining = balance.entitledDays - balance.usedDays
    if (days > remaining) throw new BadRequestException(`الرصيد المتاح ${remaining} يوم فقط`)

    return prisma.leaveRequest.create({
      data: {
        tenantId, employeeId,
        leaveTypeId: dto.leaveTypeId,
        startDate: start, endDate: end,
        notes: dto.notes,
        status: 'PENDING',
      },
    })
  }

  async approveRequest(tenantId: string, requestId: string, approverId: string, dto: ApproveLeaveDto) {
    const req = await prisma.leaveRequest.findFirst({ where: { id: requestId, tenantId } })
    if (!req) throw new NotFoundException('الطلب غير موجود')
    if (req.status !== 'PENDING') throw new BadRequestException('تم البت في هذا الطلب مسبقاً')

    if (dto.status === 'APPROVED') {
      const days = Math.ceil((req.endDate.getTime() - req.startDate.getTime()) / 86400000) + 1
      await prisma.leaveBalance.updateMany({
        where: { employeeId: req.employeeId, leaveTypeId: req.leaveTypeId, year: req.startDate.getFullYear() },
        data:  { usedDays: { increment: days } },
      })
    }

    return prisma.leaveRequest.update({
      where: { id: requestId },
      data:  { status: dto.status, approvedBy: approverId },
    })
  }
}
