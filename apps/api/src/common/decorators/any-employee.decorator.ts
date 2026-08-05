import { SetMetadata } from '@nestjs/common'

export const ANY_EMPLOYEE_KEY = 'anyEmployee'

/**
 * يسمح لأي موظف مسجّل دخول بالوصول لهذا المسار.
 *
 * استخدمه فقط للمسارات الذاتية (`/my`, `/me/...`) أو التي تفرض الملكية داخل المعالج
 * عبر `assertSelfOrManager` / `assertSelfOrHR` أو بتقييد الاستعلام بـ `u.sub`.
 *
 * وجوده **إلزامي** لأي مسار بلا `@Roles()` تحت `RolesGuard` — الحارس يمنع افتراضياً،
 * فالمسار غير الموسوم يُرفض بدل أن يُفتح للجميع بصمت.
 */
export const AnyEmployee = () => SetMetadata(ANY_EMPLOYEE_KEY, true)
