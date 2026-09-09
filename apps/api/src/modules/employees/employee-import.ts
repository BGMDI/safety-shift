import { BadRequestException } from '@nestjs/common'
import { Workbook } from 'exceljs'
import { validate } from 'class-validator'
import { CreateEmployeeDto } from './dto/create-employee.dto'

export const importColumns = [
  ['firstName', 'الاسم الأول'], ['fatherName', 'اسم الأب'], ['grandfatherName', 'اسم الجد'],
  ['familyName', 'اللقب'], ['hireDate', 'تاريخ التعيين'], ['email', 'البريد الإلكتروني'],
  ['phone', 'الجوال'], ['nationalId', 'رقم الهوية'], ['nationality', 'الجنسية'],
  ['birthDate', 'تاريخ الميلاد'], ['idExpiryDate', 'انتهاء الهوية'],
  ['qualification', 'المؤهل الدراسي'], ['specialization', 'التخصص'], ['iban', 'IBAN'],
  ['jobTitleName', 'المسمى الوظيفي'], ['jobGrade', 'الدرجة الوظيفية'],
] as const

export async function employeeTemplate() {
  const workbook = new Workbook()
  const sheet = workbook.addWorksheet('الموظفون', { views: [{ rightToLeft: true }] })
  sheet.columns = importColumns.map(([key, header]) => ({ key, header, width: 24, style: { numFmt: '@' } }))
  sheet.getRow(1).font = { bold: true }
  const help = workbook.addWorksheet('التعليمات')
  help.addRows([
    ['أدخل الموظفين في الورقة الأولى دون تغيير عناوين الأعمدة.'],
    ['جميع أعمدة القالب إلزامية لكل موظف. المسمى الوظيفي يجب أن يكون معرفاً مسبقاً في الهيكل التنظيمي.'],
    ['التواريخ ميلادية بصيغة YYYY-MM-DD، والجوال والهوية نصوص للمحافظة على الأصفار.'],
    ['الحد الأقصى 500 موظف. تتم إضافة الصفوف السليمة فقط دون تعديل الموظفين الموجودين.'],
    ['الرقم الوظيفي يولد تلقائياً. لا تُنشأ كلمات مرور من الملف؛ تُضبط من ملف الموظف.'],
  ])
  help.getColumn(1).width = 110
  return workbook.xlsx.writeBuffer()
}

export async function parseEmployees(buffer: Buffer, branchId: string) {
  const workbook = new Workbook()
  try { await workbook.xlsx.load(buffer as any) } catch { throw new BadRequestException('ملف Excel غير صالح؛ استخدم قالب XLSX') }
  const sheet = workbook.worksheets[0]
  if (!sheet || sheet.rowCount < 2) throw new BadRequestException('الملف لا يحتوي على موظفين')
  if (sheet.rowCount > 501 || sheet.columnCount > 30) throw new BadRequestException('الحد الأقصى 500 صف و30 عموداً')
  const headers = new Map<string, number>()
  sheet.getRow(1).eachCell((cell, index) => {
    const header = cell.text.trim()
    if (headers.has(header)) throw new BadRequestException('يوجد عنوان عمود مكرر')
    headers.set(header, index)
  })
  for (const [, header] of importColumns) {
    if (!headers.has(header)) throw new BadRequestException(`العمود المطلوب غير موجود: ${header}`)
  }
  const rows: { row: number; dto: CreateEmployeeDto; errors: string[] }[] = []
  for (let n = 2; n <= sheet.rowCount; n++) {
    const row = sheet.getRow(n)
    if (!row.hasValues) continue
    const dto = Object.assign(new CreateEmployeeDto(), { branchId })
    const errors: string[] = []
    for (const [key, header] of importColumns) {
      const index = headers.get(header)
      if (!index) continue
      const cell = row.getCell(index)
      if (cell.value === null || cell.text.trim() === '') {
        errors.push(`${header}: حقل إلزامي`)
        continue
      }
      if (typeof cell.value === 'object' && !(cell.value instanceof Date)) {
        errors.push(`${header}: استخدم قيمة نصية مباشرة دون معادلات أو روابط`)
        continue
      }
      const isDate = key.endsWith('Date')
      const serialDate = isDate && typeof cell.value === 'number' && cell.value > 0 && cell.value < 2958466
        ? new Date((cell.value - (workbook.properties.date1904 ? 24107 : 25569)) * 86400000)
        : null
      const dateValue = cell.value instanceof Date ? cell.value : serialDate
      const value = dateValue ? dateValue.toISOString().slice(0, 10) : cell.text.trim()
      if (value.length > 250) errors.push(`${header}: القيمة طويلة جداً`)
      if (isDate && (!/^\d{4}-\d{2}-\d{2}$/.test(value) || Number.isNaN(Date.parse(value)) || new Date(value).toISOString().slice(0, 10) !== value)) errors.push(`${header}: استخدم تاريخاً صحيحاً بصيغة YYYY-MM-DD`)
      ;(dto as any)[key] = key === 'jobGrade' ? Number(value) : value
    }
    if (!dto.firstName) errors.push('الاسم الأول مطلوب')
    // يتحقق مسار الاستيراد من اسم الوظيفة مقابل وظائف الشركة بعد قراءة الملف.
    // نضع معرّفاً صالحاً مؤقتاً حتى يكتمل تحقق بقية حقول DTO هنا.
    dto.jobTitleId = '00000000-0000-4000-8000-000000000000'
    const validation = await validate(dto)
    for (const issue of validation) {
      const label = importColumns.find(([key]) => key === issue.property)?.[1] ?? issue.property
      errors.push(`${label}: قيمة غير صحيحة أو مفقودة`)
    }
    rows.push({ row: n, dto, errors })
  }
  if (!rows.length) throw new BadRequestException('الملف لا يحتوي على موظفين')
  return rows
}
