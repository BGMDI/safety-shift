import {
  Controller, Get, Post, Put, Delete,
  Body, Param, Query, UseGuards,
  UseInterceptors, UploadedFile, BadRequestException, StreamableFile,
} from '@nestjs/common'
import { FileInterceptor } from '@nestjs/platform-express'
import { diskStorage, memoryStorage } from 'multer'
import { employeeTemplate } from './employee-import'
import { extname, join } from 'path'
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger'
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard'
import { RolesGuard } from '../../common/guards/roles.guard'
import { CurrentUser } from '../../common/decorators/current-user.decorator'
import { Roles } from '../../common/decorators/roles.decorator'
import { AnyEmployee } from '../../common/decorators/any-employee.decorator'
import { assertSelfOrManager } from '../../common/auth.util'
import { EmployeesService } from './employees.service'
import { CreateEmployeeDto } from './dto/create-employee.dto'
import { UpdateEmployeeDto } from './dto/update-employee.dto'
import { JwtPayload } from '@shift-saas/types'

const photoStorage = diskStorage({
  destination: join(process.cwd(), 'uploads', 'employees'),
  filename: (_req, file, cb) => {
    const unique = Date.now() + '-' + Math.round(Math.random() * 1e9)
    cb(null, unique + extname(file.originalname))
  },
})

@ApiTags('Employees')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('employees')
export class EmployeesController {
  constructor(private employeesService: EmployeesService) {}

  @Get('import-template')
  @Roles('super_admin', 'hr_manager')
  async importTemplate() {
    return new StreamableFile(Buffer.from(await employeeTemplate()), {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      disposition: 'attachment; filename="employees-template.xlsx"',
    })
  }

  @Post('import')
  @Roles('super_admin', 'hr_manager')
  @UseInterceptors(FileInterceptor('file', {
    storage: memoryStorage(), limits: { fileSize: 2 * 1024 * 1024, files: 1 },
    fileFilter: (_req, file, cb) => cb(extname(file.originalname).toLowerCase() === '.xlsx' ? null : new BadRequestException('يُسمح بملفات XLSX فقط'), extname(file.originalname).toLowerCase() === '.xlsx'),
  }))
  importEmployees(@CurrentUser() user: JwtPayload, @Body('branchId') branchId: string, @UploadedFile() file: Express.Multer.File) {
    if (!file) throw new BadRequestException('اختر ملف Excel')
    return this.employeesService.importExcel(user.tenantId, branchId, file.buffer)
  }

  @Get()
  @Roles('super_admin', 'hr_manager', 'supervisor')
  findAll(
    @CurrentUser() user: JwtPayload,
    @Query('search') search?: string,
    @Query('status') status?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.employeesService.findAll(user.tenantId, search, status, page ? +page : 1, limit ? +limit : 20)
  }

  @Get('stats')
  @Roles('super_admin', 'hr_manager', 'supervisor')
  getStats(@CurrentUser() user: JwtPayload) {
    return this.employeesService.getStats(user.tenantId)
  }

  @Get('next-code')
  @Roles('super_admin', 'hr_manager')
  async getNextCode(@CurrentUser() user: JwtPayload, @Query('prefix') prefix: string) {
    const code = await this.employeesService.getNextCode(user.tenantId, prefix || 'EMP')
    return { code }
  }

  /** ملف الموظف — للإدارة أو الموظف نفسه فقط */
  @Get(':id') @AnyEmployee()
  findOne(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    assertSelfOrManager(user, id)
    return this.employeesService.findOne(user.tenantId, id)
  }

  @Post()
  @Roles('super_admin', 'hr_manager')
  create(@CurrentUser() user: JwtPayload, @Body() dto: CreateEmployeeDto) {
    return this.employeesService.create(user.tenantId, dto)
  }

  @Put(':id')
  @Roles('super_admin', 'hr_manager')
  update(@CurrentUser() user: JwtPayload, @Param('id') id: string, @Body() dto: UpdateEmployeeDto) {
    return this.employeesService.update(user.tenantId, id, dto)
  }

  /** رفع صورة الموظف */
  @Post(':id/photo')
  @Roles('super_admin', 'hr_manager')
  @UseInterceptors(FileInterceptor('photo', {
    storage: photoStorage,
    fileFilter: (_req, file, cb) => {
      if (!file.mimetype.match(/\/(jpg|jpeg|png|webp|gif)$/i)) {
        return cb(new BadRequestException('يُسمح فقط بصور JPG/PNG/WebP'), false)
      }
      cb(null, true)
    },
    limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
  }))
  async uploadPhoto(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) throw new BadRequestException('لم يتم رفع صورة')
    const url = `/uploads/employees/${file.filename}`
    return this.employeesService.updatePhoto(user.tenantId, id, url)
  }

  @Delete(':id')
  @Roles('super_admin', 'hr_manager')
  remove(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.employeesService.remove(user.tenantId, id)
  }
}
