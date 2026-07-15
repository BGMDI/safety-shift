'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { api } from '../../../../lib/api'
import { useAuth } from '../../../../hooks/useAuth'

interface Employee {
  id: string
  employeeCode: string
  fullName: string
  email: string | null
  phone: string | null
  nationalId: string | null
  status: string
  hireDate: string
  createdAt: string
  branch: { name: string } | null
  department: { name: string } | null
  jobTitle: { name: string } | null
  employeeRoles: { role: { name: string } }[]
}

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  ACTIVE:     { label: 'نشط',           color: 'bg-green-100 text-green-700' },
  SUSPENDED:  { label: 'موقوف',         color: 'bg-yellow-100 text-yellow-700' },
  TERMINATED: { label: 'منتهي الخدمة',  color: 'bg-red-100 text-red-700' },
}

export default function EmployeeDetailPage() {
  useAuth()
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const [employee, setEmployee] = useState<Employee | null>(null)
  const [loading, setLoading] = useState(true)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    api.get(`/employees/${id}`)
      .then(r => setEmployee(r.data))
      .catch(() => router.push('/employees'))
      .finally(() => setLoading(false))
  }, [id, router])

  const handleTerminate = async () => {
    if (!confirm('هل أنت متأكد من إنهاء خدمة هذا الموظف؟')) return
    setDeleting(true)
    try {
      await api.delete(`/employees/${id}`)
      router.push('/employees')
    } catch {
      setDeleting(false)
    }
  }

  if (loading) return <div className="p-6 text-gray-400">جاري التحميل...</div>
  if (!employee) return null

  const status = STATUS_LABELS[employee.status]

  return (
    <div className="p-6 max-w-3xl">
      {/* Breadcrumb */}
      <div className="flex items-center gap-3 mb-6">
        <Link href="/employees" className="text-gray-400 hover:text-gray-600 text-sm">← الموظفون</Link>
        <span className="text-gray-300">/</span>
        <span className="text-sm font-medium">{employee.fullName}</span>
      </div>

      {/* Header card */}
      <div className="bg-white rounded-xl shadow-sm p-6 mb-4">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 text-xl font-bold">
              {employee.fullName.charAt(0)}
            </div>
            <div>
              <h1 className="text-xl font-bold">{employee.fullName}</h1>
              <p className="text-gray-500 text-sm">{employee.jobTitle?.name ?? 'بدون وظيفة'}</p>
              <span className={`mt-1 inline-block px-2 py-0.5 rounded-full text-xs font-medium ${status.color}`}>
                {status.label}
              </span>
            </div>
          </div>
          <div className="flex gap-2">
            <Link
              href={`/employees/${id}/edit`}
              className="border px-4 py-2 rounded-lg text-sm hover:bg-gray-50 transition"
            >
              تعديل
            </Link>
            {employee.status !== 'TERMINATED' && (
              <button
                onClick={handleTerminate}
                disabled={deleting}
                className="border border-red-200 text-red-600 px-4 py-2 rounded-lg text-sm hover:bg-red-50 transition disabled:opacity-50"
              >
                إنهاء الخدمة
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Quick actions */}
      <div className="grid grid-cols-3 gap-3 mb-4">
        <Link href={`/employees/${id}/salary`} className="bg-white rounded-xl shadow-sm p-4 flex items-center gap-3 hover:bg-blue-50 transition group">
          <span className="text-2xl">💰</span>
          <div><p className="text-sm font-semibold group-hover:text-blue-600">الراتب</p><p className="text-xs text-gray-400">عرض وإدارة الراتب</p></div>
        </Link>
        <Link href={`/custody?emp=${id}`} className="bg-white rounded-xl shadow-sm p-4 flex items-center gap-3 hover:bg-orange-50 transition group">
          <span className="text-2xl">📦</span>
          <div><p className="text-sm font-semibold group-hover:text-orange-600">العهد</p><p className="text-xs text-gray-400">عهد الموظف وإخلاء الطرف</p></div>
        </Link>
        <Link href={`/leaves?emp=${id}`} className="bg-white rounded-xl shadow-sm p-4 flex items-center gap-3 hover:bg-green-50 transition group">
          <span className="text-2xl">🌴</span>
          <div><p className="text-sm font-semibold group-hover:text-green-600">الإجازات</p><p className="text-xs text-gray-400">طلبات وأرصدة الإجازات</p></div>
        </Link>
      </div>

      {/* Details */}
      <div className="bg-white rounded-xl shadow-sm p-6">
        <h2 className="font-semibold mb-4 text-gray-700">بيانات الموظف</h2>
        <div className="grid grid-cols-2 gap-y-4">
          {[
            { label: 'كود الموظف',       value: employee.employeeCode },
            { label: 'الفرع',            value: employee.branch?.name },
            { label: 'القسم',            value: employee.department?.name },
            { label: 'الوظيفة',          value: employee.jobTitle?.name },
            { label: 'البريد الإلكتروني', value: employee.email },
            { label: 'رقم الجوال',       value: employee.phone },
            { label: 'رقم الهوية',       value: employee.nationalId },
            { label: 'تاريخ التعيين',    value: employee.hireDate ? new Date(employee.hireDate).toLocaleDateString('ar-SA') : null },
            { label: 'تاريخ الإضافة',    value: new Date(employee.createdAt).toLocaleDateString('ar-SA') },
            { label: 'الصلاحيات',        value: employee.employeeRoles.map(r => r.role.name).join(', ') || 'بدون صلاحيات' },
          ].map(item => (
            <div key={item.label}>
              <p className="text-xs text-gray-400 mb-0.5">{item.label}</p>
              <p className="text-sm font-medium text-gray-800">{item.value ?? '—'}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
