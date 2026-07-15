import { ForbiddenException } from '@nestjs/common'
import { JwtPayload } from '@shift-saas/types'

/** الأدوار الإدارية — لها صلاحية الاطلاع على بيانات كل الموظفين */
export const MGMT_ROLES = ['super_admin', 'hr_manager', 'supervisor']
/** أدوار الموارد البشرية — لها صلاحية التعديل والبيانات المالية */
export const HR_ROLES = ['super_admin', 'hr_manager']

export function isManager(u: JwtPayload): boolean {
  return !!u.roles?.some((r) => MGMT_ROLES.includes(r))
}

export function isHR(u: JwtPayload): boolean {
  return !!u.roles?.some((r) => HR_ROLES.includes(r))
}

/**
 * يسمح بالوصول إذا كان المستخدم إدارياً أو يطلب بياناته الشخصية فقط.
 * يُستخدم للمسارات التي يحق للموظف رؤية سجله فيها (ملفه، راتبه، أرصدته).
 */
export function assertSelfOrManager(u: JwtPayload, employeeId: string): void {
  if (isManager(u)) return
  if (u.sub === employeeId) return
  throw new ForbiddenException('ليس لديك صلاحية الاطلاع على بيانات موظف آخر')
}

/** يسمح فقط للبيانات المالية: موارد بشرية أو صاحب السجل نفسه */
export function assertSelfOrHR(u: JwtPayload, employeeId: string): void {
  if (isHR(u)) return
  if (u.sub === employeeId) return
  throw new ForbiddenException('ليس لديك صلاحية الاطلاع على البيانات المالية لموظف آخر')
}
