import { Controller, Get, Post, Put, Delete, Body, Param, Query, UseGuards } from '@nestjs/common'
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger'
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard'
import { RolesGuard } from '../../common/guards/roles.guard'
import { Roles } from '../../common/decorators/roles.decorator'
import { CurrentUser } from '../../common/decorators/current-user.decorator'
import { AttendanceService } from './attendance.service'
import { JwtPayload } from '@shift-saas/types'

@ApiTags('Attendance')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('attendance')
export class AttendanceController {
  constructor(private svc: AttendanceService) {}

  /* كشف التحضير: كل الموظفين النشطين + سجل اليوم المختار */
  @Get('roster') @Roles('super_admin', 'hr_manager', 'supervisor')
  getRoster(
    @CurrentUser() u: JwtPayload,
    @Query('date') date?: string,
    @Query('branchId') branchId?: string,
    @Query('departmentId') departmentId?: string,
  ) {
    return this.svc.getRoster(u.tenantId, date, { branchId, departmentId })
  }

  @Get('summary') @Roles('super_admin', 'hr_manager', 'supervisor')
  getSummary(
    @CurrentUser() u: JwtPayload,
    @Query('month') month: string,
    @Query('year') year: string,
  ) {
    return this.svc.getSummary(u.tenantId, Number(month), Number(year))
  }

  /* سجلّي اليوم — للتحضير الذاتي */
  @Get('me/today')
  getMyToday(@CurrentUser() u: JwtPayload) {
    return this.svc.getMyToday(u.tenantId, u.sub)
  }

  /* كشف حضوري الشخصي — أي موظف يرى سجله فقط */
  @Get('me/logs')
  getMyLogs(
    @CurrentUser() u: JwtPayload,
    @Query('month') month?: string,
    @Query('year') year?: string,
  ) {
    return this.svc.getMyLogs(u.tenantId, u.sub, month ? Number(month) : undefined, year ? Number(year) : undefined)
  }

  @Get() @Roles('super_admin', 'hr_manager', 'supervisor')
  getLogs(
    @CurrentUser() u: JwtPayload,
    @Query('date') date?: string,
    @Query('employeeId') employeeId?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.svc.getLogs(u.tenantId, { date, employeeId, startDate, endDate })
  }

  /* تحضير جماعي */
  @Post('bulk') @Roles('super_admin', 'hr_manager', 'supervisor')
  bulk(@CurrentUser() u: JwtPayload, @Body() body: { date: string; employeeIds: string[]; status?: string }) {
    return this.svc.bulkMark(u.tenantId, body)
  }

  /* تحضير ذاتي: حضور أو انصراف الآن */
  @Post('self-check')
  selfCheck(@CurrentUser() u: JwtPayload, @Body() body: { type: 'in' | 'out' }) {
    return this.svc.selfCheck(u.tenantId, u.sub, body.type)
  }

  /* استيراد سجلات بصمة */
  @Post('import') @Roles('super_admin', 'hr_manager')
  importLogs(
    @CurrentUser() u: JwtPayload,
    @Body() body: { rows: Array<{ employeeCode: string; date: string; checkIn?: string; checkOut?: string }> },
  ) {
    return this.svc.importLogs(u.tenantId, body.rows)
  }

  @Post() @Roles('super_admin', 'hr_manager', 'supervisor')
  log(@CurrentUser() u: JwtPayload, @Body() body: any) {
    return this.svc.logAttendance(u.tenantId, body)
  }

  /* تعديل سجل — يُؤرشف قبل/بعد في التدقيق */
  @Put(':id') @Roles('super_admin', 'hr_manager', 'supervisor')
  update(
    @CurrentUser() u: JwtPayload,
    @Param('id') id: string,
    @Body() body: { checkIn?: string | null; checkOut?: string | null; status?: string; notes?: string },
  ) {
    return this.svc.updateLog(u.tenantId, id, body, u.sub)
  }

  @Delete(':id') @Roles('super_admin', 'hr_manager')
  remove(@CurrentUser() u: JwtPayload, @Param('id') id: string) {
    return this.svc.deleteLog(u.tenantId, id, u.sub)
  }
}
