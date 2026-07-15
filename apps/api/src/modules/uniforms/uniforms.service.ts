import { Injectable } from '@nestjs/common'
import { prisma } from '@shift-saas/database'

@Injectable()
export class UniformsService {
  async getAll(tenantId: string, status?: string) {
    const where: any = { tenantId }
    if (status) where.status = status
    return prisma.uniformRequest.findMany({
      where,
      include: { employee: { select: { fullName: true, employeeCode: true } } },
      orderBy: { createdAt: 'desc' },
    })
  }

  async getEmployeeRequests(tenantId: string, employeeId: string) {
    return prisma.uniformRequest.findMany({
      where: { tenantId, employeeId },
      orderBy: { createdAt: 'desc' },
    })
  }

  async create(tenantId: string, data: { employeeId: string; uniformType: string; size?: string; quantity?: number; notes?: string }) {
    return prisma.uniformRequest.create({
      data: { tenantId, ...data, quantity: data.quantity ?? 1 },
    })
  }

  async updateStatus(tenantId: string, id: string, status: string, approvedBy?: string) {
    return prisma.uniformRequest.update({
      where: { id, tenantId },
      data: { status: status as any, approvedBy },
    })
  }
}
