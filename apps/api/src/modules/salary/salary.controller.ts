import { Controller, Get, Post, Put, Delete, Body, Param, UseGuards } from '@nestjs/common'
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger'
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard'
import { RolesGuard } from '../../common/guards/roles.guard'
import { Roles } from '../../common/decorators/roles.decorator'
import { CurrentUser } from '../../common/decorators/current-user.decorator'
import { assertSelfOrHR } from '../../common/auth.util'
import { SalaryService } from './salary.service'
import { CreateSalaryComponentDto, UpdateSalaryComponentDto } from './dto/salary.dto'
import { JwtPayload } from '@shift-saas/types'

@ApiTags('Salary')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('salary')
export class SalaryController {
  constructor(private svc: SalaryService) {}

  @Get('employee/:id')
  getEmployeeSalary(@CurrentUser() u: JwtPayload, @Param('id') id: string) {
    assertSelfOrHR(u, id)
    return this.svc.getEmployeeSalary(u.tenantId, id)
  }

  @Get('employee/:id/certificate')
  getCertificate(@CurrentUser() u: JwtPayload, @Param('id') id: string) {
    assertSelfOrHR(u, id)
    return this.svc.getSalaryCertificate(u.tenantId, id)
  }

  @Post('component') @Roles('super_admin', 'hr_manager')
  addComponent(@CurrentUser() u: JwtPayload, @Body() dto: CreateSalaryComponentDto) {
    return this.svc.addComponent(u.tenantId, dto)
  }

  @Put('component/:id') @Roles('super_admin', 'hr_manager')
  updateComponent(@CurrentUser() u: JwtPayload, @Param('id') id: string, @Body() dto: UpdateSalaryComponentDto) {
    return this.svc.updateComponent(u.tenantId, id, dto)
  }

  @Delete('component/:id') @Roles('super_admin', 'hr_manager')
  removeComponent(@CurrentUser() u: JwtPayload, @Param('id') id: string) {
    return this.svc.removeComponent(u.tenantId, id)
  }
}
