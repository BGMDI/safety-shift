import { BadRequestException, Body, Controller, Get, Param, Post, Put, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common'
import { FileInterceptor } from '@nestjs/platform-express'
import { diskStorage } from 'multer'
import { extname, join } from 'path'
import { mkdirSync } from 'fs'
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger'
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard'
import { RolesGuard } from '../../common/guards/roles.guard'
import { Roles } from '../../common/decorators/roles.decorator'
import { AnyEmployee } from '../../common/decorators/any-employee.decorator'
import { CurrentUser } from '../../common/decorators/current-user.decorator'
import { TenantsService } from './tenants.service'
import { JwtPayload } from '@shift-saas/types'
import { UpdateCertificateSettingsDto } from './dto/certificate-settings.dto'

const certificateDir = join(process.cwd(), 'uploads', 'certificates')
mkdirSync(certificateDir, { recursive: true })
const certificateStorage = diskStorage({
  destination: certificateDir,
  filename: (_req, file, cb) => cb(null, `${Date.now()}-${Math.round(Math.random() * 1e9)}${extname(file.originalname).toLowerCase()}`),
})

@ApiTags('Tenants')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('tenants')
export class TenantsController {
  constructor(private svc: TenantsService) {}

  /** أي موظف مسجّل دخول يرى اسم وشعار شركته فقط — لعرضهما في واجهة النظام */
  @Get('me')
  @AnyEmployee()
  getMine(@CurrentUser() user: JwtPayload) {
    return this.svc.getMine(user.tenantId)
  }

  @Get('certificate-settings')
  @AnyEmployee()
  getCertificateSettings(@CurrentUser() user: JwtPayload) {
    return this.svc.getCertificateSettings(user.tenantId)
  }

  @Put('certificate-settings')
  @Roles('super_admin', 'hr_manager')
  updateCertificateSettings(@CurrentUser() user: JwtPayload, @Body() dto: UpdateCertificateSettingsDto) {
    return this.svc.updateCertificateSettings(user.tenantId, dto)
  }

  @Post('certificate-assets/:kind')
  @Roles('super_admin', 'hr_manager')
  @UseInterceptors(FileInterceptor('file', {
    storage: certificateStorage,
    limits: { fileSize: 3 * 1024 * 1024, files: 1 },
    fileFilter: (_req, file, cb) => {
      const allowed = /^image\/(png|jpeg|webp)$/i.test(file.mimetype)
      cb(allowed ? null : new BadRequestException('يُسمح بصور PNG وJPG وWebP فقط'), allowed)
    },
  }))
  uploadCertificateAsset(
    @CurrentUser() user: JwtPayload,
    @Param('kind') kind: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (kind !== 'signature' && kind !== 'stamp') throw new BadRequestException('نوع المرفق غير صحيح')
    if (!file) throw new BadRequestException('اختر صورة للرفع')
    return this.svc.updateCertificateAsset(user.tenantId, kind, `/uploads/certificates/${file.filename}`)
  }
}
