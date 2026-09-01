// تحميل متغيرات البيئة من جذر المشروع قبل أي استيراد آخر
import { config as loadEnv } from 'dotenv'
import { join } from 'path'
loadEnv({ path: join(__dirname, '../../../.env') })

import { NestFactory } from '@nestjs/core'
import { ValidationPipe } from '@nestjs/common'
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger'
import { NestExpressApplication } from '@nestjs/platform-express'
import helmet from 'helmet'
import { AppModule } from './app.module'

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { rawBody: true })

  // تقديم ملفات الرفع (صور الموظفين، إلخ)
  app.useStaticAssets(join(process.cwd(), 'uploads'), { prefix: '/uploads' })

  // Security headers
  app.use(helmet())

  // CORS — يقبل عدة نطاقات مفصولة بفاصلة، لأن النشر يُنتج أكثر من عنوان
  // (نطاق الإنتاج + نطاقات المعاينة التي يولّدها Vercel لكل دفعة)
  const allowedOrigins = (process.env.FRONTEND_URL ?? '')
    .split(',')
    .map((o) => o.trim().replace(/\/$/, ''))
    .filter(Boolean)

  app.enableCors({
    origin: (origin, callback) => {
      // الطلبات بلا Origin (curl، تطبيقات الجوال، فحوص الصحة) تُقبل
      if (!origin) return callback(null, true)
      const clean = origin.replace(/\/$/, '')
      if (allowedOrigins.includes(clean)) return callback(null, true)
      callback(new Error(`الأصل غير مسموح: ${origin}`), false)
    },
    credentials: true,
  })

  // Global validation pipe — rejects unknown fields, validates all inputs
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  )

  app.setGlobalPrefix('api/v1')

  // Swagger docs (dev only)
  if (process.env.NODE_ENV !== 'production') {
    const config = new DocumentBuilder()
      .setTitle('Shift SaaS API')
      .setVersion('1.0')
      .addBearerAuth()
      .build()
    SwaggerModule.setup('docs', app, SwaggerModule.createDocument(app, config))
  }

  // الربط بـ 0.0.0.0 صراحةً — داخل الحاويات لا يكفي الافتراضي أحياناً،
  // فيستمع التطبيق على الواجهة المحلية فقط ولا تصله طلبات البوّابة
  const port = Number(process.env.PORT ?? 4000)
  await app.listen(port, '0.0.0.0')
  console.log(`[bootstrap] يستمع على 0.0.0.0:${port} — PORT من البيئة: ${process.env.PORT ?? '(غير مضبوط)'}`)
}

bootstrap()
