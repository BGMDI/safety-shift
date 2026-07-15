import { Controller, Get, Post, Put, Body, Param, UseGuards } from '@nestjs/common'
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger'
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard'
import { RolesGuard } from '../../common/guards/roles.guard'
import { Roles } from '../../common/decorators/roles.decorator'
import { CurrentUser } from '../../common/decorators/current-user.decorator'
import { assertSelfOrManager } from '../../common/auth.util'
import { CustodyService } from './custody.service'
import { JwtPayload } from '@shift-saas/types'

@ApiTags('Custody')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('custody')
export class CustodyController {
  constructor(private svc: CustodyService) {}

  /* عهدتي — أي موظف يرى عهدته فقط */
  @Get('my')
  myItems(@CurrentUser() u: JwtPayload) { return this.svc.getEmployeeCustody(u.tenantId, u.sub) }

  @Get('employee/:id')
  getItems(@CurrentUser() u: JwtPayload, @Param('id') id: string) {
    assertSelfOrManager(u, id)
    return this.svc.getEmployeeCustody(u.tenantId, id)
  }

  @Post() @Roles('super_admin', 'hr_manager')
  add(@CurrentUser() u: JwtPayload, @Body() body: any) { return this.svc.addCustody(u.tenantId, body) }

  @Put(':id/return') @Roles('super_admin', 'hr_manager')
  returnItem(@CurrentUser() u: JwtPayload, @Param('id') id: string) { return this.svc.returnCustody(u.tenantId, id) }

  @Get('clearance/:id')
  clearance(@CurrentUser() u: JwtPayload, @Param('id') id: string) {
    assertSelfOrManager(u, id)
    return this.svc.getClearanceStatus(u.tenantId, id)
  }
}
