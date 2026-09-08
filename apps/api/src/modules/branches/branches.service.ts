import { Injectable, NotFoundException, ConflictException } from '@nestjs/common'
import { prisma } from '@shift-saas/database'
import { parseStructure } from './structure-import'

@Injectable()
export class BranchesService {
  async importStructure(tenantId: string, buffer: Buffer) {
    const rows = await parseStructure(buffer)
    const errors: { row: number; message: string }[] = []
    const skipped: { row: number; message: string }[] = []
    const validRows = rows.filter(item => {
      if (!item.errors.length) return true
      errors.push({ row: item.row, message: item.errors.join('؛ ') })
      return false
    })
    const normalize = (value: string) => value.trim().toLocaleLowerCase('ar')

    const existingBranches = await prisma.branch.findMany({
      where: { tenantId }, select: { id: true, name: true, location: true },
    })
    const branchByName = new Map(existingBranches.map(branch => [normalize(branch.name), branch]))
    const branchLocationInFile = new Map<string, string>()
    for (const item of validRows) {
      const key = normalize(item.branchName)
      const knownLocation = branchLocationInFile.get(key)
      if (knownLocation && normalize(knownLocation) !== normalize(item.location)) {
        item.errors.push(`موقع الفرع لا يطابق الصفوف الأخرى للفرع نفسه (${knownLocation})`)
        errors.push({ row: item.row, message: item.errors.join('؛ ') })
      } else branchLocationInFile.set(key, item.location)
    }

    const currentDepartments = await prisma.department.findMany({
      where: { tenantId }, select: { name: true, branchId: true },
    })
    const existingBranchNameById = new Map(existingBranches.map(branch => [branch.id, normalize(branch.name)]))
    const existingDepartmentKeys = new Set(
      currentDepartments.flatMap(dept => {
        const branchName = dept.branchId ? existingBranchNameById.get(dept.branchId) : undefined
        return branchName ? [`${branchName}:${normalize(dept.name)}`] : []
      }),
    )
    let validationChanged = true
    while (validationChanged) {
      validationChanged = false
      const availableDepartments = new Set(existingDepartmentKeys)
      for (const item of validRows) {
        if (!item.errors.length && item.departmentName) {
          availableDepartments.add(`${normalize(item.branchName)}:${normalize(item.departmentName)}`)
        }
      }
      for (const item of validRows) {
        if (item.errors.length || !item.parentDepartmentName) continue
        const parentKey = `${normalize(item.branchName)}:${normalize(item.parentDepartmentName)}`
        if (!availableDepartments.has(parentKey)) {
          item.errors.push(`القسم الرئيسي غير موجود في الفرع: ${item.parentDepartmentName}`)
          errors.push({ row: item.row, message: item.errors.join('؛ ') })
          validationChanged = true
        }
      }
    }

    const parentByDepartment = new Map<string, string>()
    for (const item of validRows) {
      if (!item.errors.length && item.departmentName && item.parentDepartmentName) {
        parentByDepartment.set(
          `${normalize(item.branchName)}:${normalize(item.departmentName)}`,
          `${normalize(item.branchName)}:${normalize(item.parentDepartmentName)}`,
        )
      }
    }
    for (const item of validRows) {
      if (item.errors.length || !item.departmentName) continue
      const start = `${normalize(item.branchName)}:${normalize(item.departmentName)}`
      const seen = new Set<string>()
      let cursor: string | undefined = start
      while (cursor && parentByDepartment.has(cursor)) {
        if (seen.has(cursor)) {
          item.errors.push('يوجد تسلسل دائري بين الأقسام الرئيسية والفرعية')
          errors.push({ row: item.row, message: item.errors.join('؛ ') })
          break
        }
        seen.add(cursor)
        cursor = parentByDepartment.get(cursor)
      }
    }

    let addedBranches = 0
    let addedDepartments = 0
    await prisma.$transaction(async tx => {
      for (const [key, location] of branchLocationInFile) {
        if (branchByName.has(key)) continue
        const source = validRows.find(item => normalize(item.branchName) === key)!
        const created = await tx.branch.create({ data: { tenantId, name: source.branchName.trim(), location: location.trim() } })
        branchByName.set(key, created)
        addedBranches++
      }

      const existingDepartments = await tx.department.findMany({
        where: { tenantId }, select: { id: true, name: true, branchId: true },
      })
      const departmentByKey = new Map(existingDepartments.map(dept => [`${dept.branchId}:${normalize(dept.name)}`, dept]))
      const importedDepartments: { row: number; id: string; branchId: string; parentName: string }[] = []

      for (const item of validRows) {
        if (item.errors.length || !item.departmentName) continue
        const branch = branchByName.get(normalize(item.branchName))!
        const key = `${branch.id}:${normalize(item.departmentName)}`
        if (departmentByKey.has(key)) {
          skipped.push({ row: item.row, message: `القسم ${item.departmentName} موجود مسبقاً في الفرع` })
          continue
        }
        const created = await tx.department.create({ data: { tenantId, branchId: branch.id, name: item.departmentName.trim() } })
        departmentByKey.set(key, created)
        importedDepartments.push({ row: item.row, id: created.id, branchId: branch.id, parentName: item.parentDepartmentName })
        addedDepartments++
      }

      for (const item of importedDepartments) {
        if (!item.parentName) continue
        const parent = departmentByKey.get(`${item.branchId}:${normalize(item.parentName)}`)
        if (!parent) throw new Error('تعذر ربط القسم الرئيسي بعد التحقق من الملف')
        await tx.department.update({ where: { id: item.id }, data: { parentId: parent.id } })
      }
    })
    const existingBranchRows = validRows.filter(item => !item.errors.length && !item.departmentName && existingBranches.some(branch => normalize(branch.name) === normalize(item.branchName)))
    skipped.push(...existingBranchRows.map(item => ({ row: item.row, message: `الفرع ${item.branchName} موجود مسبقاً` })))
    return { total: rows.length, addedBranches, addedDepartments, rejected: errors.length, skipped: skipped.length, errors, skippedRows: skipped }
  }

  async findAll(tenantId: string) {
    return prisma.branch.findMany({
      where: { tenantId },
      include: {
        _count: { select: { employees: true } },
        manager: { select: { id: true, fullName: true, employeeCode: true } },
        siteSupervisor: { select: { id: true, fullName: true, employeeCode: true } },
        departments: {
          select: { id: true, name: true, _count: { select: { employees: true } } },
          orderBy: { name: 'asc' },
        },
      },
      orderBy: { name: 'asc' },
    })
  }

  async create(tenantId: string, data: { name: string; location?: string; managerEmployeeId?: string; siteSupervisorEmployeeId?: string }) {
    return prisma.branch.create({ data: { tenantId, name: data.name, location: data.location, managerEmployeeId: data.managerEmployeeId, siteSupervisorEmployeeId: data.siteSupervisorEmployeeId } })
  }

  async update(tenantId: string, id: string, data: { name?: string; location?: string; managerEmployeeId?: string | null; siteSupervisorEmployeeId?: string | null }) {
    const branch = await prisma.branch.findFirst({ where: { tenantId, id } })
    if (!branch) throw new NotFoundException('الفرع غير موجود')
    return prisma.branch.update({
      where: { id },
      data: {
        ...data,
        managerEmployeeId: 'managerEmployeeId' in data ? (data.managerEmployeeId || null) : undefined,
        siteSupervisorEmployeeId: 'siteSupervisorEmployeeId' in data ? (data.siteSupervisorEmployeeId || null) : undefined,
      },
    })
  }

  async remove(tenantId: string, id: string) {
    const branch = await prisma.branch.findFirst({
      where: { tenantId, id },
      include: { _count: { select: { employees: true } } },
    })
    if (!branch) throw new NotFoundException('الفرع غير موجود')
    if (branch._count.employees > 0)
      throw new ConflictException(`لا يمكن حذف الفرع — يوجد ${branch._count.employees} موظف مرتبط`)
    return prisma.branch.delete({ where: { id } })
  }
}
