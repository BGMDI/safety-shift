import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import { prisma } from '@shift-saas/database'
import { REQUIRES_MODULE_KEY } from '../decorators/requires-module.decorator'

/** يمنع الوصول لأقسام لم تُفعَّل في باقة اشتراك الشركة — مستقل عن RolesGuard، يُضاف بجانبه */
@Injectable()
export class ModuleGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const required = this.reflector.getAllAndOverride<string>(REQUIRES_MODULE_KEY, [
      context.getHandler(),
      context.getClass(),
    ])
    if (!required) return true // بلا قيد = قسم أساسي متاح دائماً

    const { user } = context.switchToHttp().getRequest()
    if (!user?.tenantId) return true // مسارات مالك المنصة لا تحمل tenantId أصلاً

    const tenant = await prisma.tenant.findUnique({
      where: { id: user.tenantId },
      select: { enabledModules: true },
    })
    if (!tenant?.enabledModules.includes(required as any)) {
      throw new ForbiddenException('هذا القسم غير مفعّل في باقة اشتراك شركتكم — تواصل مع مزوّد الخدمة لتفعيله')
    }
    return true
  }
}
