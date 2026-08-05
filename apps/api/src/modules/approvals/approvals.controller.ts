import { Controller, Get, Put, Post, Body, Param, UseGuards } from '@nestjs/common'
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger'
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard'
import { RolesGuard } from '../../common/guards/roles.guard'
import { ModuleGuard } from '../../common/guards/module.guard'
import { Roles } from '../../common/decorators/roles.decorator'
import { AnyEmployee } from '../../common/decorators/any-employee.decorator'
import { RequiresModule } from '../../common/decorators/requires-module.decorator'
import { CurrentUser } from '../../common/decorators/current-user.decorator'
import { ApprovalsService } from './approvals.service'
import { SaveWorkflowDto } from './dto/approval.dto'
import { JwtPayload } from '@shift-saas/types'

@ApiTags('Approvals')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard, ModuleGuard)
@RequiresModule('APPROVALS')
@Controller('approvals')
export class ApprovalsController {
  constructor(private svc: ApprovalsService) {}

  /* إعدادات مسارات الاعتماد — لشؤون الموظفين فقط */
  @Get('workflows') @Roles('super_admin', 'hr_manager')
  listWorkflows(@CurrentUser() u: JwtPayload) { return this.svc.listWorkflows(u.tenantId) }

  @Put('workflows/:type') @Roles('super_admin', 'hr_manager')
  saveWorkflow(@CurrentUser() u: JwtPayload, @Param('type') type: string, @Body() dto: SaveWorkflowDto) {
    return this.svc.saveWorkflow(u.tenantId, type as any, dto.steps)
  }

  @Post('workflows/seed-defaults') @Roles('super_admin', 'hr_manager')
  seedDefaults(@CurrentUser() u: JwtPayload) { return this.svc.seedDefaults(u.tenantId) }

  /* طلبات بانتظار موافقتي — بلا تقييد دور: الأهلية محسوبة ديناميكياً (رئيس قسم/مدير فرع قد يكون موظفاً عادياً بدور النظام) */
  @Get('my-queue') @AnyEmployee()
  myQueue(@CurrentUser() u: JwtPayload) { return this.svc.getMyQueue(u.tenantId, u.sub) }

  /* أثر مسار الاعتماد لطلب معيّن */
  @Get('trail/:requestType/:requestId') @AnyEmployee()
  trail(
    @CurrentUser() u: JwtPayload,
    @Param('requestType') requestType: string,
    @Param('requestId') requestId: string,
  ) {
    return this.svc.getTrail(u.tenantId, requestType as any, requestId)
  }
}
