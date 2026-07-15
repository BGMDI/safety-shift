import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common'
import { prisma } from '@shift-saas/database'

/* تاريخ اليوم بالتوقيت المحلي بصيغة YYYY-MM-DD */
const localDateStr = (d = new Date()) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

interface ShiftTimes { startTime: string; endTime: string; breakMinutes: number }

@Injectable()
export class AttendanceService {

  /* ── شفت الموظف الساري في تاريخ معين (إن وجد) ── */
  private async getActiveShift(tenantId: string, employeeId: string, date: Date) {
    const assignment = await prisma.employeeShift.findFirst({
      where: {
        tenantId,
        employeeId,
        effectiveFrom: { lte: date },
        OR: [{ effectiveTo: null }, { effectiveTo: { gte: date } }],
      },
      include: { shift: true },
      orderBy: { effectiveFrom: 'desc' },
    })
    return assignment?.shift ?? null
  }

  /* ── حساب التأخير والإضافي:
     مع شفت  → التأخير = الدخول بعد بداية الشفت، الإضافي = الخروج بعد نهايته
     بدون شفت → دوام ثابت 8 ساعات (الإضافي فقط) ── */
  private computeMinutes(dateStr: string, checkIn: Date | null, checkOut: Date | null, shift: ShiftTimes | null) {
    let lateMinutes = 0
    let overtimeMinutes = 0
    if (shift) {
      const start = new Date(`${dateStr}T${shift.startTime}`)
      let end = new Date(`${dateStr}T${shift.endTime}`)
      if (end <= start) end = new Date(end.getTime() + 24 * 60 * 60 * 1000) // شفت ليلي يعبر منتصف الليل
      if (checkIn) lateMinutes = Math.max(0, Math.floor((checkIn.getTime() - start.getTime()) / 60000))
      if (checkOut) overtimeMinutes = Math.max(0, Math.floor((checkOut.getTime() - end.getTime()) / 60000))
    } else if (checkIn && checkOut) {
      const worked = Math.floor((checkOut.getTime() - checkIn.getTime()) / 60000)
      overtimeMinutes = Math.max(0, worked - 480)
    }
    return { lateMinutes, overtimeMinutes }
  }

  /* ── كشف التحضير: كل الموظفين النشطين مع سجل اليوم (أو بدونه) ── */
  async getRoster(tenantId: string, dateStr?: string, filters?: { branchId?: string; departmentId?: string }) {
    const ds = dateStr || localDateStr()
    const date = new Date(ds)
    const [employees, logs] = await Promise.all([
      prisma.employee.findMany({
        where: {
          tenantId,
          status: 'ACTIVE',
          ...(filters?.branchId ? { branchId: filters.branchId } : {}),
          ...(filters?.departmentId ? { departmentId: filters.departmentId } : {}),
        },
        select: {
          id: true, fullName: true, employeeCode: true,
          branch: { select: { name: true } },
          department: { select: { name: true } },
        },
        orderBy: { fullName: 'asc' },
      }),
      prisma.attendanceLog.findMany({ where: { tenantId, date } }),
    ])
    const logMap = new Map(logs.map(l => [l.employeeId, l]))
    return employees.map(e => ({ ...e, log: logMap.get(e.id) ?? null }))
  }

  /* ── تحضير جماعي: تسجيل حالة لكل من لم يُسجَّل له بعد ── */
  async bulkMark(tenantId: string, data: { date: string; employeeIds: string[]; status?: string }) {
    if (!data.date) throw new BadRequestException('التاريخ مطلوب')
    if (!data.employeeIds?.length) return { marked: 0, skipped: 0 }
    const date = new Date(data.date)

    const existing = await prisma.attendanceLog.findMany({
      where: { tenantId, date, employeeId: { in: data.employeeIds } },
      select: { employeeId: true },
    })
    const done = new Set(existing.map(l => l.employeeId))
    const remaining = data.employeeIds.filter(id => !done.has(id))

    // تحقق أن الموظفين تابعون لنفس الشركة
    const valid = await prisma.employee.findMany({
      where: { tenantId, id: { in: remaining } },
      select: { id: true },
    })

    await prisma.attendanceLog.createMany({
      data: valid.map(v => ({
        tenantId,
        employeeId: v.id,
        date,
        status: (data.status as any) ?? 'PRESENT',
        source: 'MANUAL' as any,
      })),
    })
    return { marked: valid.length, skipped: data.employeeIds.length - valid.length }
  }

  /* ── قائمة السجلات (كما كانت) ── */
  async getLogs(tenantId: string, filters: { date?: string; employeeId?: string; startDate?: string; endDate?: string }) {
    const where: any = { tenantId }
    if (filters.employeeId) where.employeeId = filters.employeeId
    if (filters.date) where.date = new Date(filters.date)
    if (filters.startDate && filters.endDate) {
      where.date = { gte: new Date(filters.startDate), lte: new Date(filters.endDate) }
    }
    return prisma.attendanceLog.findMany({
      where,
      include: { employee: { select: { fullName: true, employeeCode: true } } },
      orderBy: { date: 'desc' },
    })
  }

  /* ── تسجيل/تحديث حضور — يحسب التأخير والإضافي من الشفت تلقائياً ── */
  async logAttendance(tenantId: string, data: {
    employeeId: string
    date: string
    checkIn?: string
    checkOut?: string
    status?: string
    source?: string
    notes?: string
  }) {
    const dateVal = new Date(data.date)
    const existing = await prisma.attendanceLog.findFirst({
      where: { tenantId, employeeId: data.employeeId, date: dateVal },
    })

    const payload: any = {
      tenantId,
      employeeId: data.employeeId,
      date: dateVal,
      status: (data.status as any) ?? existing?.status ?? 'PRESENT',
      source: (data.source as any) ?? 'MANUAL',
      notes: data.notes ?? existing?.notes,
    }
    if (data.checkIn) payload.checkIn = new Date(`${data.date}T${data.checkIn}`)
    if (data.checkOut) payload.checkOut = new Date(`${data.date}T${data.checkOut}`)

    // الأوقات الفعلية بعد الدمج مع السجل الموجود
    const effIn: Date | null  = payload.checkIn ?? existing?.checkIn ?? null
    const effOut: Date | null = payload.checkOut ?? existing?.checkOut ?? null

    const shift = await this.getActiveShift(tenantId, data.employeeId, dateVal)
    const m = this.computeMinutes(data.date, effIn, effOut, shift)
    payload.lateMinutes = m.lateMinutes
    payload.overtimeMinutes = m.overtimeMinutes
    if (m.lateMinutes > 0 && payload.status === 'PRESENT') payload.status = 'LATE'

    if (existing) {
      return prisma.attendanceLog.update({ where: { id: existing.id }, data: payload })
    }
    return prisma.attendanceLog.create({ data: payload })
  }

  /* ── تعديل سجل موجود — مع أرشفة قبل/بعد في سجل التدقيق ── */
  async updateLog(
    tenantId: string,
    id: string,
    data: { checkIn?: string | null; checkOut?: string | null; status?: string; notes?: string },
    updatedBy?: string,
  ) {
    const existing = await prisma.attendanceLog.findFirst({ where: { id, tenantId } })
    if (!existing) throw new NotFoundException('سجل الحضور غير موجود')

    const dateStr = existing.date.toISOString().slice(0, 10)
    const upd: any = {}
    if (data.status !== undefined) upd.status = data.status
    if (data.notes !== undefined) upd.notes = data.notes
    if (data.checkIn !== undefined) upd.checkIn = data.checkIn ? new Date(`${dateStr}T${data.checkIn}`) : null
    if (data.checkOut !== undefined) upd.checkOut = data.checkOut ? new Date(`${dateStr}T${data.checkOut}`) : null

    const effIn: Date | null  = upd.checkIn !== undefined ? upd.checkIn : existing.checkIn
    const effOut: Date | null = upd.checkOut !== undefined ? upd.checkOut : existing.checkOut

    const shift = await this.getActiveShift(tenantId, existing.employeeId, existing.date)
    const m = this.computeMinutes(dateStr, effIn, effOut, shift)
    upd.lateMinutes = m.lateMinutes
    upd.overtimeMinutes = m.overtimeMinutes
    if (m.lateMinutes > 0 && (upd.status ?? existing.status) === 'PRESENT') upd.status = 'LATE'

    const updated = await prisma.attendanceLog.update({ where: { id }, data: upd })

    await prisma.auditLog.create({
      data: {
        tenantId,
        employeeId: updatedBy,
        action: 'UPDATE',
        module: 'attendance',
        entityId: id,
        oldData: JSON.parse(JSON.stringify(existing)),
        newData: JSON.parse(JSON.stringify(updated)),
      },
    })
    return updated
  }

  /* ── سجلّي اليوم (للتحضير الذاتي) ── */
  async getMyToday(tenantId: string, employeeId: string) {
    return prisma.attendanceLog.findFirst({
      where: { tenantId, employeeId, date: new Date(localDateStr()) },
    })
  }

  /* ── كشف حضوري الشخصي لشهر معيّن ── */
  async getMyLogs(tenantId: string, employeeId: string, month?: number, year?: number) {
    const where: any = { tenantId, employeeId }
    if (month && year) {
      where.date = { gte: new Date(year, month - 1, 1), lte: new Date(year, month, 0) }
    }
    const logs = await prisma.attendanceLog.findMany({ where, orderBy: { date: 'desc' } })
    const summary = {
      present:  logs.filter(l => l.status === 'PRESENT').length,
      late:     logs.filter(l => l.status === 'LATE').length,
      absent:   logs.filter(l => l.status === 'ABSENT').length,
      excused:  logs.filter(l => l.status === 'EXCUSED').length,
      totalLate:     logs.reduce((s, l) => s + l.lateMinutes, 0),
      totalOvertime: logs.reduce((s, l) => s + l.overtimeMinutes, 0),
    }
    return { logs, summary }
  }

  /* ── تحضير ذاتي: حضور أو انصراف الآن ── */
  async selfCheck(tenantId: string, employeeId: string, type: 'in' | 'out') {
    const dateStr = localDateStr()
    const date = new Date(dateStr)
    const now = new Date()
    const existing = await prisma.attendanceLog.findFirst({ where: { tenantId, employeeId, date } })
    const shift = await this.getActiveShift(tenantId, employeeId, date)

    if (type === 'in') {
      if (existing?.checkIn) throw new BadRequestException('سجلت حضورك مسبقاً اليوم')
      const m = this.computeMinutes(dateStr, now, existing?.checkOut ?? null, shift)
      const payload = {
        checkIn: now,
        lateMinutes: m.lateMinutes,
        overtimeMinutes: m.overtimeMinutes,
        status: (m.lateMinutes > 0 ? 'LATE' : 'PRESENT') as any,
        source: 'SELF' as any,
      }
      if (existing) return prisma.attendanceLog.update({ where: { id: existing.id }, data: payload })
      return prisma.attendanceLog.create({ data: { tenantId, employeeId, date, ...payload } })
    }

    // انصراف
    if (!existing?.checkIn) throw new BadRequestException('سجل حضورك أولاً قبل الانصراف')
    if (existing.checkOut) throw new BadRequestException('سجلت انصرافك مسبقاً اليوم')
    const m = this.computeMinutes(dateStr, existing.checkIn, now, shift)
    return prisma.attendanceLog.update({
      where: { id: existing.id },
      data: { checkOut: now, lateMinutes: m.lateMinutes, overtimeMinutes: m.overtimeMinutes },
    })
  }

  /* ── استيراد سجلات بصمة (CSV مُحوَّل إلى JSON) ── */
  async importLogs(
    tenantId: string,
    rows: Array<{ employeeCode: string; date: string; checkIn?: string; checkOut?: string }>,
  ) {
    if (!Array.isArray(rows) || rows.length === 0) throw new BadRequestException('لا توجد صفوف للاستيراد')
    if (rows.length > 2000) throw new BadRequestException('الحد الأقصى 2000 صف لكل عملية استيراد')

    const codes = [...new Set(rows.map(r => r.employeeCode))]
    const employees = await prisma.employee.findMany({
      where: { tenantId, employeeCode: { in: codes } },
      select: { id: true, employeeCode: true },
    })
    const codeMap = new Map(employees.map(e => [e.employeeCode, e.id]))

    let imported = 0
    const skipped: Array<{ row: number; reason: string }> = []

    for (let i = 0; i < rows.length; i++) {
      const r = rows[i]
      const empId = codeMap.get(r.employeeCode)
      if (!empId) { skipped.push({ row: i + 1, reason: `رقم موظف غير معروف: ${r.employeeCode}` }); continue }
      if (!/^\d{4}-\d{2}-\d{2}$/.test(r.date)) { skipped.push({ row: i + 1, reason: `تاريخ غير صالح: ${r.date}` }); continue }
      try {
        await this.logAttendance(tenantId, {
          employeeId: empId,
          date: r.date,
          checkIn: r.checkIn || undefined,
          checkOut: r.checkOut || undefined,
          source: 'BIOMETRIC',
        })
        imported++
      } catch {
        skipped.push({ row: i + 1, reason: 'فشل الحفظ' })
      }
    }
    return { imported, skipped }
  }

  /* ── حذف سجل — مقيد بالأدوار ومؤرشف في التدقيق ── */
  async deleteLog(tenantId: string, id: string, deletedBy?: string) {
    const log = await prisma.attendanceLog.findFirst({ where: { id, tenantId } })
    if (!log) throw new NotFoundException('سجل الحضور غير موجود')

    await prisma.attendanceLog.delete({ where: { id } })

    // أرشفة السجل المحذوف في سجل التدقيق
    await prisma.auditLog.create({
      data: {
        tenantId,
        employeeId: deletedBy,
        action: 'DELETE',
        module: 'attendance',
        entityId: id,
        oldData: JSON.parse(JSON.stringify(log)),
      },
    })

    return { message: 'تم حذف السجل' }
  }

  /* ── الملخص الشهري لكل موظف ── */
  async getSummary(tenantId: string, month: number, year: number) {
    const start = new Date(year, month - 1, 1)
    const end = new Date(year, month, 0)
    const logs = await prisma.attendanceLog.findMany({
      where: { tenantId, date: { gte: start, lte: end } },
      include: { employee: { select: { fullName: true, employeeCode: true } } },
    })

    const byEmployee: Record<string, any> = {}
    for (const log of logs) {
      const eid = log.employeeId
      if (!byEmployee[eid]) {
        byEmployee[eid] = {
          employeeId: eid,
          fullName: log.employee.fullName,
          employeeCode: log.employee.employeeCode,
          present: 0, absent: 0, late: 0, excused: 0,
          totalLate: 0, totalOvertime: 0,
        }
      }
      const s = log.status
      if (s === 'PRESENT') byEmployee[eid].present++
      else if (s === 'ABSENT') byEmployee[eid].absent++
      else if (s === 'LATE') byEmployee[eid].late++
      else if (s === 'EXCUSED') byEmployee[eid].excused++
      byEmployee[eid].totalLate += log.lateMinutes
      byEmployee[eid].totalOvertime += log.overtimeMinutes
    }
    return Object.values(byEmployee)
  }
}
