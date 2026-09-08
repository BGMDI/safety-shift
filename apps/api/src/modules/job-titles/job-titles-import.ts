import { BadRequestException } from '@nestjs/common'
import { Workbook } from 'exceljs'

export interface JobTitleImportRow {
  row: number
  name: string
  grade: string
  baseSalary: number | null
  isShiftEligible: boolean | null
  errors: string[]
}

const HEADERS = ['المسمى الوظيفي', 'الدرجة الوظيفية', 'الراتب الأساسي', 'يدخل في جدولة الشفتات'] as const

export async function jobTitlesTemplate() {
  const workbook = new Workbook()
  workbook.creator = 'نظام وردية'
  const sheet = workbook.addWorksheet('المسميات الوظيفية', {
    views: [{ rightToLeft: true, state: 'frozen', ySplit: 1 }],
    properties: { tabColor: { argb: 'FF1E90FF' } },
  })
  sheet.columns = [
    { header: HEADERS[0], key: 'name', width: 32 },
    { header: HEADERS[1], key: 'grade', width: 24 },
    { header: HEADERS[2], key: 'baseSalary', width: 22 },
    { header: HEADERS[3], key: 'isShiftEligible', width: 30 },
  ]
  sheet.autoFilter = 'A1:D1'
  const header = sheet.getRow(1)
  header.height = 30
  header.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 12 }
  header.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF011F2A' } }
  header.alignment = { vertical: 'middle', horizontal: 'center' }
  for (let row = 2; row <= 501; row++) {
    sheet.getRow(row).height = 23
    sheet.getRow(row).alignment = { vertical: 'middle', horizontal: 'right' }
    sheet.getCell(`D${row}`).dataValidation = {
      type: 'list', allowBlank: false, formulae: ['"نعم,لا"'],
      showErrorMessage: true, errorTitle: 'قيمة غير صحيحة', error: 'اختر نعم أو لا.',
    }
  }
  sheet.getCell('A1').note = 'إلزامي. مثال: محاسب، حارس أمن، مدير فرع.'
  sheet.getCell('B1').note = 'إلزامي. مثال: A1 أو الدرجة الأولى.'
  sheet.getCell('C1').note = 'إلزامي. اكتب رقماً صفراً أو أكبر دون رمز العملة.'
  sheet.getCell('D1').note = 'إلزامي. القيم المقبولة: نعم أو لا.'
  sheet.getColumn(3).numFmt = '#,##0.00'
  return workbook.xlsx.writeBuffer()
}

function textValue(cell: any, label: string, errors: string[]) {
  if (cell.value === null || cell.text.trim() === '') return ''
  if (typeof cell.value === 'object') {
    errors.push(`${label}: استخدم قيمة مباشرة دون معادلات أو روابط`)
    return ''
  }
  const value = cell.text.trim()
  if (value.length > 150) errors.push(`${label}: الحد الأقصى 150 حرفاً`)
  return value
}

export async function parseJobTitles(buffer: Buffer): Promise<JobTitleImportRow[]> {
  const workbook = new Workbook()
  try { await workbook.xlsx.load(buffer as any) } catch { throw new BadRequestException('ملف Excel غير صالح؛ استخدم قالب XLSX') }
  const sheet = workbook.getWorksheet('المسميات الوظيفية') ?? workbook.worksheets[0]
  if (!sheet || sheet.rowCount < 2) throw new BadRequestException('الملف لا يحتوي على مسميات وظيفية')
  if (sheet.rowCount > 501 || sheet.columnCount > 12) throw new BadRequestException('الحد الأقصى 500 صف و12 عموداً')

  const headers = new Map<string, number>()
  sheet.getRow(1).eachCell((cell, index) => {
    const value = cell.text.trim()
    if (headers.has(value)) throw new BadRequestException(`عنوان عمود مكرر: ${value}`)
    headers.set(value, index)
  })
  for (const header of HEADERS) if (!headers.has(header)) throw new BadRequestException(`العمود المطلوب غير موجود: ${header}`)

  const rows: JobTitleImportRow[] = []
  for (let rowNumber = 2; rowNumber <= sheet.rowCount; rowNumber++) {
    const row = sheet.getRow(rowNumber)
    if (!row.hasValues) continue
    const errors: string[] = []
    const get = (header: typeof HEADERS[number]) => textValue(row.getCell(headers.get(header)!), header, errors)
    const name = get(HEADERS[0])
    const grade = get(HEADERS[1])
    const salaryText = get(HEADERS[2]).replace(/,/g, '')
    const shiftText = get(HEADERS[3]).toLocaleLowerCase('ar')
    if (!errors.length && !name && !grade && !salaryText && !shiftText) continue
    if (!name) errors.push('المسمى الوظيفي: حقل إلزامي')
    if (!grade) errors.push('الدرجة الوظيفية: حقل إلزامي')
    const baseSalary = salaryText === '' ? null : Number(salaryText)
    if (baseSalary === null) errors.push('الراتب الأساسي: حقل إلزامي')
    else if (!Number.isFinite(baseSalary) || baseSalary < 0) errors.push('الراتب الأساسي: يجب أن يكون رقماً صفراً أو أكبر')
    const yes = ['نعم', 'yes', 'true', '1'].includes(shiftText)
    const no = ['لا', 'no', 'false', '0'].includes(shiftText)
    if (!yes && !no) errors.push('جدولة الشفتات: اختر نعم أو لا')
    rows.push({ row: rowNumber, name, grade, baseSalary, isShiftEligible: yes ? true : no ? false : null, errors })
  }
  if (!rows.length) throw new BadRequestException('الملف لا يحتوي على مسميات وظيفية')
  return rows
}
