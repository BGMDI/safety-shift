import { strict as assert } from 'node:assert'
import { Workbook } from 'exceljs'
import { parseStructure, structureTemplate } from './structure-import'
import { BranchesService } from './branches.service'
import { prisma } from '@shift-saas/database'

async function run() {
  const template = await structureTemplate()
  const workbook = new Workbook()
  await workbook.xlsx.load(template)
  assert.equal(workbook.worksheets.length, 1)
  assert.equal(workbook.worksheets[0].name, 'الهيكل التنظيمي')
  const sheet = workbook.worksheets[0]
  sheet.getRow(2).values = ['الرياض', 'الرياض', 'الموارد البشرية', '']
  sheet.getRow(3).values = ['الرياض', 'الرياض', 'الرواتب', 'الموارد البشرية']
  sheet.getRow(4).values = ['جدة', 'جدة', '', '']
  sheet.getRow(5).values = ['', '', '', '']
  sheet.getRow(6).values = [{ formula: '1+1', result: 2 }, 'الدمام', '', '']
  sheet.getRow(7).values = ['الخبر', 'الخبر', 'الدعم', 'الدعم']

  const rows = await parseStructure(Buffer.from(await workbook.xlsx.writeBuffer()))
  assert.equal(rows.length, 5)
  assert.deepEqual(rows[0].errors, [])
  assert.equal(rows[1].parentDepartmentName, 'الموارد البشرية')
  assert.deepEqual(rows[2].errors, [])
  assert.ok(rows[3].errors.some(error => error.includes('معادلات')))
  assert.ok(rows[4].errors.some(error => error.includes('رئيسياً لنفسه')))

  await assert.rejects(parseStructure(Buffer.from('invalid')))
  await assert.rejects(parseStructure(Buffer.from(template)))
  sheet.getCell('B1').value = 'اسم الفرع'
  await assert.rejects(parseStructure(Buffer.from(await workbook.xlsx.writeBuffer())))

  const tenant = await prisma.tenant.create({ data: { name: `اختبار الهيكل ${Date.now()}` } })
  try {
    const importBook = new Workbook()
    await importBook.xlsx.load(await structureTemplate())
    const importSheet = importBook.worksheets[0]
    importSheet.getRow(2).values = ['الرياض', 'الرياض', 'الموارد البشرية', '']
    importSheet.getRow(3).values = ['الرياض', 'الرياض', 'الرواتب', 'الموارد البشرية']
    importSheet.getRow(4).values = ['الرياض', 'الرياض', 'الرواتب', 'الموارد البشرية']
    importSheet.getRow(5).values = ['جدة', 'جدة', '', '']
    importSheet.getRow(6).values = ['الخبر', 'الخبر', 'أ', 'ب']
    importSheet.getRow(7).values = ['الخبر', 'الخبر', 'ب', 'أ']
    importSheet.getRow(8).values = ['الدمام', 'الدمام', 'التشغيل', 'غير موجود']
    importSheet.getRow(9).values = ['الرياض', 'جدة', 'تقنية المعلومات', '']
    const result = await new BranchesService().importStructure(tenant.id, Buffer.from(await importBook.xlsx.writeBuffer()))
    assert.equal(result.addedBranches, 4)
    assert.equal(result.addedDepartments, 2)
    assert.equal(result.skipped, 1)
    assert.equal(result.rejected, 4)
    const branches = await prisma.branch.findMany({ where: { tenantId: tenant.id }, include: { departments: true } })
    assert.equal(branches.length, 4)
    const payroll = await prisma.department.findFirst({ where: { tenantId: tenant.id, name: 'الرواتب' }, include: { parent: true } })
    assert.equal(payroll?.parent?.name, 'الموارد البشرية')
  } finally {
    await prisma.department.deleteMany({ where: { tenantId: tenant.id } })
    await prisma.branch.deleteMany({ where: { tenantId: tenant.id } })
    await prisma.tenant.delete({ where: { id: tenant.id } })
    await prisma.$disconnect()
  }
  console.log('Organization structure Excel checks passed')
}

run().catch(error => { console.error(error); process.exitCode = 1 })
