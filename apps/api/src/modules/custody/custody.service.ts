import { Injectable, NotFoundException } from '@nestjs/common'
import { prisma } from '@shift-saas/database'

@Injectable()
export class CustodyService {
  async getEmployeeCustody(tenantId: string, employeeId: string) {
    return prisma.custodyItem.findMany({
      where: { tenantId, employeeId },
      orderBy: { assignedDate: 'desc' },
    })
  }

  async addCustody(tenantId: string, dto: { employeeId: string; itemName: string; assignedDate: string }) {
    return prisma.custodyItem.create({
      data: { tenantId, employeeId: dto.employeeId, itemName: dto.itemName, assignedDate: new Date(dto.assignedDate), status: 'active' },
    })
  }

  async returnCustody(tenantId: string, id: string) {
    const item = await prisma.custodyItem.findFirst({ where: { id, tenantId } })
    if (!item) throw new NotFoundException('العهدة غير موجودة')
    return prisma.custodyItem.update({
      where: { id },
      data: { returnedDate: new Date(), status: 'returned' },
    })
  }

  // إخلاء الطرف — يتحقق من أن الموظف لا يملك عهدة نشطة
  async getClearanceStatus(tenantId: string, employeeId: string) {
    const activeCustody = await prisma.custodyItem.findMany({
      where: { tenantId, employeeId, status: 'active' },
    })
    const pendingLeaves = await prisma.leaveRequest.findMany({
      where: { tenantId, employeeId, status: 'PENDING' },
    })

    const cleared = activeCustody.length === 0 && pendingLeaves.length === 0

    return {
      cleared,
      issues: [
        ...activeCustody.map(c => ({ type: 'custody', message: `عهدة غير مُسلَّمة: ${c.itemName}` })),
        ...pendingLeaves.map(() => ({ type: 'leave', message: 'طلب إجازة معلق' })),
      ],
    }
  }
}
