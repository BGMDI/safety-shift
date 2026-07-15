import { Injectable, NotFoundException, ConflictException } from '@nestjs/common'
import * as bcrypt from 'bcrypt'
import { prisma } from '@shift-saas/database'
import { CreateEmployeeDto } from './dto/create-employee.dto'
import { UpdateEmployeeDto } from './dto/update-employee.dto'

/** يجمع أجزاء الاسم ويزيل الفراغات الزائدة */
function buildFullName(parts: { firstName?: string; fatherName?: string; grandfatherName?: string; familyName?: string }): string {
  return [parts.firstName, parts.fatherName, parts.grandfatherName, parts.familyName]
    .map(p => p?.trim())
    .filter(Boolean)
    .join(' ')
}

@Injectable()
export class EmployeesService {
  private readonly select = {
    id: true,
    employeeCode: true,
    fullName: true,
    firstName: true,
    fatherName: true,
    grandfatherName: true,
    familyName: true,
    photo: true,
    email: true,
    phone: true,
    nationalId: true,
    idExpiryDate: true,
    nationality: true,
    birthDate: true,
    qualification: true,
    specialization: true,
    iban: true,
    hireDate: true,
    status: true,
    createdAt: true,
    branch: { select: { id: true, name: true } },
    department: { select: { id: true, name: true } },
    jobTitle: { select: { id: true, name: true } },
    employeeRoles: { select: { role: { select: { name: true } } } },
  }

  async findAll(tenantId: string, search?: string, status?: string, page = 1, limit = 20) {
    const where: any = { tenantId }

    if (search) {
      where.OR = [
        { fullName:         { contains: search, mode: 'insensitive' } },
        { firstName:        { contains: search, mode: 'insensitive' } },
        { fatherName:       { contains: search, mode: 'insensitive' } },
        { grandfatherName:  { contains: search, mode: 'insensitive' } },
        { familyName:       { contains: search, mode: 'insensitive' } },
        { employeeCode:     { contains: search, mode: 'insensitive' } },
        { email:            { contains: search, mode: 'insensitive' } },
        { nationalId:       { contains: search, mode: 'insensitive' } },
        { phone:            { contains: search, mode: 'insensitive' } },
      ]
    }

    if (status) where.status = status

    const [data, total] = await Promise.all([
      prisma.employee.findMany({
        where,
        select: this.select,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.employee.count({ where }),
    ])

    return { data, total, page, limit, totalPages: Math.ceil(total / limit) }
  }

  async findOne(tenantId: string, id: string) {
    const employee = await prisma.employee.findFirst({
      where: { id, tenantId },
      select: this.select,
    })
    if (!employee) throw new NotFoundException('الموظف غير موجود')
    return employee
  }

  private async generateCode(tenantId: string, prefix: string): Promise<string> {
    const upper = prefix.toUpperCase().trim()
    // أحضر آخر كود يبدأ بنفس البادئة
    const last = await prisma.employee.findFirst({
      where: {
        tenantId,
        employeeCode: { startsWith: upper },
      },
      orderBy: { employeeCode: 'desc' },
      select: { employeeCode: true },
    })
    const lastNum = last
      ? parseInt(last.employeeCode.replace(upper, ''), 10) || 0
      : 0
    const next = String(lastNum + 1).padStart(4, '0')
    return `${upper}${next}`
  }

  async getNextCode(tenantId: string, prefix: string): Promise<string> {
    return this.generateCode(tenantId, prefix || 'EMP')
  }

  async create(tenantId: string, dto: CreateEmployeeDto) {
    const prefix = dto.codePrefix || 'EMP'
    const code = await this.generateCode(tenantId, prefix)

    const existing = await prisma.employee.findFirst({
      where: { tenantId, employeeCode: code },
    })
    if (existing) throw new ConflictException('كود الموظف مستخدم مسبقاً')

    const passwordHash = dto.password ? await bcrypt.hash(dto.password, 12) : undefined

    // احسب الاسم المركب إذا أُرسلت الأجزاء، وإلا استخدم fullName مباشرة
    const nameParts = { firstName: dto.firstName, fatherName: dto.fatherName, grandfatherName: dto.grandfatherName, familyName: dto.familyName }
    const hasNameParts = Object.values(nameParts).some(v => v?.trim())
    const fullName = hasNameParts ? buildFullName(nameParts) : (dto.fullName ?? '')
    if (!fullName) throw new Error('يجب إدخال اسم الموظف')

    return prisma.employee.create({
      data: {
        tenantId,
        branchId: dto.branchId,
        departmentId: dto.departmentId,
        jobTitleId: dto.jobTitleId,
        employeeCode: code,
        fullName,
        firstName: dto.firstName,
        fatherName: dto.fatherName,
        grandfatherName: dto.grandfatherName,
        familyName: dto.familyName,
        nationalId: dto.nationalId,
        idExpiryDate: dto.idExpiryDate ? new Date(dto.idExpiryDate) : undefined,
        nationality: dto.nationality,
        birthDate: (dto as any).birthDate ? new Date((dto as any).birthDate) : undefined,
        qualification: (dto as any).qualification,
        specialization: (dto as any).specialization,
        iban: dto.iban,
        email: dto.email,
        phone: dto.phone,
        hireDate: new Date(dto.hireDate),
        passwordHash,
      },
      select: this.select,
    })
  }

  async update(tenantId: string, id: string, dto: UpdateEmployeeDto) {
    await this.findOne(tenantId, id)
    const { password, hireDate, idExpiryDate, birthDate, firstName, fatherName, grandfatherName, familyName, ...rest } = dto as any
    const data: any = { ...rest }
    if (hireDate)      data.hireDate      = new Date(hireDate)
    if (idExpiryDate)  data.idExpiryDate  = new Date(idExpiryDate)
    if (birthDate)     data.birthDate     = new Date(birthDate)
    if (password)      data.passwordHash  = await bcrypt.hash(password, 12)

    // أجزاء الاسم — إذا أُرسل أي جزء أعد بناء الاسم الكامل
    const nameParts = { firstName, fatherName, grandfatherName, familyName }
    const hasNameParts = Object.values(nameParts).some(v => v !== undefined)
    if (hasNameParts) {
      // اجلب القيم الحالية لدمجها مع الجديدة
      const current = await prisma.employee.findUnique({ where: { id }, select: { firstName: true, fatherName: true, grandfatherName: true, familyName: true } })
      const merged = {
        firstName:       firstName       !== undefined ? firstName       : current?.firstName,
        fatherName:      fatherName      !== undefined ? fatherName      : current?.fatherName,
        grandfatherName: grandfatherName !== undefined ? grandfatherName : current?.grandfatherName,
        familyName:      familyName      !== undefined ? familyName      : current?.familyName,
      }
      data.firstName       = merged.firstName       ?? null
      data.fatherName      = merged.fatherName      ?? null
      data.grandfatherName = merged.grandfatherName ?? null
      data.familyName      = merged.familyName      ?? null
      const computed = buildFullName(merged)
      if (computed) data.fullName = computed
    }

    Object.keys(data).forEach(k => { if (data[k] === '' || data[k] === undefined) delete data[k] })
    return prisma.employee.update({ where: { id }, data, select: this.select })
  }

  async updatePhoto(tenantId: string, id: string, photoUrl: string) {
    await this.findOne(tenantId, id)
    return prisma.employee.update({ where: { id }, data: { photo: photoUrl }, select: this.select })
  }

  async remove(tenantId: string, id: string) {
    await this.findOne(tenantId, id)
    await prisma.employee.update({
      where: { id },
      data: { status: 'TERMINATED' },
    })
    return { message: 'تم إنهاء خدمة الموظف' }
  }

  async getStats(tenantId: string) {
    const [total, active, suspended, terminated] = await Promise.all([
      prisma.employee.count({ where: { tenantId } }),
      prisma.employee.count({ where: { tenantId, status: 'ACTIVE' } }),
      prisma.employee.count({ where: { tenantId, status: 'SUSPENDED' } }),
      prisma.employee.count({ where: { tenantId, status: 'TERMINATED' } }),
    ])
    return { total, active, suspended, terminated }
  }
}
