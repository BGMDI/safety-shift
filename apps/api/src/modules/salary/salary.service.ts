import { Injectable, NotFoundException } from '@nestjs/common'
import { prisma } from '@shift-saas/database'
import { CreateSalaryComponentDto, UpdateSalaryComponentDto } from './dto/salary.dto'

@Injectable()
export class SalaryService {
  async getEmployeeSalary(tenantId: string, employeeId: string) {
    const employee = await prisma.employee.findFirst({
      where: { id: employeeId, tenantId },
      select: { id: true, fullName: true, employeeCode: true,
        jobTitle: { select: { name: true, baseSalary: true } } },
    })
    if (!employee) throw new NotFoundException('الموظف غير موجود')

    const components = await prisma.salaryComponent.findMany({
      where: { employeeId, tenantId },
      orderBy: [{ type: 'asc' }, { effectiveDate: 'desc' }],
    })

    const base = components.filter(c => c.type === 'BASE').reduce((s, c) => s + Number(c.amount), 0)
    const allowances = components.filter(c => c.type === 'ALLOWANCE').reduce((s, c) => s + Number(c.amount), 0)
    const deductions = components.filter(c => c.type === 'DEDUCTION').reduce((s, c) => s + Number(c.amount), 0)

    return { employee, components, summary: { base, allowances, deductions, net: base + allowances - deductions } }
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
    const data = await this.getEmployeeSalary(tenantId, employeeId)
    const employee = await prisma.employee.findFirst({
      where: { id: employeeId, tenantId },
      include: { branch: true, department: true, jobTitle: true },
    })
    return { ...data, employee, issuedAt: new Date().toISOString() }
  }
}
