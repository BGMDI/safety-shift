import { Controller, Get, Post, Put, Delete, Body, Param, Query, UseGuards } from '@nestjs/common'
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger'
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard'
import { RolesGuard } from '../../common/guards/roles.guard'
import { Roles } from '../../common/decorators/roles.decorator'
import { CurrentUser } from '../../common/decorators/current-user.decorator'
import { assertSelfOrManager, isManager } from '../../common/auth.util'
import { LeavesService, CALC_LABELS } from './leaves.service'
import {
  CreateLeaveTypeDto, UpdateLeaveTypeDto,
  AutoAssignBalancesDto,
  CreateLeaveBalanceDto, CreateLeaveRequestDto, ApproveLeaveDto,
} from './dto/leave.dto'
import { JwtPayload } from '@shift-saas/types'

@ApiTags('Leaves')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('leaves')
export class LeavesController {
  constructor(private svc: LeavesService) {}

  // ── أنواع الإجازات ──
  @Get('types')
  getTypes(@CurrentUser() u: JwtPayload) { return this.svc.getLeaveTypes(u.tenantId) }

  /** قائمة أنواع الاحتساب مع تسمياتها العربية */
  @Get('calc-types')
  getCalcTypes() { return CALC_LABELS }

  @Post('types/seed-saudi-defaults') @Roles('super_admin', 'hr_manager')
  seedDefaults(@CurrentUser() u: JwtPayload) { return this.svc.seedSaudiDefaults(u.tenantId) }

  @Post('types') @Roles('super_admin', 'hr_manager')
  createType(@CurrentUser() u: JwtPayload, @Body() dto: CreateLeaveTypeDto) {
    return this.svc.createLeaveType(u.tenantId, dto)
  }

  @Put('types/:id') @Roles('super_admin', 'hr_manager')
  updateType(@CurrentUser() u: JwtPayload, @Param('id') id: string, @Body() dto: UpdateLeaveTypeDto) {
    return this.svc.updateLeaveType(u.tenantId, id, dto)
  }

  @Delete('types/:id') @Roles('super_admin', 'hr_manager')
  removeType(@CurrentUser() u: JwtPayload, @Param('id') id: string) {
    return this.svc.removeLeaveType(u.tenantId, id)
  }

  // ── التوزيع التلقائي للأرصدة ──
  @Post('balances/auto-assign') @Roles('super_admin', 'hr_manager')
  autoAssign(@CurrentUser() u: JwtPayload, @Body() dto: AutoAssignBalancesDto) {
    return this.svc.autoAssignBalances(u.tenantId, dto)
  }

  // ── أرصدة الإجازات — للإدارة أو الموظف نفسه ──
  @Get('balances/:employeeId')
  getBalances(@CurrentUser() u: JwtPayload, @Param('employeeId') eid: string) {
    assertSelfOrManager(u, eid)
    return this.svc.getEmployeeBalances(u.tenantId, eid)
  }

  @Post('balances') @Roles('super_admin', 'hr_manager')
  setBalance(@CurrentUser() u: JwtPayload, @Body() dto: CreateLeaveBalanceDto) {
    return this.svc.setLeaveBalance(u.tenantId, dto)
  }

  // ── طلبات الإجازات — الموظف العادي يرى طلباته فقط ──
  @Get('requests')
  getRequests(
    @CurrentUser() u: JwtPayload,
    @Query('employeeId') eid?: string,
    @Query('status') status?: string,
  ) {
    // إن لم يكن إدارياً نُجبر التصفية على سجله الشخصي مهما طلب
    const scopedId = isManager(u) ? eid : u.sub
    return this.svc.getRequests(u.tenantId, scopedId, status)
  }

  @Post('requests')
  submitRequest(@CurrentUser() u: JwtPayload, @Body() dto: CreateLeaveRequestDto) {
    return this.svc.submitRequest(u.tenantId, u.sub, dto)
  }

  @Put('requests/:id/approve') @Roles('super_admin', 'hr_manager', 'supervisor')
  approveRequest(@CurrentUser() u: JwtPayload, @Param('id') id: string, @Body() dto: ApproveLeaveDto) {
    return this.svc.approveRequest(u.tenantId, id, u.sub, dto)
  }
}
