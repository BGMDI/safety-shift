import { BadRequestException } from '@nestjs/common'
import { Workbook } from 'exceljs'

export interface StructureImportRow {
  row: number
  branchName: string
  location: string
  departmentName: string
  parentDepartmentName: string
  errors: string[]
}

const HEADERS = ['اسم الفرع', 'موقع الفرع / المدينة', 'اسم القسم', 'القسم الرئيسي (اختياري)'] as const

export async function structureTemplate() {
  const workbook = new Workbook()
  workbook.creator = 'نظام وردية'
  const sheet = workbook.addWorksheet('الهيكل التنظيمي', {
    views: [{ rightToLeft: true, state: 'frozen', ySplit: 1 }],
    properties: { tabColor: { argb: 'FF1E90FF' } },
  })
  sheet.columns = [
    { header: HEADERS[0], key: 'branchName', width: 28 },
    { header: HEADERS[1], key: 'location', width: 28 },
    { header: HEADERS[2], key: 'departmentName', width: 30 },
    { header: HEADERS[3], key: 'parentDepartmentName', width: 32 },
  ]
  sheet.autoFilter = 'A1:D1'
  sheet.getRow(1).height = 28
  sheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 12 }
  sheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF011F2A' } }
  sheet.getRow(1).alignment = { vertical: 'middle', horizontal: 'center' }
  for (let row = 2; row <= 501; row++) {
    sheet.getRow(row).alignment = { vertical: 'middle', horizontal: 'right' }
    sheet.getRow(row).height = 22
  }
  sheet.getCell('A1').note = 'إلزامي. كرر اسم الفرع في كل صف قسم تابع له. ويمكن إضافة فرع بلا أقسام بترك اسم القسم فارغاً.'
  sheet.getCell('B1').note = 'إلزامي لكل صف.'
  sheet.getCell('C1').note = 'اتركه فارغاً عندما تريد إضافة الفرع فقط.'
  sheet.getCell('D1').note = 'اختياري. يجب أن يكون القسم الرئيسي في الفرع نفسه، داخل الملف أو موجوداً مسبقاً.'
  return workbook.xlsx.writeBuffer()
}

function plainText(cell: any, label: string, errors: string[]) {
  if (cell.value === null || cell.text.trim() === '') return ''
  if (typeof cell.value === 'object') {
    errors.push(`${label}: استخدم نصاً مباشراً دون معادلات أو روابط`)
    return ''
  }
  const value = cell.text.trim()
  if (value.length > 150) errors.push(`${label}: الحد الأقصى 150 حرفاً`)
  return value
}

export async function parseStructure(buffer: Buffer): Promise<StructureImportRow[]> {
  const workbook = new Workbook()
  try { await workbook.xlsx.load(buffer as any) } catch { throw new BadRequestException('ملف Excel غير صالح؛ استخدم قالب XLSX') }
  const sheet = workbook.getWorksheet('الهيكل التنظيمي') ?? workbook.worksheets[0]
  if (!sheet || sheet.rowCount < 2) throw new BadRequestException('الملف لا يحتوي على فروع أو أقسام')
  if (sheet.rowCount > 501 || sheet.columnCount > 12) throw new BadRequestException('الحد الأقصى 500 صف و12 عموداً')

  const headers = new Map<string, number>()
  sheet.getRow(1).eachCell((cell, index) => {
    const header = cell.text.trim()
    if (headers.has(header)) throw new BadRequestException(`عنوان عمود مكرر: ${header}`)
    headers.set(header, index)
  })
  for (const header of HEADERS) {
    if (!headers.has(header)) throw new BadRequestException(`العمود المطلوب غير موجود: ${header}`)
  }

  const rows: StructureImportRow[] = []
  for (let rowNumber = 2; rowNumber <= sheet.rowCount; rowNumber++) {
    const row = sheet.getRow(rowNumber)
    if (!row.hasValues) continue
    const errors: string[] = []
    const value = (header: typeof HEADERS[number]) => plainText(row.getCell(headers.get(header)!), header, errors)
    const branchName = value(HEADERS[0])
    const location = value(HEADERS[1])
    const departmentName = value(HEADERS[2])
    const parentDepartmentName = value(HEADERS[3])
    if (!errors.length && !branchName && !location && !departmentName && !parentDepartmentName) continue
    if (!branchName) errors.push('اسم الفرع: حقل إلزامي')
    if (!location) errors.push('موقع الفرع / المدينة: حقل إلزامي')
    if (parentDepartmentName && !departmentName) errors.push('لا يمكن تحديد قسم رئيسي دون اسم القسم')
    if (departmentName && parentDepartmentName && departmentName.localeCompare(parentDepartmentName, 'ar', { sensitivity: 'base' }) === 0) {
      errors.push('لا يمكن أن يكون القسم رئيسياً لنفسه')
    }
    rows.push({ row: rowNumber, branchName, location, departmentName, parentDepartmentName, errors })
  }
  if (!rows.length) throw new BadRequestException('الملف لا يحتوي على فروع أو أقسام')
  return rows
}
