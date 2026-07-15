import { Controller, Get, Post, Put, Body, Param, Query, UseGuards } from '@nestjs/common'
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger'
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard'
import { RolesGuard } from '../../common/guards/roles.guard'
import { Roles } from '../../common/decorators/roles.decorator'
import { CurrentUser } from '../../common/decorators/current-user.decorator'
import { isManager } from '../../common/auth.util'
import { UniformsService } from './uniforms.service'
import { JwtPayload } from '@shift-saas/types'

@ApiTags('Uniforms')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('uniforms')
export class UniformsController {
  constructor(private svc: UniformsService) {}

  /* طلبات بدلتي — أي موظف يرى طلباته فقط */
  @Get('my')
  myRequests(@CurrentUser() u: JwtPayload) { return this.svc.getEmployeeRequests(u.tenantId, u.sub) }

  @Get() @Roles('super_admin', 'hr_manager', 'supervisor')
  getAll(@CurrentUser() u: JwtPayload, @Query('status') status?: string) { return this.svc.getAll(u.tenantId, status) }

  /* أي موظف يطلب بدلة لنفسه؛ الإدارة تطلب لأي موظف */
  @Post()
  create(@CurrentUser() u: JwtPayload, @Body() body: any) {
    const employeeId = isManager(u) && body.employeeId ? body.employeeId : u.sub
    return this.svc.create(u.tenantId, { ...body, employeeId })
  }

  /* اعتماد/رفض الطلب — الإدارة فقط */
  @Put(':id/status') @Roles('super_admin', 'hr_manager', 'supervisor')
  updateStatus(@CurrentUser() u: JwtPayload, @Param('id') id: string, @Body() body: { status: string }) {
    return this.svc.updateStatus(u.tenantId, id, body.status, u.sub)
  }
}
