import { Injectable, NestInterceptor, ExecutionContext, CallHandler, Logger } from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import { Observable } from 'rxjs'
import { tap } from 'rxjs/operators'
import { prisma } from '@shift-saas/database'
import { SKIP_AUDIT_KEY } from '../decorators/skip-audit.decorator'

/** الطرق التي تُعدّ تعديلاً للبيانات وتُسجَّل */
const AUDITED: Record<string, string> = { POST: 'CREATE', PUT: 'UPDATE', PATCH: 'UPDATE', DELETE: 'DELETE' }

/** مفاتيح لا تُكتب في السجل أبداً مهما كان موقعها في الجسم */
const REDACT = new Set([
  'password', 'passwordhash', 'ownerpassword', 'newpassword', 'currentpassword',
  'token', 'accesstoken', 'refreshtoken', 'secret', 'apikey', 'authorization',
])

/** أقصى حجم للجسم المُخزَّن — يمنع تضخّم السجل من عمليات الاستيراد الجماعي */
const MAX_BODY_CHARS = 4000

function redact(value: unknown, depth = 0): unknown {
  if (depth > 6 || value === null || typeof value !== 'object') return value
  if (Array.isArray(value)) return value.slice(0, 50).map(v => redact(v, depth + 1))
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    out[k] = REDACT.has(k.toLowerCase()) ? '[محجوب]' : redact(v, depth + 1)
  }
  return out
}

/**
 * تسجيل تلقائي لكل تعديل بيانات في سجل تدقيق الشركة.
 *
 * كان السجل شبه معطّل: وحدة واحدة من 21 تكتب فيه، فبدا وكأنه يغطي كل النظام
 * بينما لا يغطي إلا الحضور. هذا الـinterceptor يلتقط كل POST/PUT/PATCH/DELETE
 * ناجح تلقائياً بدل الاعتماد على تذكّر كل خدمة.
 *
 * حدوده المقصودة:
 *  - لا يلتقط `oldData` (لا يرى الحالة قبل التعديل) — الخدمة التي تحتاجها تُسجّل
 *    يدوياً وتُوسم بـ `@SkipAudit()` منعاً للتكرار
 *  - يتجاهل مسارات مالك المنصة (بلا tenantId) — لها PlatformAuditLog منفصل
 *  - لا يُفشل الطلب أبداً إن فشلت الكتابة
 */
@Injectable()
export class AuditInterceptor implements NestInterceptor {
  private readonly logger = new Logger(AuditInterceptor.name)

  constructor(private reflector: Reflector) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== 'http') return next.handle()

    const req = context.switchToHttp().getRequest()
    const action = AUDITED[req.method]
    if (!action) return next.handle()

    if (this.reflector.getAllAndOverride<boolean>(SKIP_AUDIT_KEY, [context.getHandler(), context.getClass()])) {
      return next.handle()
    }

    const user = req.user
    // مسارات مالك المنصة والمصادقة بلا tenantId — تُسجَّل في PlatformAuditLog أو لا تُسجَّل
    if (!user?.tenantId) return next.handle()

    return next.handle().pipe(
      tap((response) => {
        // التسجيل بعد النجاح فقط، وبلا انتظار حتى لا يبطئ الاستجابة
        void this.write(req, user, action, response)
      }),
    )
  }

  private async write(req: any, user: any, action: string, response: unknown) {
    try {
      const rawPath: string = (req.originalUrl ?? req.url ?? '').split('?')[0]
      const segments = rawPath.replace(/^\/api\/v\d+\//, '').split('/').filter(Boolean)
      const moduleName = segments[0] ?? 'unknown'

      const entityId =
        req.params?.id ??
        req.params?.requestId ??
        (response && typeof response === 'object' && 'id' in (response as any)
          ? String((response as any).id)
          : null)

      let payload = redact(req.body ?? {})
      let serialized = JSON.stringify(payload)
      if (serialized.length > MAX_BODY_CHARS) {
        payload = { _truncated: true, _size: serialized.length }
      }

      await prisma.auditLog.create({
        data: {
          tenantId: user.tenantId,
          employeeId: user.sub ?? null,
          action,
          module: moduleName,
          entityId: entityId ? String(entityId) : null,
          newData: { _path: rawPath, _method: req.method, body: payload } as any,
          ipAddress: req.ip ?? req.headers?.['x-forwarded-for'] ?? null,
          impersonatedBy: user.impersonatedBy ?? null,
        },
      })
    } catch (e) {
      // سجل التدقيق لا يجوز أن يُفشل عملية ناجحة
      this.logger.warn(`تعذّر كتابة سجل التدقيق: ${(e as Error).message}`)
    }
  }
}
