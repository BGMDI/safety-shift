'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { api } from '../../../lib/api'
import { useAuth } from '../../../hooks/useAuth'

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000'

interface Employee {
  id: string
  employeeCode: string
  fullName: string
  photo: string | null
  email: string | null
  phone: string | null
  nationality: string | null
  idExpiryDate: string | null
  birthDate: string | null
  qualification: string | null
  specialization: string | null
  iban: string | null
  status: string
  hireDate: string
  branch: { name: string } | null
  department: { name: string } | null
  jobTitle: { name: string } | null
}

function calcAge(birthDateStr: string | null): number | null {
  if (!birthDateStr) return null
  const birth = new Date(birthDateStr)
  if (isNaN(birth.getTime())) return null
  const today = new Date()
  let age = today.getFullYear() - birth.getFullYear()
  const m = today.getMonth() - birth.getMonth()
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--
  return age >= 0 ? age : null
}

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  ACTIVE:     { label: 'نشط',        color: 'bg-green-100 text-green-700' },
  SUSPENDED:  { label: 'موقوف',      color: 'bg-yellow-100 text-yellow-700' },
  TERMINATED: { label: 'منتهي الخدمة', color: 'bg-red-100 text-red-700' },
}

export default function EmployeesPage() {
  useAuth()
  const [employees, setEmployees] = useState<Employee[]>([])
  const [total, setTotal] = useState(0)
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('')
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState({ total: 0, active: 0, suspended: 0, terminated: 0 })

  const fetchEmployees = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ page: String(page), limit: '15' })
      if (search) params.set('search', search)
      if (status) params.set('status', status)
      const res = await api.get(`/employees?${params}`)
      setEmployees(res.data.data)
      setTotal(res.data.total)
    } catch {
      // token expired — redirect handled by interceptor
    } finally {
      setLoading(false)
    }
  }, [page, search, status])

  useEffect(() => { fetchEmployees() }, [fetchEmployees])
  useEffect(() => {
    api.get('/employees/stats').then(r => setStats(r.data)).catch(() => {})
  }, [])

  const totalPages = Math.ceil(total / 15)

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">الموظفون</h1>
          <p className="text-gray-500 text-sm mt-1">إجمالي {total} موظف</p>
        </div>
        <Link
          href="/employees/new"
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition text-sm font-medium"
        >
          + إضافة موظف
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {[
          { label: 'الإجمالي',       value: stats.total,      color: 'border-blue-400' },
          { label: 'نشط',            value: stats.active,     color: 'border-green-400' },
          { label: 'موقوف',          value: stats.suspended,  color: 'border-yellow-400' },
          { label: 'منتهي الخدمة',   value: stats.terminated, color: 'border-red-400' },
        ].map(s => (
          <div key={s.label} className={`bg-white rounded-xl border-r-4 ${s.color} shadow-sm p-4`}>
            <p className="text-sm text-gray-500">{s.label}</p>
            <p className="text-2xl font-bold mt-1">{s.value}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl shadow-sm p-4 mb-4 flex gap-3 flex-wrap">
        <input
          type="text"
          placeholder="بحث بالاسم · الرقم الوظيفي · رقم الهوية · الجوال..."
          value={search}
          onChange={e => { setSearch(e.target.value); setPage(1) }}
          className="border rounded-lg px-3 py-2 text-sm flex-1 min-w-48 focus:outline-none focus:ring-2 focus:ring-blue-400"
        />
        <select
          value={status}
          onChange={e => { setStatus(e.target.value); setPage(1) }}
          className="border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
        >
          <option value="">كل الحالات</option>
          <option value="ACTIVE">نشط</option>
          <option value="SUSPENDED">موقوف</option>
          <option value="TERMINATED">منتهي الخدمة</option>
        </select>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16 text-gray-400">جاري التحميل...</div>
        ) : employees.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-gray-400">
            <p className="text-lg">لا يوجد موظفون</p>
            <Link href="/employees/new" className="mt-3 text-blue-600 text-sm hover:underline">
              أضف أول موظف
            </Link>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                {['', 'الموظف', 'العمر', 'الجنسية', 'القسم / الوظيفة', 'الفرع', 'الهوية', 'الحالة', ''].map((h, i) => (
                  <th key={i} className="text-right px-4 py-3 font-medium text-gray-600 text-sm">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y">
              {employees.map(emp => {
                const expiry = emp.idExpiryDate ? new Date(emp.idExpiryDate) : null
                const daysLeft = expiry ? Math.ceil((expiry.getTime() - Date.now()) / 86400000) : null
                const expired = daysLeft !== null && daysLeft <= 0
                const soon    = daysLeft !== null && daysLeft > 0 && daysLeft <= 30
                const age     = calcAge(emp.birthDate)
                return (
                <tr key={emp.id} className="hover:bg-gray-50 transition-colors">
                  {/* صورة */}
                  <td className="px-3 py-3 w-12">
                    <div className="w-9 h-9 rounded-full overflow-hidden bg-gradient-to-br from-blue-100 to-blue-200 flex items-center justify-center flex-shrink-0">
                      {emp.photo
                        ? <img src={`${API_URL}${emp.photo}`} alt={emp.fullName} className="w-full h-full object-cover" />
                        : <span className="text-blue-500 font-bold text-sm">{emp.fullName.charAt(0)}</span>
                      }
                    </div>
                  </td>
                  {/* الاسم والكود */}
                  <td className="px-4 py-3">
                    <p className="font-medium text-gray-800">{emp.fullName}</p>
                    {(emp.qualification || emp.specialization) && (
                      <p className="text-xs text-gray-400 mt-0.5">
                        {emp.qualification}{emp.qualification && emp.specialization ? ' · ' : ''}{emp.specialization}
                      </p>
                    )}
                    <p className="text-xs text-gray-400 font-mono">{emp.employeeCode}</p>
                  </td>
                  {/* العمر */}
                  <td className="px-4 py-3 text-center">
                    {age !== null
                      ? <span className="text-sm font-medium text-gray-700">{age} <span className="text-xs text-gray-400">سنة</span></span>
                      : <span className="text-gray-300 text-xs">—</span>
                    }
                  </td>
                  {/* الجنسية */}
                  <td className="px-4 py-3 text-gray-500 text-sm">{emp.nationality ?? '—'}</td>
                  {/* القسم / الوظيفة */}
                  <td className="px-4 py-3">
                    <p className="text-gray-700 text-sm">{emp.jobTitle?.name ?? '—'}</p>
                    <p className="text-gray-400 text-xs">{emp.department?.name ?? ''}</p>
                  </td>
                  {/* الفرع */}
                  <td className="px-4 py-3 text-gray-500 text-sm">{emp.branch?.name ?? '—'}</td>
                  {/* انتهاء الهوية */}
                  <td className="px-4 py-3">
                    {expiry ? (
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                        expired ? 'bg-red-100 text-red-700' :
                        soon    ? 'bg-yellow-100 text-yellow-700' :
                                  'bg-gray-100 text-gray-600'
                      }`}>
                        {expired ? '⚠️ منتهية' : soon ? `⏰ ${daysLeft} يوم` : expiry.toLocaleDateString('ar-SA')}
                      </span>
                    ) : <span className="text-gray-300 text-xs">—</span>}
                  </td>
                  {/* الحالة */}
                  <td className="px-4 py-3">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${STATUS_LABELS[emp.status]?.color}`}>
                      {STATUS_LABELS[emp.status]?.label}
                    </span>
                  </td>
                  {/* أزرار */}
                  <td className="px-4 py-3">
                    <Link href={`/employees/${emp.id}/edit`} className="text-blue-600 hover:underline text-xs">
                      تعديل
                    </Link>
                  </td>
                </tr>
                )
              })}
            </tbody>
          </table>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t bg-gray-50 text-sm">
            <span className="text-gray-500">صفحة {page} من {totalPages}</span>
            <div className="flex gap-2">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-3 py-1 border rounded-lg disabled:opacity-40 hover:bg-white"
              >السابق</button>
              <button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="px-3 py-1 border rounded-lg disabled:opacity-40 hover:bg-white"
              >التالي</button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
