import { Injectable, NotFoundException } from '@nestjs/common'
import { prisma } from '@shift-saas/database'

@Injectable()
export class TenantsService {
  /** بيانات عرض الشركة الأساسية لأي موظف مسجّل دخول — الاسم والشعار فقط */
  async getMine(tenantId: string) {
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { id: true, name: true, logo: true },
    })
    if (!tenant) throw new NotFoundException('الشركة غير موجودة')
    return tenant
  }
}
