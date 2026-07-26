import { Injectable, UnauthorizedException, ConflictException } from '@nestjs/common'
import { JwtService } from '@nestjs/jwt'
import * as bcrypt from 'bcrypt'
import { prisma } from '@shift-saas/database'
import { PlatformLoginDto, PlatformBootstrapDto } from './dto/platform-login.dto'

@Injectable()
export class PlatformAuthService {
  constructor(private jwt: JwtService) {}

  async login(dto: PlatformLoginDto) {
    const admin = await prisma.platformAdmin.findUnique({ where: { email: dto.email } })
    if (!admin) throw new UnauthorizedException('بيانات الدخول غير صحيحة')
    const valid = await bcrypt.compare(dto.password, admin.passwordHash)
    if (!valid) throw new UnauthorizedException('بيانات الدخول غير صحيحة')

    const accessToken = this.jwt.sign(
      { sub: admin.id, email: admin.email, fullName: admin.fullName },
      { secret: process.env.PLATFORM_JWT_SECRET, expiresIn: process.env.PLATFORM_JWT_EXPIRES_IN ?? '30m' },
    )
    return { accessToken, admin: { id: admin.id, email: admin.email, fullName: admin.fullName } }
  }

  /** إنشاء أول حساب مالك منصة — يعمل فقط إن لم يوجد أي حساب بعد (تحصين ضد إنشاء حسابات إضافية بلا مصادقة) */
  async bootstrap(dto: PlatformBootstrapDto) {
    const count = await prisma.platformAdmin.count()
    if (count > 0) throw new ConflictException('يوجد حساب مالك منصة مسبقاً — سجّل الدخول بدلاً من ذلك')

    const passwordHash = await bcrypt.hash(dto.password, 12)
    const admin = await prisma.platformAdmin.create({
      data: { email: dto.email, passwordHash, fullName: dto.fullName },
    })
    return this.login({ email: dto.email, password: dto.password }).then(r => ({ ...r, created: true, adminId: admin.id }))
  }
}
