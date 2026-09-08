import { BadRequestException, Controller, Get, Post, Put, Delete, Body, Param, StreamableFile, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common'
import { FileInterceptor } from '@nestjs/platform-express'
import { memoryStorage } from 'multer'
import { extname } from 'path'
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger'
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard'
import { RolesGuard } from '../../common/guards/roles.guard'
import { Roles } from '../../common/decorators/roles.decorator'
import { CurrentUser } from '../../common/decorators/current-user.decorator'
import { JobTitlesService } from './job-titles.service'
import { CreateJobTitleDto, UpdateJobTitleDto } from './dto/job-title.dto'
import { JwtPayload } from '@shift-saas/types'
import { jobTitlesTemplate } from './job-titles-import'

@ApiTags('JobTitles')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('job-titles')
export class JobTitlesController {
  constructor(private svc: JobTitlesService) {}

  @Get('import-template') @Roles('super_admin', 'hr_manager')
  async importTemplate() {
    return new StreamableFile(Buffer.from(await jobTitlesTemplate()), {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      disposition: 'attachment; filename="job-titles-template.xlsx"',
    })
  }

  @Post('import') @Roles('super_admin', 'hr_manager')
  @UseInterceptors(FileInterceptor('file', {
    storage: memoryStorage(), limits: { fileSize: 2 * 1024 * 1024, files: 1 },
    fileFilter: (_req, file, cb) => {
      const allowed = extname(file.originalname).toLowerCase() === '.xlsx'
      cb(allowed ? null : new BadRequestException('يُسمح بملفات XLSX فقط'), allowed)
    },
  }))
  import(@CurrentUser() u: JwtPayload, @UploadedFile() file: Express.Multer.File) {
    if (!file) throw new BadRequestException('اختر ملف Excel')
    return this.svc.import(u.tenantId, file.buffer)
  }

  @Get() @Roles('super_admin', 'hr_manager', 'supervisor')
  findAll(@CurrentUser() u: JwtPayload) { return this.svc.findAll(u.tenantId) }

  @Post() @Roles('super_admin', 'hr_manager')
  create(@CurrentUser() u: JwtPayload, @Body() dto: CreateJobTitleDto) { return this.svc.create(u.tenantId, dto) }

  @Put(':id') @Roles('super_admin', 'hr_manager')
  update(@CurrentUser() u: JwtPayload, @Param('id') id: string, @Body() dto: UpdateJobTitleDto) { return this.svc.update(u.tenantId, id, dto) }

  @Delete(':id') @Roles('super_admin', 'hr_manager')
  remove(@CurrentUser() u: JwtPayload, @Param('id') id: string) { return this.svc.remove(u.tenantId, id) }
}
