import { Module } from '@nestjs/common'
import { JwtModule } from '@nestjs/jwt'
import { PlatformController } from './platform.controller'
import { PlatformService } from './platform.service'

@Module({
  imports: [
    // JwtService مُهيّأ بسرّ توكن الشركات (JWT_SECRET) — يُستخدم فقط لصكّ توكن انتحال شخصية أدمن شركة عند الحاجة
    JwtModule.register({
      secret: process.env.JWT_SECRET,
      signOptions: { expiresIn: process.env.JWT_EXPIRES_IN ?? '15m' },
    }),
  ],
  controllers: [PlatformController],
  providers: [PlatformService],
})
export class PlatformModule {}
