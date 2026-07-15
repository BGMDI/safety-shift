import { Controller, Get, Post, Put, Delete, Body, Param, UseGuards } from '@nestjs/common'
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger'
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard'
import { RolesGuard } from '../../common/guards/roles.guard'
import { Roles } from '../../common/decorators/roles.decorator'
import { CurrentUser } from '../../common/decorators/current-user.decorator'
import { JobTitlesService } from './job-titles.service'
import { CreateJobTitleDto, UpdateJobTitleDto } from './dto/job-title.dto'
import { JwtPayload } from '@shift-saas/types'

@ApiTags('JobTitles')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('job-titles')
export class JobTitlesController {
  constructor(private svc: JobTitlesService) {}

  @Get() @Roles('super_admin', 'hr_manager', 'supervisor')
  findAll(@CurrentUser() u: JwtPayload) { return this.svc.findAll(u.tenantId) }

  @Post() @Roles('super_admin', 'hr_manager')
  create(@CurrentUser() u: JwtPayload, @Body() dto: CreateJobTitleDto) { return this.svc.create(u.tenantId, dto) }

  @Put(':id') @Roles('super_admin', 'hr_manager')
  update(@CurrentUser() u: JwtPayload, @Param('id') id: string, @Body() dto: UpdateJobTitleDto) { return this.svc.update(u.tenantId, id, dto) }

  @Delete(':id') @Roles('super_admin', 'hr_manager')
  remove(@CurrentUser() u: JwtPayload, @Param('id') id: string) { return this.svc.remove(u.tenantId, id) }
}
