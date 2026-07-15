'use client'
import { Fragment, useState, useEffect } from 'react'
import { api } from '../../../lib/api'
import { useAuth } from '../../../hooks/useAuth'

interface Actor { id: string; fullName: string; employeeCode: string }
interface AuditEntry {
  id: string
  action: string
  module: string
  entityId: string | null
  oldData: Record<string, unknown> | null
  newData: Record<string, unknown> | null
  createdAt: string
  actor: Actor | null
  subject: Actor | null
}

const ACTION_MAP: Record<string, { label: string; color: string }> = {
  DELETE: { label: 'حذف',    color: 'bg-red-100 text-red-700' },
  CREATE: { label: 'إضافة',  color: 'bg-green-100 text-green-700' },
  UPDATE: { label: 'تعديل',  color: 'bg-yellow-100 text-yellow-700' },
}

const MODULE_MAP: Record<string, string> = {
  attendance:  'الحضور',
  employees:   'الموظفون',
  departments: 'الأقسام',
  branches:    'الفروع',
  payroll:     'الرواتب',
  leaves:      'الإجازات',
  roles:       'الصلاحيات',
  custody:     'العهد',
}

// أسماء الحقول داخل تفاصيل السجل المحذوف
const FIELD_MAP: Record<string, string> = {
  date:            'التاريخ',
  checkIn:         'وقت الدخول',
  checkOut:        'وقت الخروج',
  status:          'الحالة',
  source:          'المصدر',
  notes:           'ملاحظات',
  lateMinutes:     'دقائق التأخير',
  overtimeMinutes: 'دقائق إضافية',
  approvedBy:      'اعتمده',
  fullName:        'الاسم',
  name:            'الاسم',
}

const HIDDEN_FIELDS = new Set(['id', 'tenantId', 'employeeId', 'createdAt', 'updatedAt'])

const fmtDateTime = (iso: string) =>
  new Date(iso).toLocaleString('ar-SA-u-ca-gregory', {
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit',
  })

const fmtValue = (key: string, val: unknown): string => {
  if (val === null || val === undefined || val === '') return '—'
  if (typeof val === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(val)) {
    // قيمة تاريخ/وقت ISO
    if (key === 'checkIn' || key === 'checkOut')
      return new Date(val).toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' })
    return new Date(val).toLocaleDateString('ar-SA-u-ca-gregory')
  }
  return String(val)
}

/* شبكة حقول — تُبرز القيم المختلفة عن الجانب الآخر (قبل/بعد) */
function FieldsGrid({ data, highlight }: {
  data: Record<string, unknown>
  highlight?: Record<string, unknown> | null
}) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-6 gap-y-2">
      {Object.entries(data)
        .filter(([k]) => !HIDDEN_FIELDS.has(k))
        .map(([k, v]) => {
          const changed = highlight ? JSON.stringify(highlight[k]) !== JSON.stringify(v) : false
          return (
            <div key={k}>
              <p className="text-xs text-gray-400">{FIELD_MAP[k] ?? k}</p>
              <p className={`text-sm font-medium ${changed ? 'text-orange-600 bg-orange-50 rounded px-1 -mx-1' : 'text-gray-700'}`}>
                {fmtValue(k, v)}
              </p>
            </div>
          )
        })}
    </div>
  )
}

export default function AuditPage() {
  useAuth()
  const [entries, setEntries]         = useState<AuditEntry[]>([])
  const [moduleFilter, setModuleFilter] = useState('')
  const [actionFilter, setActionFilter] = useState('')
  const [expanded, setExpanded]       = useState<string | null>(null)
  const [loading, setLoading]         = useState(true)
  const [forbidden, setForbidden]     = useState(false)

  const load = () => {
    setLoading(true)
    const params = new URLSearchParams()
    if (moduleFilter) params.set('module', moduleFilter)
    if (actionFilter) params.set('action', actionFilter)
    api.get(`/audit?${params.toString()}`)
      .then(r => { setEntries(r.data); setForbidden(false) })
      .catch(e => { if (e.response?.status === 403) setForbidden(true) })
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [moduleFilter, actionFilter])

  if (forbidden) {
    return (
      <div className="p-6 max-w-5xl">
        <h1 className="text-2xl font-bold mb-6">سجل التدقيق</h1>
        <div className="bg-white rounded-xl shadow-sm flex flex-col items-center justify-center py-16 text-gray-400">
          <p className="text-4xl mb-3">🔒</p>
          <p className="font-medium text-gray-600">هذه الصفحة متاحة لمدير النظام ومدير الموارد البشرية فقط</p>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 max-w-5xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">سجل التدقيق</h1>
        <p className="text-gray-500 text-sm mt-1">
          توثيق العمليات الحساسة — من فعل ماذا ومتى
        </p>
      </div>

      {/* الفلاتر */}
      <div className="flex items-center gap-3 mb-4">
        <select value={actionFilter} onChange={e => setActionFilter(e.target.value)}
          className="border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white">
          <option value="">كل العمليات</option>
          <option value="DELETE">حذف</option>
          <option value="CREATE">إضافة</option>
          <option value="UPDATE">تعديل</option>
        </select>
        <select value={moduleFilter} onChange={e => setModuleFilter(e.target.value)}
          className="border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white">
          <option value="">كل الوحدات</option>
          {Object.entries(MODULE_MAP).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <span className="text-sm text-gray-500">{entries.length} سجل</span>
      </div>

      {/* الجدول */}
      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16 text-gray-400">جارٍ التحميل...</div>
        ) : entries.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-gray-400">
            <p className="text-4xl mb-3">📜</p>
            <p className="font-medium">لا توجد سجلات تدقيق</p>
            <p className="text-sm mt-1">ستظهر هنا العمليات الحساسة مثل حذف سجلات الحضور</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                {['الوقت', 'المنفذ', 'العملية', 'الوحدة', 'الموظف المتأثر', ''].map(h => (
                  <th key={h} className="text-right px-4 py-3 font-medium text-gray-600">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y">
              {entries.map(e => (
                <Fragment key={e.id}>
                  <tr className="hover:bg-gray-50 cursor-pointer"
                    onClick={() => setExpanded(x => x === e.id ? null : e.id)}>
                    <td className="px-4 py-3 text-gray-500 whitespace-nowrap font-mono text-xs">
                      {fmtDateTime(e.createdAt)}
                    </td>
                    <td className="px-4 py-3">
                      {e.actor ? (
                        <>
                          <p className="font-medium text-gray-800">{e.actor.fullName}</p>
                          <p className="text-gray-400 text-xs">{e.actor.employeeCode}</p>
                        </>
                      ) : <span className="text-gray-300">—</span>}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${ACTION_MAP[e.action]?.color ?? 'bg-gray-100 text-gray-600'}`}>
                        {ACTION_MAP[e.action]?.label ?? e.action}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {MODULE_MAP[e.module] ?? e.module}
                    </td>
                    <td className="px-4 py-3">
                      {e.subject ? (
                        <>
                          <p className="text-gray-700">{e.subject.fullName}</p>
                          <p className="text-gray-400 text-xs">{e.subject.employeeCode}</p>
                        </>
                      ) : <span className="text-gray-300">—</span>}
                    </td>
                    <td className="px-4 py-3 text-left text-gray-400 text-xs">
                      {expanded === e.id ? '▲ إخفاء' : '▼ التفاصيل'}
                    </td>
                  </tr>

                  {/* تفاصيل العملية: قبل / بعد */}
                  {expanded === e.id && (e.oldData || e.newData) && (
                    <tr className="bg-gray-50/70">
                      <td colSpan={6} className="px-6 py-4 space-y-4">
                        {e.oldData && (
                          <div>
                            <p className="text-xs font-semibold text-gray-500 mb-2">
                              {e.newData ? '⬅️ قبل التعديل:' : 'البيانات قبل الحذف:'}
                            </p>
                            <FieldsGrid data={e.oldData} highlight={e.newData} />
                          </div>
                        )}
                        {e.newData && (
                          <div>
                            <p className="text-xs font-semibold text-gray-500 mb-2">➡️ بعد التعديل:</p>
                            <FieldsGrid data={e.newData} highlight={e.oldData} />
                          </div>
                        )}
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
