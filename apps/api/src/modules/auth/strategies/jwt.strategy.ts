import { Injectable, UnauthorizedException } from '@nestjs/common'
import { PassportStrategy } from '@nestjs/passport'
import { ExtractJwt, Strategy } from 'passport-jwt'
import { JwtPayload } from '@shift-saas/types'
import { prisma } from '@shift-saas/database'

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor() {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: process.env.JWT_SECRET!,
    })
  }

  async validate(payload: JwtPayload) {
    if (!payload.sub || !payload.tenantId) {
      throw new UnauthorizedException()
    }

    const employee = await prisma.employee.findFirst({
      where: { id: payload.sub, tenantId: payload.tenantId, status: 'ACTIVE' },
      include: {
        employeeRoles: { include: { role: true } },
        tenant: { select: { planStatus: true, subscriptionEndsAt: true, enabledModules: true } },
      },
    })
    const tenant = employee?.tenant
    const expiredByDate = tenant?.subscriptionEndsAt ? tenant.subscriptionEndsAt < new Date() : false
    if (!employee || !tenant || tenant.planStatus === 'EXPIRED' || tenant.planStatus === 'CANCELLED' || expiredByDate) {
      throw new UnauthorizedException()
    }

    return {
      sub: employee.id,
      tenantId: employee.tenantId,
      email: employee.email!,
      roles: employee.employeeRoles.map((er) => er.role.name),
      modules: tenant.enabledModules,
    } satisfies JwtPayload
  }
}
