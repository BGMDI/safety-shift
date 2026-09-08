import { strict as assert } from 'node:assert'
import { Workbook } from 'exceljs'
import { employeeTemplate, parseEmployees } from './employee-import'

async function run() {
  const branch = '5a14b602-0c63-4db6-9fc6-b3a8df326004'
  const workbook = new Workbook()
  await workbook.xlsx.load(await employeeTemplate())
  const sheet = workbook.worksheets[0]
  const complete = ['أحمد', 'محمد', 'عبدالله', 'العلي', '2026-09-08', 'ahmad@example.com', '0501234567', '0012345678', 'سعودي', '1990-01-01', '2030-01-01', 'بكالوريوس', 'إدارة أعمال', 'SA0380000000608010167519']
  sheet.addRow(complete)
  sheet.addRow(complete.map((value, index) => index === 4 ? new Date('2026-09-01T00:00:00Z') : value))
  sheet.addRow(['', '', '', '', 'not-a-date'])
  sheet.addRow([{ formula: '1+1', result: 2 }, '', '', '', '2026-09-08'])
  const rows = await parseEmployees(Buffer.from(await workbook.xlsx.writeBuffer()), branch)
  assert.equal(rows.length, 4)
  assert.deepEqual(rows[0].errors, [])
  assert.equal(rows[0].dto.phone, '0501234567')
  assert.equal(rows[0].dto.nationalId, '0012345678')
  assert.equal(rows[0].dto.branchId, branch)
  assert.deepEqual(rows[1].errors, [])
  assert.equal(rows[1].dto.hireDate, '2026-09-01')
  assert.ok(rows[2].errors.length >= 2)
  assert.ok(rows[3].errors.some(e => e.includes('معادلات')))
  for (let column = 1; column <= complete.length; column++) {
    const saved = sheet.getCell(2, column).value
    sheet.getCell(2, column).value = '   '
    const missing = await parseEmployees(Buffer.from(await workbook.xlsx.writeBuffer()), branch)
    assert.ok(missing[0].errors.some(e => e.includes('حقل إلزامي')), `Column ${column} must be required`)
    sheet.getCell(2, column).value = saved
  }
  await assert.rejects(parseEmployees(Buffer.from('not an xlsx'), branch))
  const empty = Buffer.from(await employeeTemplate())
  await assert.rejects(parseEmployees(empty, branch))
  sheet.getCell('B1').value = 'الاسم الأول'
  await assert.rejects(parseEmployees(Buffer.from(await workbook.xlsx.writeBuffer()), branch))
  sheet.getCell('B1').value = 'اسم الأب'
  sheet.getCell('A502').value = 'تجاوز الحد'
  await assert.rejects(parseEmployees(Buffer.from(await workbook.xlsx.writeBuffer()), branch))
  console.log('Employee Excel import checks passed')
}

run().catch(error => { console.error(error); process.exitCode = 1 })
