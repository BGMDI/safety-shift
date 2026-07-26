import { Module } from '@nestjs/common'
import { JwtModule } from '@nestjs/jwt'
import { PassportModule } from '@nestjs/passport'
import { PlatformAuthController } from './platform-auth.controller'
import { PlatformAuthService } from './platform-auth.service'
import { PlatformJwtStrategy } from './strategies/platform-jwt.strategy'

@Module({
  imports: [
    PassportModule,
    JwtModule.register({
      secret: process.env.PLATFORM_JWT_SECRET,
      signOptions: { expiresIn: process.env.PLATFORM_JWT_EXPIRES_IN ?? '30m' },
    }),
  ],
  controllers: [PlatformAuthController],
  providers: [PlatformAuthService, PlatformJwtStrategy],
  exports: [PlatformAuthService],
})
export class PlatformAuthModule {}
