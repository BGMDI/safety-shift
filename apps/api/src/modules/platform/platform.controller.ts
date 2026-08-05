import {
  Controller, Get, Post, Put, Delete, Body, Param, Req, UseGuards,
  UseInterceptors, UploadedFile, BadRequestException,
} from '@nestjs/common'
import { FileInterceptor } from '@nestjs/platform-express'
import { diskStorage } from 'multer'
import { extname, join } from 'path'
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger'
import { PlatformAuthGuard } from '../../common/guards/platform-auth.guard'
import { PlatformService } from './platform.service'
import {
  CreateTemplateDto, UpdateTemplateDto,
  CreateTenantDto, UpdateTenantModulesDto, ExtendSubscriptionDto, UpdateTenantInfoDto,
} from './dto/platform.dto'

const logoStorage = diskStorage({
  destination: join(process.cwd(), 'uploads', 'tenants'),
  filename: (_req, file, cb) => {
    const unique = Date.now() + '-' + Math.round(Math.random() * 1e9)
    cb(null, unique + extname(file.originalname))
  },
})

@ApiTags('Platform')
@ApiBearerAuth()
@UseGuards(PlatformAuthGuard)
@Controller('platform')
export class PlatformController {
  constructor(private svc: PlatformService) {}

  /* ── خطط الاشتراك ── */
  @Get('templates') listTemplates() { return this.svc.listTemplates() }
  @Post('templates') createTemplate(@Body() dto: CreateTemplateDto) { return this.svc.createTemplate(dto) }
  @Put('templates/:id') updateTemplate(@Param('id') id: string, @Body() dto: UpdateTemplateDto) { return this.svc.updateTemplate(id, dto) }
  @Delete('templates/:id') removeTemplate(@Param('id') id: string) { return this.svc.removeTemplate(id) }

  /* ── الشركات ── */
  @Get('tenants') listTenants() { return this.svc.listTenants() }
  @Get('tenants/:id') getTenant(@Param('id') id: string) { return this.svc.getTenant(id) }
  /** يصكّ توكن دخول تينانت لأدمن الشركة — جلسة قصيرة بلا refreshToken، موسومة بهوية مالك المنصة */
  @Post('tenants/:id/impersonate') impersonate(@Param('id') id: string, @Req() req: any) {
    return this.svc.impersonateTenant(id, req.user?.sub)
  }
  @Post('tenants') createTenant(@Body() dto: CreateTenantDto) { return this.svc.createTenant(dto) }
  @Put('tenants/:id') updateInfo(@Param('id') id: string, @Body() dto: UpdateTenantInfoDto) { return this.svc.updateTenantInfo(id, dto) }
  @Put('tenants/:id/modules') updateModules(@Param('id') id: string, @Body() dto: UpdateTenantModulesDto) { return this.svc.updateTenantModules(id, dto) }
  @Put('tenants/:id/extend') extend(@Param('id') id: string, @Body() dto: ExtendSubscriptionDto) { return this.svc.extendSubscription(id, dto) }
  @Put('tenants/:id/suspend') suspend(@Param('id') id: string) { return this.svc.suspendTenant(id) }
  @Put('tenants/:id/reactivate') reactivate(@Param('id') id: string) { return this.svc.reactivateTenant(id) }

  /* ── طلبات إجازة الشركة — عرض وحذف حصراً من لوحة مالك المنصة ── */
  @Get('tenants/:id/leave-requests') listLeaveRequests(@Param('id') id: string) { return this.svc.listTenantLeaveRequests(id) }
  @Delete('tenants/:id/leave-requests/:requestId') deleteLeaveRequest(
    @Param('id') id: string, @Param('requestId') requestId: string,
  ) { return this.svc.deleteTenantLeaveRequest(id, requestId) }

  /* ── سجل تدقيق مالك المنصة لهذه الشركة — منفصل تماماً عن سجل تدقيق الشركة نفسها ── */
  @Get('tenants/:id/platform-audit') listPlatformAudit(@Param('id') id: string) { return this.svc.listPlatformAuditForTenant(id) }

  @Post('tenants/:id/logo')
  @UseInterceptors(FileInterceptor('logo', {
    storage: logoStorage,
    fileFilter: (_req, file, cb) => {
      if (!file.mimetype.match(/\/(jpg|jpeg|png|webp|svg\+xml)$/i)) {
        return cb(new BadRequestException('يُسمح فقط بصور JPG/PNG/WebP/SVG'), false)
      }
      cb(null, true)
    },
    limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
  }))
  async uploadLogo(@Param('id') id: string, @UploadedFile() file: Express.Multer.File) {
    if (!file) throw new BadRequestException('لم يتم رفع شعار')
    const url = `/uploads/tenants/${file.filename}`
    return this.svc.updateTenantLogo(id, url)
  }
}
