import { Controller, Get, Post, Put, Delete, Body, Param, UseGuards } from '@nestjs/common'
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger'
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard'
import { RolesGuard } from '../../common/guards/roles.guard'
import { Roles } from '../../common/decorators/roles.decorator'
import { CurrentUser } from '../../common/decorators/current-user.decorator'
import { BranchesService } from './branches.service'
import { JwtPayload } from '@shift-saas/types'

@ApiTags('Branches')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('branches')
export class BranchesController {
  constructor(private svc: BranchesService) {}

  @Get() @Roles('super_admin', 'hr_manager', 'supervisor')
  findAll(@CurrentUser() u: JwtPayload) { return this.svc.findAll(u.tenantId) }

  @Post() @Roles('super_admin', 'hr_manager')
  create(@CurrentUser() u: JwtPayload, @Body() body: any) { return this.svc.create(u.tenantId, body) }

  @Put(':id') @Roles('super_admin', 'hr_manager')
  update(@CurrentUser() u: JwtPayload, @Param('id') id: string, @Body() body: any) { return this.svc.update(u.tenantId, id, body) }

  @Delete(':id') @Roles('super_admin', 'hr_manager')
  remove(@CurrentUser() u: JwtPayload, @Param('id') id: string) { return this.svc.remove(u.tenantId, id) }
}
