import { SetMetadata } from '@nestjs/common'

export const SKIP_AUDIT_KEY = 'skipAudit'

/**
 * يمنع `AuditInterceptor` من تسجيل هذا المسار تلقائياً.
 *
 * استخدمه فقط حين تُسجّل الخدمة الإجراء يدوياً بتفاصيل أغنى (مثل `oldData`
 * الذي لا يستطيع الـinterceptor التقاطه لأنه لا يرى الحالة قبل التعديل).
 */
export const SkipAudit = () => SetMetadata(SKIP_AUDIT_KEY, true)
