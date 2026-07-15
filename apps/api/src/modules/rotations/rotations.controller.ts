import { Controller, Get, Post, Delete, Body, Param, Query, UseGuards } from '@nestjs/common'
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger'
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard'
import { RolesGuard } from '../../common/guards/roles.guard'
import { Roles } from '../../common/decorators/roles.decorator'
import { CurrentUser } from '../../common/decorators/current-user.decorator'
import { RotationsService } from './rotations.service'
import { JwtPayload } from '@shift-saas/types'

@ApiTags('Rotations')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('rotations')
export class RotationsController {
  constructor(private svc: RotationsService) {}

  @Get() @Roles('super_admin', 'hr_manager', 'supervisor')
  findAll(@CurrentUser() u: JwtPayload) {
    return this.svc.findAll(u.tenantId)
  }

  @Post() @Roles('super_admin', 'hr_manager')
  create(@CurrentUser() u: JwtPayload, @Body() body: any) {
    return this.svc.create(u.tenantId, body)
  }

  @Delete(':id') @Roles('super_admin', 'hr_manager')
  remove(@CurrentUser() u: JwtPayload, @Param('id') id: string) {
    return this.svc.remove(u.tenantId, id)
  }

  /* ── المجموعات ── */

  @Post(':id/groups') @Roles('super_admin', 'hr_manager')
  addGroup(@CurrentUser() u: JwtPayload, @Param('id') id: string, @Body() body: { name?: string }) {
    return this.svc.addGroup(u.tenantId, id, body?.name)
  }

  @Delete('groups/:groupId') @Roles('super_admin', 'hr_manager')
  removeGroup(@CurrentUser() u: JwtPayload, @Param('groupId') groupId: string) {
    return this.svc.removeGroup(u.tenantId, groupId)
  }

  @Post('groups/:groupId/members') @Roles('super_admin', 'hr_manager')
  addMembers(
    @CurrentUser() u: JwtPayload,
    @Param('groupId') groupId: string,
    @Body() body: { employeeIds: string[] },
  ) {
    return this.svc.addMembers(u.tenantId, groupId, body.employeeIds)
  }

  @Delete('groups/:groupId/members/:employeeId') @Roles('super_admin', 'hr_manager')
  removeMember(
    @CurrentUser() u: JwtPayload,
    @Param('groupId') groupId: string,
    @Param('employeeId') employeeId: string,
  ) {
    return this.svc.removeMember(u.tenantId, groupId, employeeId)
  }

  /* ── التوزيع التلقائي ── */

  @Post(':id/distribute') @Roles('super_admin', 'hr_manager')
  distribute(@CurrentUser() u: JwtPayload, @Param('id') id: string, @Body() body: { employeeIds: string[] }) {
    return this.svc.distribute(u.tenantId, id, body.employeeIds)
  }

  /* ── المعاينة والتطبيق ── */

  @Get(':id/preview') @Roles('super_admin', 'hr_manager', 'supervisor')
  preview(
    @CurrentUser() u: JwtPayload,
    @Param('id') id: string,
    @Query('days') days?: string,
    @Query('startDate') startDate?: string,
  ) {
    return this.svc.preview(u.tenantId, id, days ? Number(days) : 14, startDate)
  }

  @Post(':id/apply') @Roles('super_admin', 'hr_manager')
  apply(
    @CurrentUser() u: JwtPayload,
    @Param('id') id: string,
    @Body() body: { days?: number; startDate?: string },
  ) {
    return this.svc.apply(u.tenantId, id, body?.days ?? 30, body?.startDate)
  }
}
