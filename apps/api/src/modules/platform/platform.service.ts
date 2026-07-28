import { Injectable, NotFoundException, ConflictException, BadRequestException } from '@nestjs/common'
import * as bcrypt from 'bcrypt'
import { prisma } from '@shift-saas/database'
import {
  CreateTemplateDto, UpdateTemplateDto,
  CreateTenantDto, UpdateTenantModulesDto, ExtendSubscriptionDto, UpdateTenantInfoDto,
} from './dto/platform.dto'

const CYCLE_DAYS: Record<string, number> = { MONTHLY: 30, QUARTERLY: 90, ANNUAL: 365 }
const DEFAULT_ROLES = ['super_admin', 'hr_manager', 'supervisor', 'employee']

@Injectable()
export class PlatformService {

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
    return {
      ...t,
      usersUsed: t._count.employees,
      usersRemaining: t.maxUsers != null ? Math.max(0, t.maxUsers - t._count.employees) : null,
    }
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
