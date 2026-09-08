import { BadRequestException } from '@nestjs/common'

export const SAUDI_BANKS = [
  { id: 'SNB', name: 'البنك الأهلي السعودي', sarie: 'NCBK', ibanCodes: ['10', '40'] },
  { id: 'ALRAJHI', name: 'مصرف الراجحي', sarie: 'RJHI', ibanCodes: ['80'] },
  { id: 'RIYAD', name: 'بنك الرياض', sarie: 'RIBL', ibanCodes: ['20'] },
  { id: 'SAB', name: 'البنك السعودي الأول', sarie: 'SABB', ibanCodes: ['45', '50'] },
  { id: 'ANB', name: 'البنك العربي الوطني', sarie: 'ARNB', ibanCodes: ['30'] },
  { id: 'ALINMA', name: 'مصرف الإنماء', sarie: 'INMA', ibanCodes: ['05'] },
  { id: 'BSF', name: 'البنك السعودي الفرنسي', sarie: 'BSFR', ibanCodes: ['55'] },
  { id: 'SAIB', name: 'البنك السعودي للاستثمار', sarie: 'SIBC', ibanCodes: ['65'] },
  { id: 'ALJAZIRA', name: 'بنك الجزيرة', sarie: 'BJAZ', ibanCodes: ['60'] },
  { id: 'ALBILAD', name: 'بنك البلاد', sarie: 'ALBI', ibanCodes: ['15'] },
  { id: 'GIB', name: 'بنك الخليج الدولي - السعودية', sarie: 'GULF', ibanCodes: ['90'] },
] as const

const BENEFICIARY_BANKS: Record<string, string> = Object.fromEntries(
  SAUDI_BANKS.flatMap(bank => bank.ibanCodes.map(code => [code, bank.sarie])),
)

export interface BankExportInput {
  bankId: string
  employerIban: string
  bankCustomerId: string
  molEstablishmentId: string
  valueDate: string
}

export interface PayrollExportDetail {
  netSalary: number
  baseSalary: number
  totalAllowances: number
  housingAllowance?: number
  otherEarnings?: number
  overtimeAmount?: number
  totalDeductions: number
  absenceDeduction: number
  lateDeduction: number
  employee: { fullName: string; nationalId: string | null; iban: string | null }
}

export function normalizeSaudiIban(value: string) { return value.replace(/\s+/g, '').toUpperCase() }

export function isValidSaudiIban(value: string) {
  const iban = normalizeSaudiIban(value)
  if (!/^SA\d{22}$/.test(iban)) return false
  const rearranged = `${iban.slice(4)}${iban.slice(0, 4)}`
  const digits = rearranged.replace(/[A-Z]/g, letter => String(letter.charCodeAt(0) - 55))
  let remainder = 0
  for (const digit of digits) remainder = (remainder * 10 + Number(digit)) % 97
  return remainder === 1
}

function amount(value: number) { return value.toFixed(2).replace('.', ',') }
function date8(value: string) { return value.replace(/-/g, '') }
function safeText(value: string, max = 140) { return value.replace(/[\t\r\n]/g, ' ').trim().slice(0, max) }

export function generateWpsFile(input: BankExportInput, details: PayrollExportDetail[], run: { month: number; year: number }) {
  const bank = SAUDI_BANKS.find(item => item.id === input.bankId)
  if (!bank) throw new BadRequestException('البنك المحدد غير مدعوم')
  const employerIban = normalizeSaudiIban(input.employerIban)
  if (!isValidSaudiIban(employerIban)) throw new BadRequestException('آيبان حساب المنشأة غير صحيح')
  if (!bank.ibanCodes.includes(employerIban.slice(4, 6) as never)) throw new BadRequestException('آيبان حساب المنشأة لا يتبع البنك المحدد')
  if (!/^\d{1,10}$/.test(input.bankCustomerId)) throw new BadRequestException('رقم المنشأة لدى البنك يجب أن يكون من 1 إلى 10 أرقام')
  if (!/^\d{2,15}$/.test(input.molEstablishmentId)) throw new BadRequestException('رقم المنشأة بوزارة الموارد يجب أن يكون من 2 إلى 15 رقماً')
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.valueDate) || Number.isNaN(Date.parse(input.valueDate))) throw new BadRequestException('تاريخ التنفيذ غير صحيح')
  if (!details.length) throw new BadRequestException('المسير لا يحتوي على موظفين')

  const errors: string[] = []
  const rows = details.map((detail, index) => {
    const iban = normalizeSaudiIban(detail.employee.iban ?? '')
    const nationalId = (detail.employee.nationalId ?? '').trim()
    const destinationBank = BENEFICIARY_BANKS[iban.slice(4, 6)]
    if (!isValidSaudiIban(iban)) errors.push(`${detail.employee.fullName}: آيبان سعودي مفقود أو غير صحيح`)
    else if (!destinationBank) errors.push(`${detail.employee.fullName}: بنك الآيبان غير مدعوم`)
    if (!/^[12]\d{9}$/.test(nationalId)) errors.push(`${detail.employee.fullName}: رقم الهوية أو الإقامة يجب أن يكون 10 أرقام`)
    const deductions = Number(detail.totalDeductions) + Number(detail.absenceDeduction) + Number(detail.lateDeduction)
    const storedHousing = Number(detail.housingAllowance ?? 0)
    const storedOther = Number(detail.otherEarnings ?? 0)
    const hasBreakdown = Math.abs(storedHousing + storedOther - Number(detail.totalAllowances)) <= 0.01
    const housing = hasBreakdown ? storedHousing : 0
    const otherEarnings = (hasBreakdown ? storedOther : Number(detail.totalAllowances)) + Number(detail.overtimeAmount ?? 0)
    const calculatedNet = Number(detail.baseSalary) + housing + otherEarnings - deductions
    if (Math.abs(calculatedNet - Number(detail.netSalary)) > 0.01) errors.push(`${detail.employee.fullName}: مكونات الراتب لا تساوي صافي الراتب`)
    return [
      amount(Number(detail.netSalary)), iban, safeText(detail.employee.fullName), destinationBank ?? '',
      `SALARY ${run.year}${String(run.month).padStart(2, '0')}`, '', amount(Number(detail.baseSalary)),
      amount(housing), amount(otherEarnings), amount(deductions), nationalId, '', '', '',
    ].join('\t')
  })
  if (errors.length) throw new BadRequestException({ message: 'تعذر إنشاء الملف قبل تصحيح بيانات الموظفين', errors })

  const total = details.reduce((sum, detail) => sum + Number(detail.netSalary), 0)
  const reference = `WRD${run.year}${String(run.month).padStart(2, '0')}${Date.now().toString().slice(-6)}`.slice(0, 16)
  const header = [bank.sarie, input.bankCustomerId, employerIban, 'SAR', date8(input.valueDate), amount(total), date8(input.valueDate), reference, '', input.molEstablishmentId].join('\t')
  return {
    buffer: Buffer.from(`\uFEFF${header}\r\n${rows.join('\r\n')}\r\n-`, 'utf8'),
    filename: `WPS_${bank.sarie}_${run.year}${String(run.month).padStart(2, '0')}_${reference}.txt`,
    bank,
  }
}
