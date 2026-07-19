import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common'
import { prisma } from '@shift-saas/database'
import { ApprovalsService } from '../approvals/approvals.service'
import { isManager } from '../../common/auth.util'
import { JwtPayload } from '@shift-saas/types'

@Injectable()
export class UniformsService {
  constructor(private approvals: ApprovalsService) {}

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
    const req = await prisma.uniformRequest.create({
      data: { tenantId, ...data, quantity: data.quantity ?? 1 },
    })

    const kase = await this.approvals.createCase(tenantId, 'UNIFORM', req.id, data.employeeId)
    if (kase && kase.caseStatus === 'APPROVED') {
      // كل الخطوات جرى تخطّيها تلقائياً (لا يوجد موافق مؤهّل) — اعتماد فوري
      return prisma.uniformRequest.update({ where: { id: req.id }, data: { status: 'APPROVED' } })
    }
    return req
  }

  async decide(tenantId: string, id: string, actor: JwtPayload, decision: 'APPROVED' | 'REJECTED', notes?: string) {
    const req = await prisma.uniformRequest.findFirst({ where: { id, tenantId } })
    if (!req) throw new NotFoundException('الطلب غير موجود')
    if (req.status !== 'PENDING') throw new BadRequestException('تم البت في هذا الطلب مسبقاً')

    const trail = await this.approvals.getTrail('UNIFORM', id)
    if (trail) {
      const result = await this.approvals.decide(tenantId, 'UNIFORM', id, actor.sub, decision, notes)
      if (result.caseStatus === 'PENDING') return { ...req, pendingStep: result.currentStepLabel }
      return prisma.uniformRequest.update({ where: { id }, data: { status: result.caseStatus, approvedBy: actor.sub } })
    }

    // بلا مسار مُهيّأ — اعتماد مباشر مقيّد بأدوار الإدارة (سلوك احتياطي متوافق مع الإصدارات السابقة)
    if (!isManager(actor)) throw new ForbiddenException('ليس لديك صلاحية اعتماد طلبات البدلة')
    return prisma.uniformRequest.update({ where: { id }, data: { status: decision, approvedBy: actor.sub } })
  }
}
