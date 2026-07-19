import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common'
import { prisma } from '@shift-saas/database'
import { ApprovalsService } from '../approvals/approvals.service'

@Injectable()
export class OnboardingService {
  constructor(private approvals: ApprovalsService) {}

  async getAll(tenantId: string, employeeId?: string) {
    return prisma.onboardingRequest.findMany({
      where: { tenantId, ...(employeeId ? { employeeId } : {}) },
      include: { employee: { select: { fullName: true, employeeCode: true } } },
      orderBy: { createdAt: 'desc' },
    })
  }

  async create(tenantId: string, dto: { employeeId: string; type: 'NEW_HIRE' | 'RETURN_FROM_LEAVE'; scheduledDate: string; notes?: string }) {
    const employee = await prisma.employee.findFirst({ where: { id: dto.employeeId, tenantId } })
    if (!employee) throw new NotFoundException('الموظف غير موجود')

    const req = await prisma.onboardingRequest.create({
      data: {
        tenantId, employeeId: dto.employeeId, type: dto.type,
        scheduledDate: new Date(dto.scheduledDate), notes: dto.notes, status: 'PENDING',
      },
    })

    const kase = await this.approvals.createCase(tenantId, 'ONBOARDING', req.id, dto.employeeId)
    // لا يوجد مسار مُهيّأ لهذه الشركة بعد — اعتماد مباشر (سلوك احتياطي متوافق مع الإصدارات السابقة)
    if (!kase) return req
    if (kase.caseStatus === 'APPROVED') {
      return prisma.onboardingRequest.update({ where: { id: req.id }, data: { status: 'APPROVED' } })
    }
    return req
  }

  async decide(tenantId: string, id: string, actorId: string, decision: 'APPROVED' | 'REJECTED', notes?: string) {
    const req = await prisma.onboardingRequest.findFirst({ where: { id, tenantId } })
    if (!req) throw new NotFoundException('الطلب غير موجود')
    if (req.status !== 'PENDING') throw new BadRequestException('تم البتّ في هذا الطلب مسبقاً')

    const trail = await this.approvals.getTrail('ONBOARDING', id)
    if (trail) {
      const result = await this.approvals.decide(tenantId, 'ONBOARDING', id, actorId, decision, notes)
      if (result.caseStatus === 'PENDING') return { message: `تم الاعتماد — بانتظار: ${result.currentStepLabel}` }
      return prisma.onboardingRequest.update({ where: { id }, data: { status: result.caseStatus, approvedBy: actorId } })
    }
    // بلا مسار مُهيّأ — اعتماد مباشر (توافق مع الإصدار السابق)
    return prisma.onboardingRequest.update({ where: { id }, data: { status: decision, approvedBy: actorId } })
  }
}
