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
  const app = await NestFactory.create<NestExpressApplication>(AppModule)

  // تقديم ملفات الرفع (صور الموظفين، إلخ)
  app.useStaticAssets(join(process.cwd(), 'uploads'), { prefix: '/uploads' })

  // Security headers
  app.use(helmet())

  // CORS
  app.enableCors({
    origin: process.env.FRONTEND_URL,
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

  await app.listen(process.env.PORT ?? 4000)
}

bootstrap()
