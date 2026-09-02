import { Injectable, NotFoundException, ConflictException, BadRequestException } from '@nestjs/common'
import * as bcrypt from 'bcrypt'
import { JwtService } from '@nestjs/jwt'
import { prisma } from '@shift-saas/database'
import { JwtPayload } from '@shift-saas/types'
import {
  CreateTemplateDto, UpdateTemplateDto,
  CreateTenantDto, UpdateTenantModulesDto, ExtendSubscriptionDto, UpdateTenantInfoDto,
  UpdatePlatformEmployeeDto,
} from './dto/platform.dto'

const CYCLE_DAYS: Record<string, number> = { MONTHLY: 30, QUARTERLY: 90, ANNUAL: 365 }
const DEFAULT_ROLES = ['super_admin', 'hr_manager', 'supervisor', 'employee']
/** عمر جلسة انتحال شخصية أدمن الشركة — قصير عمداً وغير قابل للتمديد (بلا refreshToken) */
const IMPERSONATION_TTL = '15m'

@Injectable()
export class PlatformService {
  constructor(private jwtService: JwtService) {}

  /* ══════════ خطط الاشتراك الجاهزة ══════════ */

  async listTemplates() {
    return prisma.subscriptionTemplate.findMany({
      include: { _count: { select: { tenants: true } } },
      orderBy: { createdAt: 'asc' },
    })
  }

  async createTemplate(dto: CreateTemplateDto) {
    return prisma.subscriptionTemplate.create({
      data: { name: dto.name, modules: dto.modules as any, monthlyPrice: dto.monthlyPrice },
    })
  }

  async updateTemplate(id: string, dto: UpdateTemplateDto) {
    const t = await prisma.subscriptionTemplate.findUnique({ where: { id } })
    if (!t) throw new NotFoundException('الخطة غير موجودة')
    return prisma.subscriptionTemplate.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.modules !== undefined && { modules: dto.modules as any }),
        ...(dto.monthlyPrice !== undefined && { monthlyPrice: dto.monthlyPrice }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
      },
    })
  }

  async removeTemplate(id: string) {
    const count = await prisma.tenant.count({ where: { subscriptionTemplateId: id } })
    if (count > 0) throw new BadRequestException(`لا يمكن حذف الخطة — ${count} شركة تستخدمها حالياً`)
    await prisma.subscriptionTemplate.delete({ where: { id } })
    return { message: 'تم حذف الخطة' }
  }

  /* ══════════ الشركات المشتركة ══════════ */

  async listTenants() {
    const tenants = await prisma.tenant.findMany({
      include: {
        subscriptionTemplate: { select: { id: true, name: true } },
        _count: { select: { employees: true } },
      },
      orderBy: { createdAt: 'desc' },
    })
    const now = new Date()
    return tenants.map(t => ({
      ...t,
      daysRemaining: t.subscriptionEndsAt ? Math.ceil((t.subscriptionEndsAt.getTime() - now.getTime()) / 86400000) : null,
      isExpired: t.subscriptionEndsAt ? t.subscriptionEndsAt < now : false,
      usersUsed: t._count.employees,
      usersRemaining: t.maxUsers != null ? Math.max(0, t.maxUsers - t._count.employees) : null,
    }))
  }

  async getTenant(id: string) {
    const t = await prisma.tenant.findUnique({
      where: { id },
      include: {
        subscriptionTemplate: true,
        _count: { select: { employees: true, branches: true } },
      },
    })
    if (!t) throw new NotFoundException('الشركة غير موجودة')
    const statusCounts = await prisma.employee.groupBy({
      by: ['status'], where: { tenantId: id }, _count: { _all: true },
    })
    const counts = { active: 0, suspended: 0, terminated: 0, loginEnabled: 0 }
    for (const row of statusCounts) counts[row.status.toLowerCase() as 'active' | 'suspended' | 'terminated'] = row._count._all
    counts.loginEnabled = await prisma.employee.count({ where: { tenantId: id, status: 'ACTIVE', email: { not: null }, passwordHash: { not: null } } })
    return {
      ...t,
      usersUsed: t._count.employees,
      usersRemaining: t.maxUsers != null ? Math.max(0, t.maxUsers - t._count.employees) : null,
      employeeCounts: counts,
    }
  }

  async listTenantEmployees(tenantId: string, search?: string) {
    const tenant = await prisma.tenant.findUnique({ where: { id: tenantId }, select: { id: true } })
    if (!tenant) throw new NotFoundException('الشركة غير موجودة')
    const term = search?.trim()
    return prisma.employee.findMany({
      where: {
        tenantId,
        ...(term && {
          OR: [
            { fullName: { contains: term, mode: 'insensitive' } },
            { employeeCode: { contains: term, mode: 'insensitive' } },
            { email: { contains: term, mode: 'insensitive' } },
            { phone: { contains: term, mode: 'insensitive' } },
          ],
        }),
      },
      select: {
        id: true, employeeCode: true, fullName: true, email: true, phone: true,
        status: true, createdAt: true, updatedAt: true,
        branch: { select: { id: true, name: true } },
        department: { select: { id: true, name: true } },
        jobTitle: { select: { id: true, name: true } },
        employeeRoles: { select: { role: { select: { name: true } } } },
      },
      orderBy: [{ status: 'asc' }, { fullName: 'asc' }],
    })
  }

  async updateTenantEmployee(tenantId: string, employeeId: string, dto: UpdatePlatformEmployeeDto, platformAdminId: string) {
    const employee = await prisma.employee.findFirst({ where: { id: employeeId, tenantId } })
    if (!employee) throw new NotFoundException('الموظف غير موجود في هذه الشركة')
    if (dto.email && dto.email !== employee.email) {
      const duplicate = await prisma.employee.findFirst({ where: { email: dto.email, NOT: { id: employeeId } }, select: { id: true } })
      if (duplicate) throw new ConflictException('البريد الإلكتروني مستخدم في حساب آخر')
    }
    const updated = await prisma.employee.update({
      where: { id: employeeId },
      data: {
        ...(dto.fullName !== undefined && { fullName: dto.fullName.trim() }),
        ...(dto.email !== undefined && { email: dto.email.trim().toLowerCase() }),
        ...(dto.phone !== undefined && { phone: dto.phone.trim() || null }),
        ...(dto.status !== undefined && { status: dto.status }),
      },
      select: { id: true, employeeCode: true, fullName: true, email: true, phone: true, status: true },
    })
    await this.logPlatformAction(tenantId, 'EMPLOYEE_UPDATE', employeeId, {
      platformAdminId, changedFields: Object.keys(dto), previousStatus: employee.status, newStatus: updated.status,
    })
    return updated
  }

  async resetTenantEmployeePassword(tenantId: string, employeeId: string, password: string, platformAdminId: string) {
    const employee = await prisma.employee.findFirst({ where: { id: employeeId, tenantId }, select: { id: true, email: true } })
    if (!employee) throw new NotFoundException('الموظف غير موجود في هذه الشركة')
    if (!employee.email) throw new BadRequestException('أضف بريداً إلكترونياً للموظف قبل ضبط كلمة المرور')
    const passwordHash = await bcrypt.hash(password, 12)
    await prisma.employee.update({ where: { id: employeeId }, data: { passwordHash } })
    await this.logPlatformAction(tenantId, 'EMPLOYEE_PASSWORD_RESET', employeeId, { platformAdminId })
    return { message: 'تم ضبط كلمة مرور الموظف' }
  }

  /** انتحال شخصية أدمن الشركة — يصكّ توكن دخول تينانت لأول موظف بدور super_admin في الشركة،
   * ليدخل مالك المنصة بكامل صلاحيات الإدارة عبر واجهة الشركة نفسها دون إعادة بناء أي شاشة CRUD.
   *
   * قيود أمنية مقصودة تميّزه عن تسجيل الدخول العادي:
   *  - جلسة قصيرة تنتهي وحدها (IMPERSONATION_TTL) ولا تُمدَّد
   *  - بلا refreshToken إطلاقاً — لا يمكن تمديد الجلسة أياماً بلا رجوع للوحة المنصة
   *  - يحمل impersonatedBy لتمييزه عن دخول حقيقي وإسناد أي إجراء لمالك المنصة */
  async impersonateTenant(tenantId: string, platformAdminId: string): Promise<{ accessToken: string; expiresIn: string; adminName: string }> {
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { enabledModules: true, planStatus: true },
    })
    if (!tenant) throw new NotFoundException('الشركة غير موجودة')

    const admin = await prisma.employee.findFirst({
      where: { tenantId, status: 'ACTIVE', employeeRoles: { some: { role: { name: 'super_admin' } } } },
      include: { employeeRoles: { include: { role: true } } },
      orderBy: { createdAt: 'asc' },
    })
    if (!admin) throw new NotFoundException('لا يوجد موظف بدور super_admin في هذه الشركة لانتحال شخصيته')

    const payload: JwtPayload & { impersonatedBy: string } = {
      sub: admin.id,
      tenantId,
      email: admin.email ?? '',
      roles: admin.employeeRoles.map(er => er.role.name),
      modules: tenant.enabledModules,
      impersonatedBy: platformAdminId,
    }

    await this.logPlatformAction(tenantId, 'TENANT_IMPERSONATE', admin.id, {
      adminName: admin.fullName, adminEmail: admin.email, platformAdminId,
    })

    return {
      accessToken: this.jwtService.sign(payload, { expiresIn: IMPERSONATION_TTL }),
      expiresIn: IMPERSONATION_TTL,
      adminName: admin.fullName,
    }
  }

  /* ══════════ سجل تدقيق مالك المنصة — منفصل تماماً عن سجل تدقيق الشركة، لا يظهر لأي موظف بالشركة أبداً ══════════ */

  private async logPlatformAction(tenantId: string, action: string, entityId?: string, details?: object) {
    await prisma.platformAuditLog.create({ data: { tenantId, action, entityId, details: details as any } })
  }

  async listPlatformAuditForTenant(tenantId: string) {
    return prisma.platformAuditLog.findMany({ where: { tenantId }, orderBy: { createdAt: 'desc' } })
  }

  /* ══════════ طلبات إجازة الشركة — عرض وحذف من قِبل مالك المنصة فقط ══════════ */

  async listTenantLeaveRequests(tenantId: string) {
    const tenant = await prisma.tenant.findUnique({ where: { id: tenantId }, select: { id: true } })
    if (!tenant) throw new NotFoundException('الشركة غير موجودة')
    // تُعرض هنا كل الطلبات حتى المخفية عن الشركة — مالك المنصة يحتفظ بالرؤية الكاملة دائماً
    return prisma.leaveRequest.findMany({
      where: { tenantId },
      include: { employee: { select: { fullName: true, employeeCode: true } }, leaveType: { select: { name: true } } },
      orderBy: { createdAt: 'desc' },
    })
  }

  /** "حذف" طلب إجازة من منظور الشركة — يُسمح فقط للطلبات المقبولة أو المعلّقة. لا حذف فعلي أبداً:
   * السجل يُخفى فقط عن الشركة (hiddenFromTenant) ويبقى محفوظاً كاملاً في حساب مالك المنصة،
   * وتُعاد الأيام المخصومة لرصيد الموظف إن كان الطلب مقبولاً حتى تنعكس حالة "عدم الوجود" في حسابات الشركة بدقة */
  async deleteTenantLeaveRequest(tenantId: string, requestId: string) {
    const req = await prisma.leaveRequest.findFirst({ where: { id: requestId, tenantId } })
    if (!req) throw new NotFoundException('طلب الإجازة غير موجود')
    if (req.hiddenFromTenant) throw new BadRequestException('هذا الطلب مخفي عن الشركة بالفعل')
    if (req.status !== 'APPROVED' && req.status !== 'PENDING') {
      throw new BadRequestException('لا يمكن حذف إلا الطلبات المقبولة أو المعلّقة')
    }

    if (req.status === 'APPROVED') {
      const days = Math.ceil((req.endDate.getTime() - req.startDate.getTime()) / 86400000) + 1
      const balance = await prisma.leaveBalance.findFirst({
        where: { tenantId, employeeId: req.employeeId, leaveTypeId: req.leaveTypeId, year: req.startDate.getFullYear() },
      })
      if (balance) {
        await prisma.leaveBalance.update({
          where: { id: balance.id },
          data: { usedDays: Math.max(0, balance.usedDays - days) },
        })
      }
    }

    await prisma.leaveRequest.update({ where: { id: requestId }, data: { hiddenFromTenant: true } })
    await this.logPlatformAction(tenantId, 'LEAVE_REQUEST_DELETE', requestId, {
      employeeId: req.employeeId, leaveTypeId: req.leaveTypeId, status: req.status,
      startDate: req.startDate, endDate: req.endDate,
    })
    return { message: 'تم حذف طلب الإجازة من سجل الشركة (يبقى محفوظاً لمالك المنصة)' }
  }

  /** تعديل اسم الشركة و/أو الحد الأقصى لعدد المستخدمين */
  async updateTenantInfo(id: string, dto: UpdateTenantInfoDto) {
    const t = await prisma.tenant.findUnique({ where: { id } })
    if (!t) throw new NotFoundException('الشركة غير موجودة')
    return prisma.tenant.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.maxUsers !== undefined && { maxUsers: dto.maxUsers }),
      },
    })
  }

  /** تحديث شعار الشركة بعد رفعه */
  async updateTenantLogo(id: string, logoUrl: string) {
    const t = await prisma.tenant.findUnique({ where: { id } })
    if (!t) throw new NotFoundException('الشركة غير موجودة')
    return prisma.tenant.update({ where: { id }, data: { logo: logoUrl } })
  }

  /** إنشاء شركة جديدة كاملة: الشركة + فرع افتراضي + الأدوار الأساسية + حساب المدير الأول */
  async createTenant(dto: CreateTenantDto) {
    const existingEmail = await prisma.employee.findFirst({ where: { email: dto.ownerEmail } })
    if (existingEmail) throw new ConflictException('البريد الإلكتروني مستخدم مسبقاً')

    const template = dto.subscriptionTemplateId
      ? await prisma.subscriptionTemplate.findUnique({ where: { id: dto.subscriptionTemplateId } })
      : null
    if (dto.subscriptionTemplateId && !template) throw new NotFoundException('الخطة غير موجودة')

    const start = new Date()
    const end = new Date(start.getTime() + (CYCLE_DAYS[dto.billingCycle] ?? 30) * 86400000)

    const tenant = await prisma.tenant.create({
      data: {
        name: dto.name,
        plan: dto.billingCycle as any,
        planStatus: 'ACTIVE',
        subscriptionTemplateId: template?.id,
        enabledModules: (template?.modules ?? []) as any,
        subscriptionStartsAt: start,
        subscriptionEndsAt: end,
        maxUsers: dto.maxUsers,
      },
    })

    const branch = await prisma.branch.create({
      data: { tenantId: tenant.id, name: 'المقر الرئيسي' },
    })

    const roles = await Promise.all(
      DEFAULT_ROLES.map(name => prisma.role.create({ data: { tenantId: tenant.id, name } })),
    )
    const superAdminRole = roles.find(r => r.name === 'super_admin')!

    const passwordHash = await bcrypt.hash(dto.ownerPassword, 12)
    const owner = await prisma.employee.create({
      data: {
        tenantId: tenant.id,
        branchId: branch.id,
        employeeCode: 'EMP0001',
        fullName: dto.ownerFullName,
        email: dto.ownerEmail,
        passwordHash,
        hireDate: start,
        status: 'ACTIVE',
      },
    })
    await prisma.employeeRole.create({ data: { employeeId: owner.id, roleId: superAdminRole.id } })

    return { tenant, owner: { id: owner.id, email: owner.email, fullName: owner.fullName } }
  }

  /** تخصيص الأقسام المفعّلة لشركة معيّنة — يتجاوز الخطة الأصلية */
  async updateTenantModules(id: string, dto: UpdateTenantModulesDto) {
    const t = await prisma.tenant.findUnique({ where: { id } })
    if (!t) throw new NotFoundException('الشركة غير موجودة')
    return prisma.tenant.update({ where: { id }, data: { enabledModules: dto.modules as any } })
  }

  /** تمديد الاشتراك لدورة جديدة من الآن */
  async extendSubscription(id: string, dto: ExtendSubscriptionDto) {
    const t = await prisma.tenant.findUnique({ where: { id } })
    if (!t) throw new NotFoundException('الشركة غير موجودة')
    const start = new Date()
    const end = new Date(start.getTime() + (CYCLE_DAYS[dto.billingCycle] ?? 30) * 86400000)
    return prisma.tenant.update({
      where: { id },
      data: { plan: dto.billingCycle as any, planStatus: 'ACTIVE', subscriptionStartsAt: start, subscriptionEndsAt: end },
    })
  }

  async suspendTenant(id: string) {
    const t = await prisma.tenant.findUnique({ where: { id } })
    if (!t) throw new NotFoundException('الشركة غير موجودة')
    return prisma.tenant.update({ where: { id }, data: { planStatus: 'CANCELLED' } })
  }

  /** إعادة تفعيل شركة معلّقة — يرفض إن كانت مدة الاشتراك نفسها منتهية (يلزم تمديد بدلاً من ذلك) */
  async reactivateTenant(id: string) {
    const t = await prisma.tenant.findUnique({ where: { id } })
    if (!t) throw new NotFoundException('الشركة غير موجودة')
    if (t.subscriptionEndsAt && t.subscriptionEndsAt < new Date()) {
      throw new BadRequestException('انتهت مدة الاشتراك — استخدم "تمديد الاشتراك" لتفعيلها من جديد')
    }
    return prisma.tenant.update({ where: { id }, data: { planStatus: 'ACTIVE' } })
  }
}
