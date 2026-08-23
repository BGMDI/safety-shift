import { Controller, Get } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'
import { prisma } from '@shift-saas/database'

/**
 * فحص صحة عام (بلا مصادقة) — يميّز بين «التطبيق لا يعمل» و«التطبيق يعمل لكنه
 * لا يصل لقاعدة البيانات»، وهو تمييز يستحيل عمله من الخارج لأن كليهما يبدو تعليقاً.
 *
 * لا يكشف أي سرّ: المضيف فقط بلا مستخدم ولا كلمة مرور.
 */
@ApiTags('Health')
@Controller('health')
export class HealthController {
  @Get()
  async check() {
    const raw = process.env.DATABASE_URL ?? ''
    let dbHost = '(غير مضبوط)'
    try {
      if (raw) dbHost = new URL(raw).host
    } catch {
      dbHost = '(نصّ اتصال غير صالح)'
    }

    const started = Date.now()
    let db: { ok: boolean; ms: number; error?: string }
    try {
      // مهلة قصيرة: نريد تشخيصاً سريعاً لا انتظاراً طويلاً
      await Promise.race([
        prisma.$queryRaw`SELECT 1`,
        new Promise((_, reject) => setTimeout(() => reject(new Error('انتهت المهلة بعد 8 ثوانٍ')), 8000)),
      ])
      db = { ok: true, ms: Date.now() - started }
    } catch (e) {
      db = { ok: false, ms: Date.now() - started, error: (e as Error).message.split('\n')[0].slice(0, 200) }
    }

    return {
      app: 'ok',
      uptimeSeconds: Math.round(process.uptime()),
      nodeEnv: process.env.NODE_ENV ?? '(غير مضبوط)',
      database: { host: dbHost, ...db },
      frontendOrigins: (process.env.FRONTEND_URL ?? '').split(',').filter(Boolean).length,
    }
  }
}
