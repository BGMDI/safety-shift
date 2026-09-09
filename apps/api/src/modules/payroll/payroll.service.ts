import { Injectable, NotFoundException, ConflictException } from '@nestjs/common'
import { prisma } from '@shift-saas/database'
import { BankExportInput, generateWpsFile, SAUDI_BANKS } from './payroll-export'

@Injectable()
export class PayrollService {
  getExportBanks() { return SAUDI_BANKS.map(({ id, name, sarie }) => ({ id, name, sarie })) }

  async exportRun(tenantId: string, id: string, input: BankExportInput) {
    const run = await prisma.payrollRun.findFirst({
      where: { tenantId, id },
      include: { details: { include: { employee: { select: { fullName: true, nationalId: true, iban: true } } } } },
    })
    if (!run) throw new NotFoundException('مسير الرواتب غير موجود')
    if (!['APPROVED', 'PAID'].includes(run.status)) throw new ConflictException('يجب اعتماد مسير الرواتب قبل تصديره للبنك')
    return generateWpsFile(input, run.details.map(detail => ({
      netSalary: Number(detail.netSalary), baseSalary: Number(detail.baseSalary), totalAllowances: Number(detail.totalAllowances),
      housingAllowance: Number(detail.housingAllowance), otherEarnings: Number(detail.otherEarnings),
      overtimeAmount: Number(detail.overtimeAmount),
      totalDeductions: Number(detail.totalDeductions), absenceDeduction: Number(detail.absenceDeduction), lateDeduction: Number(detail.lateDeduction),
      employee: detail.employee,
    })), { month: run.month, year: run.year })
  }

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
      include: { salaryComponents: true, jobTitle: true },
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
      const baseSalary = emp.jobTitle
        ? Number(emp.jobTitle.baseSalary) + ((emp.jobGrade ?? 1) - 1) * Number(emp.jobTitle.gradeIncrement)
        : Number(base?.amount ?? 0)
      const customJobAllowances = Array.isArray(emp.jobTitle?.customAllowances) ? emp.jobTitle.customAllowances as { name: string; amount: number }[] : []
      const jobAllowances = emp.jobTitle ? [
        { name: 'بدل السكن', amount: emp.jobTitle.housingAllowance },
        { name: 'بدل المواصلات', amount: emp.jobTitle.transportAllowance },
        { name: 'بدلات أخرى', amount: emp.jobTitle.otherAllowance },
        ...customJobAllowances,
      ].filter(component => Number(component.amount) > 0) : []
      const allowanceComponents = [...jobAllowances, ...emp.salaryComponents.filter(c => c.type === 'ALLOWANCE')]
      const housingAllowance = allowanceComponents.filter(c => /سكن|housing/i.test(c.name)).reduce((s, c) => s + Number(c.amount), 0)
      const bonusAmount = allowanceComponents.filter(c => /مكاف|bonus|reward/i.test(c.name)).reduce((s, c) => s + Number(c.amount), 0)
      const regularAllowances = allowanceComponents.filter(c => !/سكن|housing|مكاف|bonus|reward/i.test(c.name))
      const regularAllowanceTotal = regularAllowances.reduce((s, c) => s + Number(c.amount), 0)
      const allowances = housingAllowance + regularAllowanceTotal + bonusAmount
      const deductionComponents = emp.salaryComponents.filter(c => c.type === 'DEDUCTION')
      const automaticInsurance = emp.jobTitle ? baseSalary * Number(emp.jobTitle.insuranceRate) / 100 : 0
      const manualInsurance = deductionComponents.filter(c => /تأمين|gosi|insurance/i.test(c.name)).reduce((s, c) => s + Number(c.amount), 0)
      const insuranceDeduction = automaticInsurance > 0 ? automaticInsurance : manualInsurance
      const deductions = insuranceDeduction + deductionComponents.filter(c => !/تأمين|gosi|insurance/i.test(c.name)).reduce((s, c) => s + Number(c.amount), 0)

      const attendanceLogs = await prisma.attendanceLog.findMany({
        where: { tenantId, employeeId: emp.id, date: { gte: start, lte: end } },
      })
      const absentDays = attendanceLogs.filter(l => l.status === 'ABSENT').length
      const absenceDeduction = absentDays > 0 ? (baseSalary / workingDaysInMonth) * absentDays : 0
      const lateMinutes = attendanceLogs.reduce((s, l) => s + l.lateMinutes, 0)
      const lateDeduction = lateMinutes > 0 ? (baseSalary / workingDaysInMonth / 8 / 60) * lateMinutes : 0
      const overtimeMinutes = attendanceLogs.reduce((s, l) => s + l.overtimeMinutes, 0)
      const actualHourlyRate = (baseSalary + allowances) / 30 / 8
      const basicHourlyRate = baseSalary / 30 / 8
      const overtimeAmount = overtimeMinutes > 0 ? (overtimeMinutes / 60) * (actualHourlyRate + basicHourlyRate * 0.5) : 0
      const netSalary = baseSalary + allowances + overtimeAmount - deductions - absenceDeduction - lateDeduction

      await prisma.payrollDetail.create({
        data: {
          payrollRunId: run.id, employeeId: emp.id,
          baseSalary, totalAllowances: allowances, housingAllowance, otherEarnings: regularAllowanceTotal + bonusAmount,
          allowanceBreakdown: allowanceComponents.map(component => ({ name: component.name, amount: Number(component.amount), category: /سكن|housing/i.test(component.name) ? 'HOUSING' : /مكاف|bonus|reward/i.test(component.name) ? 'BONUS' : 'ALLOWANCE' })),
          bonusAmount, insuranceDeduction, overtimeMinutes, overtimeAmount, totalDeductions: deductions,
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
