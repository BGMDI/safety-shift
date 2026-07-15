'use client'
import { useState, useEffect } from 'react'
import { api } from '../../../lib/api'
import { useAuth } from '../../../hooks/useAuth'

interface PayrollRun {
  id: string; month: number; year: number; status: string; totalAmount: number; approvedAt: string | null
  _count: { details: number }
}
interface PayrollDetail {
  id: string; baseSalary: number; totalAllowances: number; totalDeductions: number
  absenceDeduction: number; lateDeduction: number; netSalary: number; absentDays: number
  employee: { fullName: string; employeeCode: string; jobTitle: { name: string } | null }
}

const STATUS: Record<string, { label: string; color: string }> = {
  DRAFT:    { label: 'مسودة', color: 'bg-gray-100 text-gray-700' },
  APPROVED: { label: 'معتمد', color: 'bg-green-100 text-green-700' },
  PAID:     { label: 'مدفوع', color: 'bg-blue-100 text-blue-700' },
}

const MONTHS = ['يناير','فبراير','مارس','أبريل','مايو','يونيو','يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر']

export default function PayrollPage() {
  useAuth()
  const [runs, setRuns] = useState<PayrollRun[]>([])
  const [selected, setSelected] = useState<string>('')
  const [details, setDetails] = useState<PayrollDetail[]>([])
  const [form, setForm] = useState({ month: new Date().getMonth() + 1, year: new Date().getFullYear() })
  const [loading, setLoading] = useState(false)

  const loadRuns = () => api.get('/payroll').then(r => setRuns(r.data)).catch(() => {})
  useEffect(() => { loadRuns() }, [])

  const loadDetails = (id: string) => {
    setSelected(id)
    api.get(`/payroll/${id}`).then(r => setDetails(r.data.details ?? [])).catch(() => {})
  }

  const createRun = async () => {
    setLoading(true)
    try {
      await api.post('/payroll', form)
      loadRuns()
    } catch (e: any) { alert(e.response?.data?.message) }
    setLoading(false)
  }

  const approve = async (id: string) => {
    if (!confirm('اعتماد مسير الرواتب؟')) return
    await api.put(`/payroll/${id}/approve`, {}).catch(e => alert(e.response?.data?.message))
    loadRuns()
    if (selected === id) loadDetails(id)
  }

  const remove = async (id: string) => {
    if (!confirm('حذف مسير الرواتب؟')) return
    await api.delete(`/payroll/${id}`).catch(e => alert(e.response?.data?.message))
    if (selected === id) { setSelected(''); setDetails([]) }
    loadRuns()
  }

  const fmt = (n: number) => Number(n).toLocaleString('ar-SA', { minimumFractionDigits: 2 })

  return (
    <div className="p-6 max-w-6xl">
      <h1 className="text-2xl font-bold mb-6">مسير الرواتب</h1>

      <div className="grid grid-cols-3 gap-6">
        {/* Left panel: runs list */}
        <div className="col-span-1">
          {/* Create form */}
          <div className="bg-white rounded-xl shadow-sm p-4 mb-4">
            <h2 className="font-semibold mb-3 text-sm">إنشاء مسير جديد</h2>
            <div className="flex gap-2 mb-3">
              <select value={form.month} onChange={e => setForm({ ...form, month: Number(e.target.value) })}
                className="border rounded-lg px-2 py-1.5 text-xs flex-1 focus:outline-none">
                {MONTHS.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
              </select>
              <input type="number" value={form.year} onChange={e => setForm({ ...form, year: Number(e.target.value) })}
                className="border rounded-lg px-2 py-1.5 text-xs w-20 focus:outline-none" />
            </div>
            <button onClick={createRun} disabled={loading}
              className="w-full bg-blue-600 text-white px-3 py-2 rounded-lg text-xs hover:bg-blue-700 disabled:opacity-50">
              {loading ? 'جارٍ الحساب...' : '⚙️ احتساب الرواتب'}
            </button>
          </div>

          {/* Runs list */}
          <div className="space-y-2">
            {runs.map(run => (
              <div key={run.id} onClick={() => loadDetails(run.id)}
                className={`bg-white rounded-xl shadow-sm p-4 cursor-pointer transition border-2 ${selected === run.id ? 'border-blue-500' : 'border-transparent hover:border-gray-200'}`}>
                <div className="flex justify-between items-start mb-1">
                  <p className="font-semibold text-sm">{MONTHS[run.month - 1]} {run.year}</p>
                  <span className={`px-2 py-0.5 rounded-full text-xs ${STATUS[run.status]?.color}`}>{STATUS[run.status]?.label}</span>
                </div>
                <p className="text-gray-500 text-xs">{run._count.details} موظف</p>
                <p className="text-blue-600 font-bold text-sm mt-1">{fmt(run.totalAmount)} ر.س</p>
                <div className="flex gap-2 mt-2">
                  {run.status === 'DRAFT' && <button onClick={e => { e.stopPropagation(); approve(run.id) }} className="text-green-600 text-xs hover:underline">اعتماد</button>}
                  {run.status === 'DRAFT' && <button onClick={e => { e.stopPropagation(); remove(run.id) }} className="text-red-500 text-xs hover:underline">حذف</button>}
                </div>
              </div>
            ))}
            {runs.length === 0 && <p className="text-center text-gray-400 text-sm py-6">لا توجد مسيرات</p>}
          </div>
        </div>

        {/* Right panel: details */}
        <div className="col-span-2">
          {selected && details.length > 0 ? (
            <div className="bg-white rounded-xl shadow-sm overflow-hidden">
              <table className="w-full text-xs">
                <thead className="bg-gray-50 border-b">
                  <tr>{['الموظف', 'الأساسي', 'البدلات', 'الحسميات', 'غياب', 'تأخير', 'الصافي'].map(h =>
                    <th key={h} className="text-right px-3 py-2 font-medium text-gray-600">{h}</th>)}</tr>
                </thead>
                <tbody className="divide-y">
                  {details.map(d => (
                    <tr key={d.id} className="hover:bg-gray-50">
                      <td className="px-3 py-2">
                        <p className="font-medium text-sm">{d.employee.fullName}</p>
                        <p className="text-gray-400 text-xs">{d.employee.employeeCode}</p>
                        {d.employee.jobTitle && <p className="text-gray-400 text-xs">{d.employee.jobTitle.name}</p>}
                      </td>
                      <td className="px-3 py-2 font-mono">{fmt(d.baseSalary)}</td>
                      <td className="px-3 py-2 font-mono text-green-600">{fmt(d.totalAllowances)}</td>
                      <td className="px-3 py-2 font-mono text-red-500">{fmt(d.totalDeductions)}</td>
                      <td className="px-3 py-2 font-mono text-red-500">{d.absentDays > 0 ? fmt(d.absenceDeduction) : '—'}</td>
                      <td className="px-3 py-2 font-mono text-red-500">{Number(d.lateDeduction) > 0 ? fmt(d.lateDeduction) : '—'}</td>
                      <td className="px-3 py-2 font-bold font-mono text-blue-700">{fmt(d.netSalary)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="bg-white rounded-xl shadow-sm flex items-center justify-center h-64 text-gray-400">
              <div className="text-center">
                <p className="text-4xl mb-2">💰</p>
                <p>اختر مسير رواتب لعرض التفاصيل</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
