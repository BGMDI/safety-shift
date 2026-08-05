import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import { ROLES_KEY } from '../decorators/roles.decorator'
import { ANY_EMPLOYEE_KEY } from '../decorators/any-employee.decorator'

/**
 * حارس الأدوار — **يمنع افتراضياً**.
 *
 * كل مسار تحت هذا الحارس يجب أن يعلن تصريحه صراحةً:
 *   @Roles('super_admin', ...)  → مقصور على هذه الأدوار
 *   @AnyEmployee()              → متاح لأي موظف مسجّل دخول (الملكية مفروضة داخل المعالج)
 *
 * المسار غير الموسوم يُرفض. هذا مقصود: نسيان التصريح يصبح خطأ 403 مرئياً فوراً
 * بدل تسريب صامت — وهو ما حدث فعلاً حين كانت الأدوار تُسمح افتراضياً وانكشفت
 * الرواتب وأرقام الهويات لأي موظف.
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const targets = [context.getHandler(), context.getClass()]

    const requiredRoles = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, targets)
    if (requiredRoles?.length) {
      const { user } = context.switchToHttp().getRequest()
      const hasRole = requiredRoles.some((role) => user?.roles?.includes(role))
      if (!hasRole) throw new ForbiddenException('ليس لديك صلاحية الوصول لهذا المورد')
      return true
    }

    if (this.reflector.getAllAndOverride<boolean>(ANY_EMPLOYEE_KEY, targets)) return true

    throw new ForbiddenException(
      'هذا المسار غير مُصرَّح به — يلزم وسمه بـ @Roles(...) أو @AnyEmployee()',
    )
  }
}
