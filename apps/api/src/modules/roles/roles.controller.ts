import { Controller, Get, Post, Put, Delete, Body, Param, Query, UseGuards } from '@nestjs/common'
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger'
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard'
import { RolesGuard } from '../../common/guards/roles.guard'
import { CurrentUser } from '../../common/decorators/current-user.decorator'
import { Roles } from '../../common/decorators/roles.decorator'
import { RolesService } from './roles.service'
import { CreateRoleDto } from './dto/create-role.dto'
import { JwtPayload } from '@shift-saas/types'

@ApiTags('Roles')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('roles')
export class RolesController {
  constructor(private rolesService: RolesService) {}

  /* ── الأدوار ── */
  @Get() @Roles('super_admin', 'hr_manager')
  findAll(@CurrentUser() u: JwtPayload) {
    return this.rolesService.findAll(u.tenantId)
  }

  @Post('seed-defaults')
  @Roles('super_admin')
  seedDefaults(@CurrentUser() u: JwtPayload) {
    return this.rolesService.seedDefaultRoles(u.tenantId)
  }

  @Post()
  @Roles('super_admin')
  create(@CurrentUser() u: JwtPayload, @Body() dto: CreateRoleDto) {
    return this.rolesService.create(u.tenantId, dto)
  }

  @Put(':id')
  @Roles('super_admin')
  update(@CurrentUser() u: JwtPayload, @Param('id') id: string, @Body() dto: CreateRoleDto) {
    return this.rolesService.update(u.tenantId, id, dto)
  }

  @Delete(':id')
  @Roles('super_admin')
  remove(@CurrentUser() u: JwtPayload, @Param('id') id: string) {
    return this.rolesService.remove(u.tenantId, id)
  }

  /* ── تعيين الأدوار للموظفين ── */
  @Get('employees') @Roles('super_admin', 'hr_manager')
  findEmployees(@CurrentUser() u: JwtPayload, @Query('search') search?: string) {
    return this.rolesService.findEmployeesWithRoles(u.tenantId, search)
  }

  @Post(':roleId/employees/:employeeId')
  @Roles('super_admin')
  assignRole(
    @CurrentUser() u: JwtPayload,
    @Param('roleId') roleId: string,
    @Param('employeeId') employeeId: string,
  ) {
    return this.rolesService.assignRole(u.tenantId, employeeId, roleId)
  }

  @Delete(':roleId/employees/:employeeId')
  @Roles('super_admin')
  removeRole(
    @CurrentUser() u: JwtPayload,
    @Param('roleId') roleId: string,
    @Param('employeeId') employeeId: string,
  ) {
    return this.rolesService.removeRole(u.tenantId, employeeId, roleId)
  }
}
