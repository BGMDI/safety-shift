'use client'
import { useState, useEffect } from 'react'
import { api } from '../../../lib/api'
import { useAuth } from '../../../hooks/useAuth'

interface Employee { id: string; fullName: string; employeeCode: string }
interface Request {
  id: string; type: 'NEW_HIRE' | 'RETURN_FROM_LEAVE'; scheduledDate: string; notes: string | null; status: string; createdAt: string
  employee: { fullName: string; employeeCode: string }
}

const STATUS: Record<string, { label: string; color: string }> = {
  PENDING:  { label: 'معلّق',  color: 'bg-yellow-100 text-yellow-700' },
  APPROVED: { label: 'مقبول', color: 'bg-green-100 text-green-700' },
  REJECTED: { label: 'مرفوض', color: 'bg-red-100 text-red-700' },
}
const TYPE_LABEL: Record<string, string> = { NEW_HIRE: '🆕 مباشرة تعيين', RETURN_FROM_LEAVE: '🔙 عودة من إجازة' }

const inp = 'border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 w-full'

export default function OnboardingPage() {
  useAuth()
  const [requests, setRequests]   = useState<Request[]>([])
  const [employees, setEmployees] = useState<Employee[]>([])
  const [form, setForm] = useState({ employeeId: '', type: 'NEW_HIRE', scheduledDate: new Date().toISOString().slice(0, 10), notes: '' })
  const [loading, setLoading] = useState(false)
  const [showForm, setShowForm] = useState(false)

  const load = () => api.get('/onboarding').then(r => setRequests(r.data)).catch(() => {})
  useEffect(() => {
    api.get('/employees?limit=500').then(r => setEmployees(r.data.data ?? r.data)).catch(() => {})
    load()
  }, [])

  const submit = async () => {
    if (!form.employeeId) return
    setLoading(true)
    try {
      await api.post('/onboarding', form)
      setForm({ employeeId: '', type: 'NEW_HIRE', scheduledDate: new Date().toISOString().slice(0, 10), notes: '' })
      setShowForm(false); load()
    } catch (e: any) { alert(e.response?.data?.message ?? 'خطأ') }
    setLoading(false)
  }

  const decide = async (id: string, decision: 'APPROVED' | 'REJECTED') => {
    await api.put(`/onboarding/${id}/decide`, { decision }).catch(e => alert(e.response?.data?.message ?? 'خطأ'))
    load()
  }

  return (
    <div className="p-6 max-w-5xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">المباشرات</h1>
          <p className="text-gray-500 text-sm mt-1">مباشرات التعيين والعودة من الإجازة، وتمر عبر مسار الاعتماد المُهيّأ</p>
        </div>
        <button onClick={() => setShowForm(!showForm)} className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-blue-700">
          + مباشرة جديدة
        </button>
      </div>

      {showForm && (
        <div className="bg-white rounded-xl shadow-sm p-5 mb-6">
          <h2 className="font-semibold mb-4">تسجيل مباشرة</h2>
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <label className="text-xs text-gray-500 mb-1 block">الموظف *</label>
              <select value={form.employeeId} onChange={e => setForm({ ...form, employeeId: e.target.value })} className={inp}>
                <option value="">-- اختر موظفاً --</option>
                {employees.map(e => <option key={e.id} value={e.id}>{e.fullName} ({e.employeeCode})</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">نوع المباشرة *</label>
              <select value={form.type} onChange={e => setForm({ ...form, type: e.target.value })} className={inp}>
                <option value="NEW_HIRE">مباشرة تعيين</option>
                <option value="RETURN_FROM_LEAVE">عودة من إجازة</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">التاريخ</label>
              <input type="date" value={form.scheduledDate} onChange={e => setForm({ ...form, scheduledDate: e.target.value })} className={inp} />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">ملاحظات</label>
              <input value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} placeholder="ملاحظات..." className={inp} />
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={submit} disabled={loading || !form.employeeId}
              className="bg-blue-600 text-white px-5 py-2 rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50">
              {loading ? 'جارٍ الإرسال...' : 'إرسال'}
            </button>
            <button onClick={() => setShowForm(false)} className="px-5 py-2 rounded-lg text-sm border hover:bg-gray-50">إلغاء</button>
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b">
            <tr>{['الموظف', 'النوع', 'التاريخ', 'الحالة', 'ملاحظات', ''].map(h =>
              <th key={h} className="text-right px-4 py-3 font-medium text-gray-600">{h}</th>)}</tr>
          </thead>
          <tbody className="divide-y">
            {requests.length === 0
              ? <tr><td colSpan={6} className="text-center py-10 text-gray-400">لا توجد مباشرات</td></tr>
              : requests.map(r => (
                <tr key={r.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <p className="font-medium">{r.employee.fullName}</p>
                    <p className="text-gray-400 text-xs">{r.employee.employeeCode}</p>
                  </td>
                  <td className="px-4 py-3">{TYPE_LABEL[r.type]}</td>
                  <td className="px-4 py-3 text-gray-500 text-xs">{new Date(r.scheduledDate).toLocaleDateString('ar-SA-u-ca-gregory')}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${STATUS[r.status]?.color}`}>{STATUS[r.status]?.label}</span>
                  </td>
                  <td className="px-4 py-3 text-gray-500 text-xs">{r.notes ?? '—'}</td>
                  <td className="px-4 py-3">
                    {r.status === 'PENDING' && (
                      <div className="flex gap-1">
                        <button onClick={() => decide(r.id, 'APPROVED')} className="bg-green-50 text-green-700 px-2 py-1 rounded text-xs hover:bg-green-100">قبول</button>
                        <button onClick={() => decide(r.id, 'REJECTED')} className="bg-red-50 text-red-700 px-2 py-1 rounded text-xs hover:bg-red-100">رفض</button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
