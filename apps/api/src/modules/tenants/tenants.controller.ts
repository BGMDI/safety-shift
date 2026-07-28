import { Controller, Get, UseGuards } from '@nestjs/common'
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger'
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard'
import { CurrentUser } from '../../common/decorators/current-user.decorator'
import { TenantsService } from './tenants.service'
import { JwtPayload } from '@shift-saas/types'

@ApiTags('Tenants')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('tenants')
export class TenantsController {
  constructor(private svc: TenantsService) {}

  /** أي موظف مسجّل دخول يرى اسم وشعار شركته فقط — لعرضهما في واجهة النظام */
  @Get('me')
  getMine(@CurrentUser() user: JwtPayload) {
    return this.svc.getMine(user.tenantId)
  }
}
