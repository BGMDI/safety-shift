import { Injectable } from '@nestjs/common'
import { prisma } from '@shift-saas/database'

@Injectable()
export class AuditService {
  async findAll(tenantId: string, filters: { module?: string; action?: string; limit?: number }) {
    const logs = await prisma.auditLog.findMany({
      where: {
        tenantId,
        ...(filters.module ? { module: filters.module } : {}),
        ...(filters.action ? { action: filters.action } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: Math.min(filters.limit ?? 100, 500),
    })

    // لا توجد علاقة مباشرة بين audit_logs والموظفين — نحل الأسماء يدوياً
    // (المنفذ + الموظف المتأثر داخل oldData إن وجد)
    const ids = new Set<string>()
    for (const l of logs) {
      if (l.employeeId) ids.add(l.employeeId)
      const affected = (l.oldData as any)?.employeeId
      if (affected) ids.add(affected)
    }
    const employees = ids.size
      ? await prisma.employee.findMany({
          where: { id: { in: [...ids] } },
          select: { id: true, fullName: true, employeeCode: true },
        })
      : []
    const empMap = new Map(employees.map(e => [e.id, e]))

    return logs.map(l => ({
      id: l.id,
      action: l.action,
      module: l.module,
      entityId: l.entityId,
      oldData: l.oldData,
      newData: l.newData,
      createdAt: l.createdAt,
      actor: l.employeeId ? (empMap.get(l.employeeId) ?? null) : null,
      subject: (l.oldData as any)?.employeeId
        ? (empMap.get((l.oldData as any).employeeId) ?? null)
        : null,
    }))
  }
}
