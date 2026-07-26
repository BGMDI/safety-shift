import { Injectable, UnauthorizedException, BadRequestException } from '@nestjs/common'
import { JwtService } from '@nestjs/jwt'
import * as bcrypt from 'bcrypt'
import { prisma } from '@shift-saas/database'
import { JwtPayload, AuthTokens } from '@shift-saas/types'
import { LoginDto } from './dto/login.dto'

@Injectable()
export class AuthService {
  constructor(private jwtService: JwtService) {}

  async login(dto: LoginDto): Promise<AuthTokens> {
    const employee = await prisma.employee.findFirst({
      where: { email: dto.email },
      include: {
        employeeRoles: { include: { role: true } },
        tenant: { select: { planStatus: true, subscriptionEndsAt: true, enabledModules: true } },
      },
    })

    if (!employee || !employee.passwordHash) {
      throw new UnauthorizedException('بيانات الدخول غير صحيحة')
    }

    // اقفل الدخول تلقائياً إذا انتهت مدة الاشتراك ولم تُجدَّد بعد
    const expiredByDate = employee.tenant.subscriptionEndsAt ? employee.tenant.subscriptionEndsAt < new Date() : false
    if (employee.tenant.planStatus === 'EXPIRED' || employee.tenant.planStatus === 'CANCELLED' || expiredByDate) {
      throw new UnauthorizedException('انتهت صلاحية اشتراك شركتك — تواصل مع مزوّد الخدمة للتجديد')
    }

    const isValid = await bcrypt.compare(dto.password, employee.passwordHash)
    if (!isValid) throw new UnauthorizedException('بيانات الدخول غير صحيحة')

    const roles = employee.employeeRoles.map((er) => er.role.name)

    const payload: JwtPayload = {
      sub: employee.id,
      tenantId: employee.tenantId,
      email: employee.email!,
      roles,
      modules: employee.tenant.enabledModules,
    }

    return {
      accessToken: this.jwtService.sign(payload),
      refreshToken: this.jwtService.sign(payload, {
        secret: process.env.JWT_REFRESH_SECRET,
        expiresIn: process.env.JWT_REFRESH_EXPIRES_IN ?? '7d',
      }),
    }
  }

  async hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, 12)
  }

  async refreshToken(refreshToken: string): Promise<AuthTokens> {
    try {
      const payload = this.jwtService.verify<JwtPayload>(refreshToken, {
        secret: process.env.JWT_REFRESH_SECRET,
      })

      // أعد جلب الأقسام المفعّلة والحالة فور كل تجديد — يضمن انعكاس أي تغيير في الباقة دون انتظار انتهاء التوكن
      const tenant = await prisma.tenant.findUnique({
        where: { id: payload.tenantId },
        select: { planStatus: true, subscriptionEndsAt: true, enabledModules: true },
      })
      const expiredByDate = tenant?.subscriptionEndsAt ? tenant.subscriptionEndsAt < new Date() : false
      if (!tenant || tenant.planStatus === 'EXPIRED' || tenant.planStatus === 'CANCELLED' || expiredByDate) {
        throw new UnauthorizedException('انتهت صلاحية اشتراك شركتك')
      }

      return {
        accessToken: this.jwtService.sign({
          sub: payload.sub,
          tenantId: payload.tenantId,
          email: payload.email,
          roles: payload.roles,
          modules: tenant.enabledModules,
        }),
        refreshToken,
      }
    } catch {
      throw new UnauthorizedException('رمز التحديث غير صالح')
    }
  }
}
