import { Controller, Get, Post, Put, Body, Param, Query, UseGuards } from '@nestjs/common'
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger'
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard'
import { RolesGuard } from '../../common/guards/roles.guard'
import { Roles } from '../../common/decorators/roles.decorator'
import { CurrentUser } from '../../common/decorators/current-user.decorator'
import { isManager } from '../../common/auth.util'
import { OnboardingService } from './onboarding.service'
import { CreateOnboardingDto } from './dto/onboarding.dto'
import { JwtPayload } from '@shift-saas/types'

@ApiTags('Onboarding')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('onboarding')
export class OnboardingController {
  constructor(private svc: OnboardingService) {}

  /* مباشراتي — أي موظف يرى طلباته فقط */
  @Get('my')
  myRequests(@CurrentUser() u: JwtPayload) { return this.svc.getAll(u.tenantId, u.sub) }

  @Get() @Roles('super_admin', 'hr_manager', 'supervisor')
  getAll(@CurrentUser() u: JwtPayload) { return this.svc.getAll(u.tenantId) }

  /* الإدارة تنشئ مباشرة لأي موظف؛ الموظف ينشئ مباشرته الخاصة فقط (عودة من إجازة مثلاً) */
  @Post()
  create(@CurrentUser() u: JwtPayload, @Body() dto: CreateOnboardingDto) {
    const employeeId = isManager(u) && dto.employeeId ? dto.employeeId : u.sub
    return this.svc.create(u.tenantId, { ...dto, employeeId })
  }

  /* البتّ في طلب مباشرة — الأهلية محسوبة ديناميكياً حسب مسار الاعتماد */
  @Put(':id/decide')
  decide(
    @CurrentUser() u: JwtPayload,
    @Param('id') id: string,
    @Body() body: { decision: 'APPROVED' | 'REJECTED'; notes?: string },
  ) {
    return this.svc.decide(u.tenantId, id, u.sub, body.decision, body.notes)
  }
}
