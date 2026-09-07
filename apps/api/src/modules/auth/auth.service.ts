import { Injectable, UnauthorizedException } from '@nestjs/common'
import { JwtService } from '@nestjs/jwt'
import * as bcrypt from 'bcrypt'
import { prisma } from '@shift-saas/database'
import { JwtPayload, AuthTokens } from '@shift-saas/types'
import { LoginDto } from './dto/login.dto'

@Injectable()
export class AuthService {
  constructor(private jwtService: JwtService) {}

  async login(dto: LoginDto): Promise<AuthTokens> {
    // المطابقة بلا حساسية لحالة الأحرف — بريد خُزّن بأحرف كبيرة كان يمنع صاحبه من الدخول
    const email = dto.email.trim()
    const employee = await prisma.employee.findFirst({
      where: { email: { equals: email, mode: 'insensitive' } },
      include: {
        employeeRoles: { include: { role: true } },
        tenant: { select: { planStatus: true, subscriptionEndsAt: true, enabledModules: true } },
      },
    })

    if (!employee) throw new UnauthorizedException('بيانات الدخول غير صحيحة')

    // سببان شائعان لتعثّر حساب جديد: أُنشئ بلا كلمة مرور، أو حالته ليست «نشط».
    // رسالتهما مميّزة لأن «بيانات الدخول غير صحيحة» كانت تُضلّل المسؤول والموظف معاً.
    if (!employee.passwordHash) {
      throw new UnauthorizedException('لم تُضبط كلمة مرور لهذا الحساب بعد — راجع مسؤول النظام')
    }
    if (employee.status !== 'ACTIVE') {
      throw new UnauthorizedException('الحساب غير مفعّل — راجع مسؤول النظام')
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
        throw new UnauthorizedException('انتهت صلاحية اشتراك شركتك')
      }

      const roles = employee.employeeRoles.map((er) => er.role.name)

      return {
        accessToken: this.jwtService.sign({
          sub: payload.sub,
          tenantId: payload.tenantId,
          email: employee.email!,
          roles,
          modules: tenant.enabledModules,
        }),
        refreshToken,
      }
    } catch {
      throw new UnauthorizedException('رمز التحديث غير صالح')
    }
  }
}
