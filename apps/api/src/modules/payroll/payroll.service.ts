import { Injectable, NotFoundException, ConflictException } from '@nestjs/common'
import { prisma } from '@shift-saas/database'

@Injectable()
export class PayrollService {
  async getRuns(tenantId: string) {
    return prisma.payrollRun.findMany({
      where: { tenantId },
      include: { _count: { select: { details: true } } },
      orderBy: [{ year: 'desc' }, { month: 'desc' }],
    })
  }

  async getRun(tenantId: string, id: string) {
    const run = await prisma.payrollRun.findFirst({
      where: { tenantId, id },
      include: {
        details: {
          include: { employee: { select: { fullName: true, employeeCode: true, jobTitle: { select: { name: true } } } } },
        },
      },
    })
    if (!run) throw new NotFoundException('Payroll run not found')
    return run
  }

  /* ── قسائم راتب موظف واحد — المسيّرات المعتمدة/المدفوعة فقط ── */
  async getEmployeePayslips(tenantId: string, employeeId: string) {
    const details = await prisma.payrollDetail.findMany({
      where: {
        employeeId,
        payrollRun: { tenantId, status: { in: ['APPROVED', 'PAID'] } },
      },
      include: { payrollRun: { select: { month: true, year: true, status: true, approvedAt: true } } },
    })
    // ترتيب تنازلي حسب السنة ثم الشهر
    return details.sort((a, b) =>
      b.payrollRun.year - a.payrollRun.year || b.payrollRun.month - a.payrollRun.month,
    )
  }

  async createRun(tenantId: string, month: number, year: number) {
    const existing = await prisma.payrollRun.findFirst({ where: { tenantId, month, year } })
    if (existing) throw new ConflictException('Payroll run already exists for this period')

    const employees = await prisma.employee.findMany({
      where: { tenantId, status: 'ACTIVE' },
      include: { salaryComponents: true },
    })

    const start = new Date(year, month - 1, 1)
    const end = new Date(year, month, 0)
    const workingDaysInMonth = this.countWorkingDays(start, end)

    const run = await prisma.payrollRun.create({
      data: { tenantId, month, year, status: 'DRAFT', totalAmount: 0 },
    })

    let total = 0
    for (const emp of employees) {
      const base = emp.salaryComponents.find(c => c.type === 'BASE')
      const baseSalary = Number(base?.amount ?? 0)
      const allowances = emp.salaryComponents.filter(c => c.type === 'ALLOWANCE').reduce((s, c) => s + Number(c.amount), 0)
      const deductions = emp.salaryComponents.filter(c => c.type === 'DEDUCTION').reduce((s, c) => s + Number(c.amount), 0)

      const attendanceLogs = await prisma.attendanceLog.findMany({
        where: { tenantId, employeeId: emp.id, date: { gte: start, lte: end } },
      })
      const absentDays = attendanceLogs.filter(l => l.status === 'ABSENT').length
      const absenceDeduction = absentDays > 0 ? (baseSalary / workingDaysInMonth) * absentDays : 0
      const lateMinutes = attendanceLogs.reduce((s, l) => s + l.lateMinutes, 0)
      const lateDeduction = lateMinutes > 0 ? (baseSalary / workingDaysInMonth / 8 / 60) * lateMinutes : 0
      const netSalary = baseSalary + allowances - deductions - absenceDeduction - lateDeduction

      await prisma.payrollDetail.create({
        data: {
          payrollRunId: run.id, employeeId: emp.id,
          baseSalary, totalAllowances: allowances, totalDeductions: deductions,
          absenceDeduction, lateDeduction, netSalary: Math.max(0, netSalary),
          workingDays: workingDaysInMonth, absentDays,
        },
      })
      total += Math.max(0, netSalary)
    }

    return prisma.payrollRun.update({ where: { id: run.id }, data: { totalAmount: total } })
  }

  async approveRun(tenantId: string, id: string, approverId: string) {
    const run = await prisma.payrollRun.findFirst({ where: { tenantId, id } })
    if (!run) throw new NotFoundException('Not found')
    return prisma.payrollRun.update({
      where: { id },
      data: { status: 'APPROVED', approvedBy: approverId, approvedAt: new Date() },
    })
  }

  async deleteRun(tenantId: string, id: string) {
    const run = await prisma.payrollRun.findFirst({ where: { tenantId, id } })
    if (!run) throw new NotFoundException('Not found')
    if (run.status !== 'DRAFT') throw new ConflictException('Cannot delete approved payroll run')
    await prisma.payrollDetail.deleteMany({ where: { payrollRunId: id } })
    return prisma.payrollRun.delete({ where: { id } })
  }

  private countWorkingDays(start: Date, end: Date): number {
    let count = 0
    const cur = new Date(start)
    while (cur <= end) {
      const d = cur.getDay()
      if (d !== 5 && d !== 6) count++
      cur.setDate(cur.getDate() + 1)
    }
    return count || 22
  }
}
