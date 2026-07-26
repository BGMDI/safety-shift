import { Injectable, ExecutionContext, UnauthorizedException } from '@nestjs/common'
import { AuthGuard } from '@nestjs/passport'

/** حارس منفصل تماماً عن JwtAuthGuard — يقبل فقط توكنات مالك المنصة الموقّعة بـ PLATFORM_JWT_SECRET */
@Injectable()
export class PlatformAuthGuard extends AuthGuard('platform-jwt') {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  handleRequest<TUser = any>(err: unknown, user: TUser): TUser {
    if (err || !user) throw new UnauthorizedException('رمز مالك المنصة غير صالح أو منتهي')
    return user
  }
}
