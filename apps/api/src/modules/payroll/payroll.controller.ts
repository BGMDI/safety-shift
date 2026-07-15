import { Controller, Get, Post, Put, Delete, Body, Param, UseGuards } from '@nestjs/common'
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger'
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard'
import { RolesGuard } from '../../common/guards/roles.guard'
import { Roles } from '../../common/decorators/roles.decorator'
import { CurrentUser } from '../../common/decorators/current-user.decorator'
import { PayrollService } from './payroll.service'
import { JwtPayload } from '@shift-saas/types'

@ApiTags('Payroll')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('payroll')
export class PayrollController {
  constructor(private svc: PayrollService) {}

  /* قسائم راتبي — أي موظف يرى قسائمه المعتمدة فقط */
  @Get('my')
  getMyPayslips(@CurrentUser() u: JwtPayload) { return this.svc.getEmployeePayslips(u.tenantId, u.sub) }

  @Get() @Roles('super_admin', 'hr_manager')
  getRuns(@CurrentUser() u: JwtPayload) { return this.svc.getRuns(u.tenantId) }

  @Get(':id') @Roles('super_admin', 'hr_manager')
  getRun(@CurrentUser() u: JwtPayload, @Param('id') id: string) { return this.svc.getRun(u.tenantId, id) }

  @Post() @Roles('super_admin', 'hr_manager')
  create(@CurrentUser() u: JwtPayload, @Body() body: { month: number; year: number }) {
    return this.svc.createRun(u.tenantId, body.month, body.year)
  }

  @Put(':id/approve') @Roles('super_admin')
  approve(@CurrentUser() u: JwtPayload, @Param('id') id: string) {
    return this.svc.approveRun(u.tenantId, id, u.sub)
  }

  @Delete(':id') @Roles('super_admin')
  remove(@CurrentUser() u: JwtPayload, @Param('id') id: string) {
    return this.svc.deleteRun(u.tenantId, id)
  }
}
