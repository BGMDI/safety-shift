import { Injectable, UnauthorizedException } from '@nestjs/common'
import { PassportStrategy } from '@nestjs/passport'
import { ExtractJwt, Strategy } from 'passport-jwt'

export interface PlatformJwtPayload {
  sub: string
  email: string
  fullName: string
}

@Injectable()
export class PlatformJwtStrategy extends PassportStrategy(Strategy, 'platform-jwt') {
  constructor() {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: process.env.PLATFORM_JWT_SECRET!,
    })
  }

  async validate(payload: PlatformJwtPayload) {
    if (!payload.sub) throw new UnauthorizedException()
    return payload
  }
}
