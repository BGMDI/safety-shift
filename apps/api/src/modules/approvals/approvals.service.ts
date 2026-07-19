import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common'
import { prisma } from '@shift-saas/database'

type RequestType = 'LEAVE' | 'UNIFORM' | 'ONBOARDING'

const TYPE_LABELS: Record<RequestType, string> = {
  LEAVE: 'الإجازات',
  UNIFORM: 'بدلة العمل',
  ONBOARDING: 'المباشرات',
}

/** المسارات الافتراضية المقترحة عند أول تفعيل — عدد خطوات مختلف حسب حساسية كل نوع */
const DEFAULT_WORKFLOWS: Record<RequestType, Array<{ label: string; approverKind: 'ROLE' | 'DEPT_HEAD' | 'BRANCH_MANAGER'; roleName?: string }>> = {
  LEAVE: [
    { label: 'مشرف القسم', approverKind: 'DEPT_HEAD' },
    { label: 'مدير الفرع', approverKind: 'BRANCH_MANAGER' },
    { label: 'شؤون الموظفين', approverKind: 'ROLE', roleName: 'hr_manager' },
  ],
  UNIFORM: [
    { label: 'مشرف القسم', approverKind: 'DEPT_HEAD' },
    { label: 'شؤون الموظفين', approverKind: 'ROLE', roleName: 'hr_manager' },
  ],
  ONBOARDING: [
    { label: 'مدير الفرع', approverKind: 'BRANCH_MANAGER' },
    { label: 'شؤون الموظفين', approverKind: 'ROLE', roleName: 'hr_manager' },
  ],
}

export interface DecideResult {
  caseStatus: 'PENDING' | 'APPROVED' | 'REJECTED'
  currentStepLabel: string | null
}

@Injectable()
export class ApprovalsService {

  /* ══════════ تهيئة المسارات (إعدادات الشركة) ══════════ */

  async listWorkflows(tenantId: string) {
    const workflows = await prisma.approvalWorkflow.findMany({
      where: { tenantId },
      include: { steps: { orderBy: { order: 'asc' }, include: { role: { select: { id: true, name: true } } } } },
    })
    const byType = new Map(workflows.map(w => [w.type, w]))
    return (['LEAVE', 'UNIFORM', 'ONBOARDING'] as RequestType[]).map(type => {
      const w = byType.get(type as any)
      return {
        type,
        label: TYPE_LABELS[type],
        configured: !!w,
        workflowId: w?.id ?? null,
        steps: (w?.steps ?? []).map(s => ({
          id: s.id, order: s.order, label: s.label,
          approverKind: s.approverKind, roleId: s.roleId, roleName: s.role?.name ?? null,
        })),
      }
    })
  }

  async saveWorkflow(tenantId: string, type: RequestType, steps: Array<{ label: string; approverKind: 'ROLE' | 'DEPT_HEAD' | 'BRANCH_MANAGER'; roleId?: string }>) {
    if (!steps.length) throw new BadRequestException('يجب أن يحتوي المسار على خطوة واحدة على الأقل')
    for (const s of steps) {
      if (s.approverKind === 'ROLE' && !s.roleId) throw new BadRequestException(`الخطوة "${s.label}" من نوع دور ولم يُحدَّد الدور`)
    }

    const workflow = await prisma.approvalWorkflow.upsert({
      where: { tenantId_type: { tenantId, type: type as any } },
      update: {},
      create: { tenantId, type: type as any },
    })

    await prisma.approvalStep.deleteMany({ where: { workflowId: workflow.id } })
    await prisma.approvalStep.createMany({
      data: steps.map((s, i) => ({
        workflowId: workflow.id, order: i + 1, label: s.label,
        approverKind: s.approverKind as any, roleId: s.approverKind === 'ROLE' ? s.roleId : null,
      })),
    })
    return { message: 'تم حفظ مسار الاعتماد' }
  }

  /** إنشاء مسارات افتراضية معقولة لكل الأنواع — يُستخدم عند أول اشتراك أو من الإعدادات */
  async seedDefaults(tenantId: string) {
    let created = 0
    for (const type of ['LEAVE', 'UNIFORM', 'ONBOARDING'] as RequestType[]) {
      const existing = await prisma.approvalWorkflow.findUnique({ where: { tenantId_type: { tenantId, type: type as any } } })
      if (existing) continue

      const template = DEFAULT_WORKFLOWS[type]
      const workflow = await prisma.approvalWorkflow.create({ data: { tenantId, type: type as any } })
      for (let i = 0; i < template.length; i++) {
        const t = template[i]
        let roleId: string | undefined
        if (t.approverKind === 'ROLE' && t.roleName) {
          const role = await prisma.role.findFirst({ where: { tenantId, name: t.roleName } })
          roleId = role?.id
        }
        await prisma.approvalStep.create({
          data: { workflowId: workflow.id, order: i + 1, label: t.label, approverKind: t.approverKind as any, roleId },
        })
      }
      created++
    }
    return { created, message: created ? `تم إنشاء ${created} مسار اعتماد افتراضي` : 'كل الأنواع مُهيّأة مسبقاً' }
  }

  /* ══════════ حلّ الموافقين المؤهّلين لخطوة معيّنة ══════════ */

  private async resolveEligibleApprovers(tenantId: string, step: { approverKind: string; roleId: string | null }, requester: { branchId: string; departmentId: string | null }): Promise<string[]> {
    if (step.approverKind === 'ROLE') {
      if (!step.roleId) return []
      const assignments = await prisma.employeeRole.findMany({
        where: { roleId: step.roleId, employee: { tenantId, status: 'ACTIVE' } },
        select: { employeeId: true },
      })
      return assignments.map(a => a.employeeId)
    }

    if (step.approverKind === 'DEPT_HEAD') {
      if (!requester.departmentId) return []
      const dept = await prisma.department.findFirst({ where: { id: requester.departmentId, tenantId } })
      return dept?.headEmployeeId ? [dept.headEmployeeId] : []
    }

    if (step.approverKind === 'BRANCH_MANAGER') {
      const branch = await prisma.branch.findFirst({ where: { id: requester.branchId, tenantId } })
      return branch?.managerEmployeeId ? [branch.managerEmployeeId] : []
    }

    return []
  }

  /* ══════════ إنشاء حالة اعتماد جديدة عند تقديم طلب ══════════ */

  /** يُستدعى فور إنشاء الطلب الأصلي (إجازة/بدلة/مباشرة). يُرجع null إن لم يوجد مسار مُهيّأ (اعتماد مباشر قديم). */
  async createCase(tenantId: string, requestType: RequestType, requestId: string, employeeId: string): Promise<ApprovalCaseSummary | null> {
    const workflow = await prisma.approvalWorkflow.findUnique({
      where: { tenantId_type: { tenantId, type: requestType as any } },
      include: { steps: { orderBy: { order: 'asc' } } },
    })
    if (!workflow || workflow.steps.length === 0) return null

    const requester = await prisma.employee.findFirst({
      where: { id: employeeId, tenantId },
      select: { branchId: true, departmentId: true },
    })
    if (!requester) throw new NotFoundException('الموظف غير موجود')

    const kase = await prisma.approvalCase.create({
      data: {
        tenantId, workflowId: workflow.id, requestType: requestType as any, requestId, employeeId,
        actions: { create: workflow.steps.map(s => ({ stepId: s.id, order: s.order })) },
      },
    })

    return this.advance(kase.id, requester)
  }

  /* ══════════ التقدّم عبر الخطوات (يتخطى الخطوات بلا موافق مؤهّل) ══════════ */

  private async advance(caseId: string, requester: { branchId: string; departmentId: string | null }): Promise<ApprovalCaseSummary> {
    const kase = await prisma.approvalCase.findUniqueOrThrow({
      where: { id: caseId },
      include: { actions: { orderBy: { order: 'asc' }, include: { step: true } } },
    })

    let current = kase.actions.find(a => a.order === kase.currentOrder)
    while (current && current.status === 'PENDING') {
      const eligible = await this.resolveEligibleApprovers(kase.tenantId, current.step, requester)
      if (eligible.length > 0) {
        // خطوة قابلة للتنفيذ — توقّف هنا بانتظار قرار
        return { caseStatus: 'PENDING', currentStepLabel: current.step.label, currentStepOrder: current.order, eligibleApproverIds: eligible }
      }
      // لا يوجد موافق مؤهّل لهذه الخطوة — تخطَّها تلقائياً
      await prisma.approvalAction.update({ where: { id: current.id }, data: { status: 'SKIPPED', decidedAt: new Date() } })
      const nextOrder = current.order + 1
      const next = kase.actions.find(a => a.order === nextOrder)
      if (!next) {
        // انتهت كل الخطوات بلا موافق مؤهّل — اعتماد تلقائي (لا يوجد من يمنعه)
        await prisma.approvalCase.update({ where: { id: caseId }, data: { status: 'APPROVED', decidedAt: new Date() } })
        return { caseStatus: 'APPROVED', currentStepLabel: null, currentStepOrder: null, eligibleApproverIds: [] }
      }
      await prisma.approvalCase.update({ where: { id: caseId }, data: { currentOrder: nextOrder } })
      current = next
    }

    // احتياط: لو وصلنا هنا فالحالة محسومة أصلاً
    return { caseStatus: kase.status as any, currentStepLabel: null, currentStepOrder: null, eligibleApproverIds: [] }
  }

  /* ══════════ البتّ في الخطوة الحالية ══════════ */

  async decide(tenantId: string, requestType: RequestType, requestId: string, actorId: string, decision: 'APPROVED' | 'REJECTED', notes?: string): Promise<DecideResult> {
    const kase = await prisma.approvalCase.findUnique({
      where: { requestType_requestId: { requestType: requestType as any, requestId } },
      include: { actions: { orderBy: { order: 'asc' }, include: { step: true } }, employee: { select: { branchId: true, departmentId: true } } },
    })
    if (!kase) throw new NotFoundException('لا يوجد مسار اعتماد لهذا الطلب')
    if (kase.status !== 'PENDING') throw new BadRequestException('تم البتّ في هذا الطلب مسبقاً')

    const current = kase.actions.find(a => a.order === kase.currentOrder)
    if (!current || current.status !== 'PENDING') throw new BadRequestException('لا توجد خطوة نشطة بانتظار البتّ')

    const eligible = await this.resolveEligibleApprovers(tenantId, current.step, kase.employee)
    if (!eligible.includes(actorId)) throw new ForbiddenException('لست الموافق المخوَّل لهذه الخطوة')

    await prisma.approvalAction.update({
      where: { id: current.id },
      data: { status: decision, decidedBy: actorId, decidedAt: new Date(), notes },
    })

    if (decision === 'REJECTED') {
      await prisma.approvalCase.update({ where: { id: kase.id }, data: { status: 'REJECTED', decidedAt: new Date() } })
      return { caseStatus: 'REJECTED', currentStepLabel: null }
    }

    const nextOrder = kase.currentOrder + 1
    const hasNext = kase.actions.some(a => a.order === nextOrder)
    if (!hasNext) {
      await prisma.approvalCase.update({ where: { id: kase.id }, data: { status: 'APPROVED', decidedAt: new Date() } })
      return { caseStatus: 'APPROVED', currentStepLabel: null }
    }

    await prisma.approvalCase.update({ where: { id: kase.id }, data: { currentOrder: nextOrder } })
    const result = await this.advance(kase.id, kase.employee)
    return { caseStatus: result.caseStatus, currentStepLabel: result.currentStepLabel }
  }

  /* ══════════ استعلامات العرض ══════════ */

  /** أثر المسار الكامل لطلب معيّن — لصاحب الطلب أو الإدارة */
  async getTrail(requestType: RequestType, requestId: string) {
    const kase = await prisma.approvalCase.findUnique({
      where: { requestType_requestId: { requestType: requestType as any, requestId } },
      include: {
        actions: {
          orderBy: { order: 'asc' },
          include: { step: true, decider: { select: { fullName: true, employeeCode: true } } },
        },
      },
    })
    if (!kase) return null
    return {
      status: kase.status,
      currentOrder: kase.currentOrder,
      steps: kase.actions.map(a => ({
        order: a.order, label: a.step.label, status: a.status,
        decider: a.decider ? { fullName: a.decider.fullName, employeeCode: a.decider.employeeCode } : null,
        decidedAt: a.decidedAt, notes: a.notes,
      })),
    }
  }

  /** طلبات بانتظار موافقة موظف معيّن — أي دوره كان (دور نظام أو رئيس قسم/مدير فرع مُعيَّن هيكلياً) */
  async getMyQueue(tenantId: string, employeeId: string) {
    const pendingCases = await prisma.approvalCase.findMany({
      where: { tenantId, status: 'PENDING' },
      include: {
        employee: { select: { id: true, fullName: true, employeeCode: true, branchId: true, departmentId: true } },
        actions: { orderBy: { order: 'asc' }, include: { step: true } },
        workflow: true,
      },
    })

    const mine = []
    for (const kase of pendingCases) {
      const current = kase.actions.find(a => a.order === kase.currentOrder)
      if (!current || current.status !== 'PENDING') continue
      const eligible = await this.resolveEligibleApprovers(tenantId, current.step, kase.employee)
      if (!eligible.includes(employeeId)) continue

      let requestSummary: any = null
      if (kase.requestType === 'LEAVE') {
        const r = await prisma.leaveRequest.findUnique({ where: { id: kase.requestId }, include: { leaveType: { select: { name: true } } } })
        requestSummary = r ? { title: r.leaveType.name, detail: `${r.startDate.toISOString().slice(0, 10)} ← ${r.endDate.toISOString().slice(0, 10)}` } : null
      } else if (kase.requestType === 'UNIFORM') {
        const r = await prisma.uniformRequest.findUnique({ where: { id: kase.requestId } })
        requestSummary = r ? { title: r.uniformType, detail: `${r.size ?? ''} · ×${r.quantity}` } : null
      } else if (kase.requestType === 'ONBOARDING') {
        const r = await prisma.onboardingRequest.findUnique({ where: { id: kase.requestId } })
        requestSummary = r ? { title: r.type === 'NEW_HIRE' ? 'مباشرة تعيين' : 'مباشرة عودة من إجازة', detail: r.scheduledDate.toISOString().slice(0, 10) } : null
      }
      if (!requestSummary) continue

      mine.push({
        caseId: kase.id, requestType: kase.requestType, requestId: kase.requestId,
        stepLabel: current.step.label, stepOrder: current.order, totalSteps: kase.actions.length,
        employee: { id: kase.employee.id, fullName: kase.employee.fullName, employeeCode: kase.employee.employeeCode },
        title: requestSummary.title, detail: requestSummary.detail, createdAt: kase.createdAt,
      })
    }
    return mine.sort((a, b) => +new Date(a.createdAt) - +new Date(b.createdAt))
  }
}

interface ApprovalCaseSummary {
  caseStatus: 'PENDING' | 'APPROVED' | 'REJECTED'
  currentStepLabel: string | null
  currentStepOrder: number | null
  eligibleApproverIds: string[]
}
