import { Controller, Get, Post, Put, Delete, Body, Param, UseGuards } from '@nestjs/common'
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger'
import { PlatformAuthGuard } from '../../common/guards/platform-auth.guard'
import { PlatformService } from './platform.service'
import {
  CreateTemplateDto, UpdateTemplateDto,
  CreateTenantDto, UpdateTenantModulesDto, ExtendSubscriptionDto,
} from './dto/platform.dto'

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
  @Post('tenants') createTenant(@Body() dto: CreateTenantDto) { return this.svc.createTenant(dto) }
  @Put('tenants/:id/modules') updateModules(@Param('id') id: string, @Body() dto: UpdateTenantModulesDto) { return this.svc.updateTenantModules(id, dto) }
  @Put('tenants/:id/extend') extend(@Param('id') id: string, @Body() dto: ExtendSubscriptionDto) { return this.svc.extendSubscription(id, dto) }
  @Put('tenants/:id/suspend') suspend(@Param('id') id: string) { return this.svc.suspendTenant(id) }
  @Put('tenants/:id/reactivate') reactivate(@Param('id') id: string) { return this.svc.reactivateTenant(id) }
}
