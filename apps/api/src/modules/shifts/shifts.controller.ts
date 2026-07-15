import { Controller, Get, Post, Body, Query, UseGuards } from '@nestjs/common'
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger'
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard'
import { RolesGuard } from '../../common/guards/roles.guard'
import { CurrentUser } from '../../common/decorators/current-user.decorator'
import { Roles } from '../../common/decorators/roles.decorator'
import { ShiftsService } from './shifts.service'
import { JwtPayload } from '@shift-saas/types'

@ApiTags('Shifts')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('shifts')
export class ShiftsController {
  constructor(private shiftsService: ShiftsService) {}

  @Get() @Roles('super_admin', 'hr_manager', 'supervisor')
  findAll(@CurrentUser() user: JwtPayload) {
    return this.shiftsService.findAll(user.tenantId)
  }

  @Post()
  @Roles('super_admin', 'hr_manager')
  create(@CurrentUser() user: JwtPayload, @Body() body: any) {
    return this.shiftsService.create(user.tenantId, body)
  }

  @Post('assign')
  @Roles('super_admin', 'hr_manager')
  assign(@CurrentUser() user: JwtPayload, @Body() body: any) {
    return this.shiftsService.assignEmployeeToShift(user.tenantId, body)
  }

  /* جدولي الشخصي — أي موظف يرى شفتاته فقط */
  @Get('my-schedule')
  mySchedule(
    @CurrentUser() user: JwtPayload,
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
  ) {
    return this.shiftsService.generateSchedule(user.tenantId, new Date(startDate), new Date(endDate), user.sub)
  }

  @Get('schedule') @Roles('super_admin', 'hr_manager', 'supervisor')
  schedule(
    @CurrentUser() user: JwtPayload,
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
  ) {
    return this.shiftsService.generateSchedule(
      user.tenantId,
      new Date(startDate),
      new Date(endDate),
    )
  }
}
