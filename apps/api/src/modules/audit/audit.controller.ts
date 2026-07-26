import { Controller, Get, Query, UseGuards } from '@nestjs/common'
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger'
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard'
import { RolesGuard } from '../../common/guards/roles.guard'
import { ModuleGuard } from '../../common/guards/module.guard'
import { Roles } from '../../common/decorators/roles.decorator'
import { RequiresModule } from '../../common/decorators/requires-module.decorator'
import { CurrentUser } from '../../common/decorators/current-user.decorator'
import { AuditService } from './audit.service'
import { JwtPayload } from '@shift-saas/types'

@ApiTags('Audit')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard, ModuleGuard)
@RequiresModule('AUDIT')
@Controller('audit')
export class AuditController {
  constructor(private svc: AuditService) {}

  @Get() @Roles('super_admin', 'hr_manager')
  findAll(
    @CurrentUser() u: JwtPayload,
    @Query('module') module?: string,
    @Query('action') action?: string,
    @Query('limit') limit?: string,
  ) {
    return this.svc.findAll(u.tenantId, {
      module,
      action,
      limit: limit ? Number(limit) : undefined,
    })
  }
}
