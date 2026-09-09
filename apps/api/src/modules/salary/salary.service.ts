import { Injectable, NotFoundException } from '@nestjs/common'
import { prisma } from '@shift-saas/database'
import { CreateSalaryComponentDto, UpdateSalaryComponentDto } from './dto/salary.dto'

@Injectable()
export class SalaryService {
  async getEmployeeSalary(tenantId: string, employeeId: string) {
    const employee = await prisma.employee.findFirst({
      where: { id: employeeId, tenantId },
      select: { id: true, fullName: true, employeeCode: true, jobGrade: true, tenant: { select: { payrollInsuranceRate: true } },
        jobTitle: { select: { name: true, baseSalary: true, gradeIncrement: true, housingAllowance: true, transportAllowance: true, otherAllowance: true, insuranceRate: true, customAllowances: true } } },
    })
    if (!employee) throw new NotFoundException('الموظف غير موجود')

    const components = await prisma.salaryComponent.findMany({
      where: { employeeId, tenantId },
      orderBy: [{ type: 'asc' }, { effectiveDate: 'desc' }],
    })

    const job = employee.jobTitle
    const grade = employee.jobGrade ?? 1
    const jobGross = job ? Number(job.baseSalary) + (grade - 1) * Number(job.gradeIncrement) : 0
    const jobBase = jobGross * 0.65
    const housingAllowance = jobGross * 0.25
    const transportAllowance = jobGross * 0.10
    const custom = Array.isArray(job?.customAllowances) ? job.customAllowances as { name: string; amount: number }[] : []
    const jobComponents = job ? [
      { id: 'job:base', type: 'BASE', name: `الراتب الأساسي 65% — الدرجة ${grade}`, amount: jobBase, effectiveDate: '', locked: true },
      { id: 'job:housing', type: 'ALLOWANCE', name: 'بدل السكن 25%', amount: housingAllowance, effectiveDate: '', locked: true },
      { id: 'job:transport', type: 'ALLOWANCE', name: 'بدل المواصلات 10%', amount: transportAllowance, effectiveDate: '', locked: true },
      { id: 'job:other', type: 'ALLOWANCE', name: 'بدلات أخرى', amount: Number(job.otherAllowance), effectiveDate: '', locked: true },
      ...custom.map((item, index) => ({ id: `job:custom:${index}`, type: 'ALLOWANCE', name: item.name, amount: Number(item.amount), effectiveDate: '', locked: true })),
    ].filter(component => component.type === 'BASE' || component.amount > 0) : []
    const manualBase = components.filter(c => c.type === 'BASE').reduce((s, c) => s + Number(c.amount), 0)
    const base = job ? jobBase : manualBase
    const jobAllowances = jobComponents.filter(c => c.type === 'ALLOWANCE').reduce((sum, component) => sum + component.amount, 0)
    const allowances = jobAllowances + components.filter(c => c.type === 'ALLOWANCE').reduce((s, c) => s + Number(c.amount), 0)
    const insuranceRate = Number(employee.tenant.payrollInsuranceRate)
    const insuranceDeduction = job ? jobGross * insuranceRate / 100 : 0
    if (insuranceDeduction > 0) jobComponents.push({ id: 'job:insurance', type: 'DEDUCTION', name: `استقطاع التأمينات (${insuranceRate}٪)`, amount: insuranceDeduction, effectiveDate: '', locked: true })
    const manualDeductions = components.filter(c => c.type === 'DEDUCTION' && (insuranceDeduction <= 0 || !/تأمين|gosi|insurance/i.test(c.name)))
    const deductions = insuranceDeduction + manualDeductions.reduce((s, c) => s + Number(c.amount), 0)

    return { employee, components: [...jobComponents, ...components.filter(c => (c.type !== 'BASE' || !job) && (insuranceDeduction <= 0 || !/تأمين|gosi|insurance/i.test(c.name)))], summary: { base, allowances, deductions, net: base + allowances - deductions } }
  }

  async addComponent(tenantId: string, dto: CreateSalaryComponentDto) {
    const employee = await prisma.employee.findFirst({ where: { id: dto.employeeId, tenantId } })
    if (!employee) throw new NotFoundException('الموظف غير موجود')

    return prisma.salaryComponent.create({
      data: {
        tenantId,
        employeeId: dto.employeeId,
        type: dto.type,
        name: dto.name,
        amount: dto.amount,
        isPercentage: dto.isPercentage ?? false,
        effectiveDate: new Date(dto.effectiveDate),
      },
    })
  }

  async updateComponent(tenantId: string, id: string, dto: UpdateSalaryComponentDto) {
    const comp = await prisma.salaryComponent.findFirst({ where: { id, tenantId } })
    if (!comp) throw new NotFoundException('البند غير موجود')
    return prisma.salaryComponent.update({ where: { id }, data: dto })
  }

  async removeComponent(tenantId: string, id: string) {
    const comp = await prisma.salaryComponent.findFirst({ where: { id, tenantId } })
    if (!comp) throw new NotFoundException('البند غير موجود')
    await prisma.salaryComponent.delete({ where: { id } })
    return { message: 'تم الحذف' }
  }

  async getSalaryCertificate(tenantId: string, employeeId: string) {
    const [data, employee, tenant] = await Promise.all([
      this.getEmployeeSalary(tenantId, employeeId),
      prisma.employee.findFirst({ where: { id: employeeId, tenantId }, include: { branch: true, department: true, jobTitle: true } }),
      prisma.tenant.findUnique({
        where: { id: tenantId },
        select: {
          name: true, logo: true, salaryCertificateText: true, employmentCertificateText: true,
          certificateSignature: true, certificateStamp: true,
          certificateHeader: true, certificateFooter: true,
          certificateSignerName: true, certificateSignerTitle: true,
        },
      }),
    ])
    return { ...data, employee, tenant, issuedAt: new Date().toISOString() }
  }
}
