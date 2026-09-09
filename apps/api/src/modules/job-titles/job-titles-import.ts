import { BadRequestException } from '@nestjs/common'
import { Workbook } from 'exceljs'

export interface JobTitleImportRow {
  row: number
  name: string
  grade: string
  baseSalary: number | null
  maxGrade: number | null
  gradeIncrement: number | null
  housingAllowance: number | null
  transportAllowance: number | null
  otherAllowance: number | null
  insuranceRate: number | null
  customAllowances: { name: string; amount: number }[]
  isShiftEligible: boolean | null
  errors: string[]
}

const HEADERS = ['المسمى الوظيفي', 'عدد الدرجات', 'راتب الدرجة الأولى', 'زيادة كل درجة', 'بدل السكن', 'بدل المواصلات', 'بدلات أخرى', 'نسبة استقطاع التأمينات', 'بدلات إضافية', 'يدخل في جدولة الشفتات'] as const

export async function jobTitlesTemplate() {
  const workbook = new Workbook()
  workbook.creator = 'نظام وردية'
  const sheet = workbook.addWorksheet('المسميات الوظيفية', {
    views: [{ rightToLeft: true, state: 'frozen', ySplit: 1 }],
    properties: { tabColor: { argb: 'FF1E90FF' } },
  })
  sheet.columns = [
    { header: HEADERS[0], key: 'name', width: 32 },
    { header: HEADERS[1], key: 'maxGrade', width: 18 },
    { header: HEADERS[2], key: 'baseSalary', width: 22 },
    { header: HEADERS[3], key: 'gradeIncrement', width: 20 },
    { header: HEADERS[4], key: 'housingAllowance', width: 18 },
    { header: HEADERS[5], key: 'transportAllowance', width: 20 },
    { header: HEADERS[6], key: 'otherAllowance', width: 18 },
    { header: HEADERS[7], key: 'insuranceRate', width: 26 },
    { header: HEADERS[8], key: 'customAllowances', width: 38 },
    { header: HEADERS[9], key: 'isShiftEligible', width: 30 },
  ]
  sheet.autoFilter = 'A1:J1'
  const header = sheet.getRow(1)
  header.height = 30
  header.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 12 }
  header.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF011F2A' } }
  header.alignment = { vertical: 'middle', horizontal: 'center' }
  for (let row = 2; row <= 501; row++) {
    sheet.getRow(row).height = 23
    sheet.getRow(row).alignment = { vertical: 'middle', horizontal: 'right' }
    sheet.getCell(`J${row}`).dataValidation = {
      type: 'list', allowBlank: false, formulae: ['"نعم,لا"'],
      showErrorMessage: true, errorTitle: 'قيمة غير صحيحة', error: 'اختر نعم أو لا.',
    }
  }
  sheet.getCell('A1').note = 'إلزامي. مثال: محاسب، حارس أمن، مدير فرع.'
  sheet.getCell('B1').note = 'إلزامي. عدد صحيح من 1 إلى 100.'
  sheet.getCell('C1').note = 'إلزامي. الراتب الأساسي للدرجة الأولى.'
  sheet.getCell('D1').note = 'إلزامي. مبلغ الزيادة الثابتة عند الانتقال لكل درجة.'
  sheet.getCell('H1').note = 'إلزامي. نسبة الخصم من الراتب الأساسي، مثال 9.75.'
  sheet.getCell('I1').note = 'اختياري. مثال: بدل خطر:500|بدل موقع:300'
  sheet.getCell('J1').note = 'إلزامي. القيم المقبولة: نعم أو لا.'
  for (const column of [3, 4, 5, 6, 7]) sheet.getColumn(column).numFmt = '#,##0.00'
  return workbook.xlsx.writeBuffer()
}

function textValue(cell: any, label: string, errors: string[]): string {
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
    const maxGradeText = get(HEADERS[1]).replace(/,/g, '')
    const salaryText = get(HEADERS[2]).replace(/,/g, '')
    const incrementText = get(HEADERS[3]).replace(/,/g, '')
    const housingText = get(HEADERS[4]).replace(/,/g, '')
    const transportText = get(HEADERS[5]).replace(/,/g, '')
    const otherText = get(HEADERS[6]).replace(/,/g, '')
    const insuranceText = get(HEADERS[7]).replace(/,/g, '')
    const customText = get(HEADERS[8])
    const shiftText = get(HEADERS[9]).toLocaleLowerCase('ar')
    if (!errors.length && !name && !maxGradeText && !salaryText && !shiftText) continue
    if (!name) errors.push('المسمى الوظيفي: حقل إلزامي')
    const maxGrade = Number(maxGradeText)
    if (!Number.isInteger(maxGrade) || maxGrade < 1 || maxGrade > 100) errors.push('عدد الدرجات: يجب أن يكون عدداً صحيحاً من 1 إلى 100')
    const baseSalary = salaryText === '' ? null : Number(salaryText)
    const amounts = [incrementText, housingText, transportText, otherText].map(value => value === '' ? null : Number(value))
    if (baseSalary === null || !Number.isFinite(baseSalary) || baseSalary < 0) errors.push('راتب الدرجة الأولى: أدخل رقماً صفراً أو أكبر')
    ;['زيادة كل درجة', 'بدل السكن', 'بدل المواصلات', 'بدلات أخرى'].forEach((label, index) => {
      if (amounts[index] === null || !Number.isFinite(amounts[index]) || amounts[index]! < 0) errors.push(`${label}: أدخل رقماً صفراً أو أكبر`)
    })
    const insuranceRate = insuranceText === '' ? null : Number(insuranceText)
    if (insuranceRate === null || !Number.isFinite(insuranceRate) || insuranceRate < 0 || insuranceRate > 100) errors.push('نسبة استقطاع التأمينات: أدخل نسبة من 0 إلى 100')
    const customAllowances: { name: string; amount: number }[] = []
    if (customText) for (const part of customText.split('|')) {
      const [allowanceName, amountText] = part.split(':').map(value => value?.trim())
      const amount = Number(amountText)
      if (!allowanceName || !Number.isFinite(amount) || amount < 0) errors.push(`بدلات إضافية: الصيغة الصحيحة اسم البدل:المبلغ، وافصل بينها بعلامة |`)
      else customAllowances.push({ name: allowanceName, amount })
    }
    const yes = ['نعم', 'yes', 'true', '1'].includes(shiftText)
    const no = ['لا', 'no', 'false', '0'].includes(shiftText)
    if (!yes && !no) errors.push('جدولة الشفتات: اختر نعم أو لا')
    rows.push({ row: rowNumber, name, grade: 'الدرجة 1', baseSalary, maxGrade, gradeIncrement: amounts[0], housingAllowance: amounts[1], transportAllowance: amounts[2], otherAllowance: amounts[3], insuranceRate, customAllowances, isShiftEligible: yes ? true : no ? false : null, errors })
  }
  if (!rows.length) throw new BadRequestException('الملف لا يحتوي على مسميات وظيفية')
  return rows
}
