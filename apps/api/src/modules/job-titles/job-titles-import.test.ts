import { strict as assert } from 'node:assert'
import { Workbook } from 'exceljs'
import { jobTitlesTemplate, parseJobTitles } from './job-titles-import'

async function run() {
  const template = await jobTitlesTemplate()
  const workbook = new Workbook()
  await workbook.xlsx.load(template)
  assert.equal(workbook.worksheets.length, 1)
  assert.equal(workbook.worksheets[0].name, 'المسميات الوظيفية')
  const sheet = workbook.worksheets[0]
  assert.equal(sheet.getCell('J2').dataValidation.type, 'list')

  sheet.getRow(2).values = ['حارس أمن', 5, 4500, 250, 1000, 500, 0, 9.75, 'بدل خطر:300|بدل موقع:200', 'نعم']
  sheet.getRow(3).values = ['محاسب', 3, 6000, 500, 1500, 600, 200, 9.75, '', 'لا']
  sheet.getRow(4).values = ['', '', '', '', '', '', '', '', '', '']
  sheet.getRow(5).values = ['مدير فرع', 0, -1, -2, 0, 0, 0, 101, 'بدل غير صالح', 'ربما']
  sheet.getRow(6).values = [{ formula: '1+1', result: 2 }, 1, 5000, 0, 0, 0, 0, 0, '', 'نعم']

  const rows = await parseJobTitles(Buffer.from(await workbook.xlsx.writeBuffer()))
  assert.equal(rows.length, 4)
  assert.deepEqual(rows[0].errors, [])
  assert.equal(rows[0].isShiftEligible, true)
  assert.equal(rows[0].customAllowances.length, 2)
  assert.equal(rows[1].isShiftEligible, false)
  assert.ok(rows[2].errors.some(error => error.includes('عدد الدرجات')))
  assert.ok(rows[2].errors.some(error => error.includes('صفراً أو أكبر')))
  assert.ok(rows[2].errors.some(error => error.includes('نعم أو لا')))
  assert.ok(rows[3].errors.some(error => error.includes('معادلات')))

  await assert.rejects(parseJobTitles(Buffer.from('invalid')))
  await assert.rejects(parseJobTitles(Buffer.from(template)))
  console.log('Job titles Excel checks passed')
}

run().catch(error => { console.error(error); process.exitCode = 1 })
