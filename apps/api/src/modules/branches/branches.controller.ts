import { BadRequestException, Controller, Get, Post, Put, Delete, Body, Param, StreamableFile, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common'
import { FileInterceptor } from '@nestjs/platform-express'
import { memoryStorage } from 'multer'
import { extname } from 'path'
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger'
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard'
import { RolesGuard } from '../../common/guards/roles.guard'
import { Roles } from '../../common/decorators/roles.decorator'
import { CurrentUser } from '../../common/decorators/current-user.decorator'
import { BranchesService } from './branches.service'
import { JwtPayload } from '@shift-saas/types'
import { structureTemplate } from './structure-import'

@ApiTags('Branches')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('branches')
export class BranchesController {
  constructor(private svc: BranchesService) {}

  @Get('structure-import-template') @Roles('super_admin', 'hr_manager')
  async structureImportTemplate() {
    return new StreamableFile(Buffer.from(await structureTemplate()), {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      disposition: 'attachment; filename="organization-structure-template.xlsx"',
    })
  }

  @Post('structure-import') @Roles('super_admin', 'hr_manager')
  @UseInterceptors(FileInterceptor('file', {
    storage: memoryStorage(), limits: { fileSize: 2 * 1024 * 1024, files: 1 },
    fileFilter: (_req, file, cb) => {
      const allowed = extname(file.originalname).toLowerCase() === '.xlsx'
      cb(allowed ? null : new BadRequestException('يُسمح بملفات XLSX فقط'), allowed)
    },
  }))
  importStructure(@CurrentUser() u: JwtPayload, @UploadedFile() file: Express.Multer.File) {
    if (!file) throw new BadRequestException('اختر ملف Excel')
    return this.svc.importStructure(u.tenantId, file.buffer)
  }

  @Get() @Roles('super_admin', 'hr_manager', 'supervisor')
  findAll(@CurrentUser() u: JwtPayload) { return this.svc.findAll(u.tenantId) }

  @Post() @Roles('super_admin', 'hr_manager')
  create(@CurrentUser() u: JwtPayload, @Body() body: any) { return this.svc.create(u.tenantId, body) }

  @Put(':id') @Roles('super_admin', 'hr_manager')
  update(@CurrentUser() u: JwtPayload, @Param('id') id: string, @Body() body: any) { return this.svc.update(u.tenantId, id, body) }

  @Delete(':id') @Roles('super_admin', 'hr_manager')
  remove(@CurrentUser() u: JwtPayload, @Param('id') id: string) { return this.svc.remove(u.tenantId, id) }
}
