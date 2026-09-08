import { strict as assert } from 'node:assert'
import { generateWpsFile, isValidSaudiIban, SAUDI_BANKS } from './payroll-export'

const input = {
  bankId: 'ALRAJHI', employerIban: 'SA0380000000608010167519', bankCustomerId: '1234567890',
  molEstablishmentId: '123456789012', valueDate: '2026-09-28',
}
const detail = {
  netSalary: 5500, baseSalary: 5000, totalAllowances: 750, housingAllowance: 500, otherEarnings: 250, totalDeductions: 200,
  absenceDeduction: 50, lateDeduction: 0,
  employee: { fullName: 'محمد أحمد علي', nationalId: '1234567890', iban: 'SA0380000000608010167519' },
}

function run() {
  assert.equal(SAUDI_BANKS.length, 11)
  assert.equal(isValidSaudiIban(input.employerIban), true)
  assert.equal(isValidSaudiIban('SA0000000000000000000000'), false)
  const file = generateWpsFile(input, [detail], { month: 9, year: 2026 })
  const text = file.buffer.toString('utf8').replace(/^\uFEFF/, '')
  const lines = text.split('\r\n')
  assert.equal(file.bank.sarie, 'RJHI')
  assert.ok(file.filename.startsWith('WPS_RJHI_202609_'))
  assert.equal(lines.length, 3)
  assert.equal(lines[0].split('\t')[0], 'RJHI')
  assert.equal(lines[0].split('\t')[5], '5500,00')
  assert.equal(lines[1].split('\t')[0], '5500,00')
  assert.equal(lines[1].split('\t')[3], 'RJHI')
  assert.equal(lines[1].split('\t')[7], '500,00')
  assert.equal(lines[1].split('\t')[8], '250,00')
  assert.equal(lines[1].split('\t')[10], '1234567890')
  assert.equal(lines[2], '-')
  assert.throws(() => generateWpsFile({ ...input, bankId: 'RIYAD' }, [detail], { month: 9, year: 2026 }))
  assert.throws(() => generateWpsFile(input, [{ ...detail, employee: { ...detail.employee, nationalId: '' } }], { month: 9, year: 2026 }))
  console.log('Payroll WPS export checks passed')
}

run()
