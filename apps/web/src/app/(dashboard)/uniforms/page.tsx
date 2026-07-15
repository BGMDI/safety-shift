'use client'
import { useState, useEffect } from 'react'
import { api } from '../../../lib/api'
import { useAuth } from '../../../hooks/useAuth'

interface Employee { id: string; fullName: string; employeeCode: string }
interface Request {
  id: string; uniformType: string; size: string | null; quantity: number; status: string; notes: string | null; createdAt: string
  employee: { fullName: string; employeeCode: string }
}

const STATUS: Record<string, { label: string; color: string }> = {
  PENDING:  { label: 'معلق',  color: 'bg-yellow-100 text-yellow-700' },
  APPROVED: { label: 'مقبول', color: 'bg-green-100 text-green-700' },
  REJECTED: { label: 'مرفوض', color: 'bg-red-100 text-red-700' },
}

const UNIFORM_TYPES = ['قميص', 'بنطلون', 'حذاء', 'جاكيت', 'قبعة', 'معطف واقٍ', 'قفازات', 'بدلة كاملة']
const SIZES = ['XS', 'S', 'M', 'L', 'XL', 'XXL', '38', '39', '40', '41', '42', '43', '44', '45']

export default function UniformsPage() {
  useAuth()
  const [requests, setRequests] = useState<Request[]>([])
  const [employees, setEmployees] = useState<Employee[]>([])
  const [statusFilter, setStatusFilter] = useState('')
  const [form, setForm] = useState({ employeeId: '', uniformType: '', size: '', quantity: '1', notes: '' })
  const [loading, setLoading] = useState(false)
  const [showForm, setShowForm] = useState(false)

  const load = () => {
    const q = statusFilter ? `?status=${statusFilter}` : ''
    api.get(`/uniforms${q}`).then(r => setRequests(r.data)).catch(() => {})
  }
  useEffect(() => {
    api.get('/employees?limit=500').then(r => setEmployees(r.data.data ?? r.data)).catch(() => {})
  }, [])
  useEffect(() => { load() }, [statusFilter])

  const submit = async () => {
    if (!form.employeeId || !form.uniformType) return
    setLoading(true)
    try {
      await api.post('/uniforms', { ...form, quantity: Number(form.quantity) })
      setForm({ employeeId: '', uniformType: '', size: '', quantity: '1', notes: '' })
      setShowForm(false); load()
    } catch (e: any) { alert(e.response?.data?.message) }
    setLoading(false)
  }

  const updateStatus = async (id: string, status: string) => {
    await api.put(`/uniforms/${id}/status`, { status }).catch(e => alert(e.response?.data?.message))
    load()
  }

  return (
    <div className="p-6 max-w-5xl">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">طلبات بدلة العمل</h1>
        <button onClick={() => setShowForm(!showForm)} className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-blue-700">
          + طلب جديد
        </button>
      </div>

      {showForm && (
        <div className="bg-white rounded-xl shadow-sm p-5 mb-6">
          <h2 className="font-semibold mb-4">طلب صرف بدلة عمل</h2>
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <label className="text-xs text-gray-500 mb-1 block">الموظف *</label>
              <select value={form.employeeId} onChange={e => setForm({ ...form, employeeId: e.target.value })} className={inp}>
                <option value="">-- اختر موظفاً --</option>
                {employees.map(e => <option key={e.id} value={e.id}>{e.fullName} ({e.employeeCode})</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">نوع البدلة *</label>
              <select value={form.uniformType} onChange={e => setForm({ ...form, uniformType: e.target.value })} className={inp}>
                <option value="">-- اختر النوع --</option>
                {UNIFORM_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">المقاس</label>
              <select value={form.size} onChange={e => setForm({ ...form, size: e.target.value })} className={inp}>
                <option value="">-- اختر المقاس --</option>
                {SIZES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">الكمية</label>
              <input type="number" min="1" value={form.quantity} onChange={e => setForm({ ...form, quantity: e.target.value })} className={inp} />
            </div>
            <div className="col-span-2">
              <label className="text-xs text-gray-500 mb-1 block">ملاحظات</label>
              <input value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} placeholder="ملاحظات..." className={inp} />
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={submit} disabled={loading || !form.employeeId || !form.uniformType}
              className="bg-blue-600 text-white px-5 py-2 rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50">
              {loading ? 'جارٍ الإرسال...' : 'إرسال الطلب'}
            </button>
            <button onClick={() => setShowForm(false)} className="px-5 py-2 rounded-lg text-sm border hover:bg-gray-50">إلغاء</button>
          </div>
        </div>
      )}

      <div className="flex gap-3 mb-4">
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
          className="border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400">
          <option value="">كل الحالات</option>
          <option value="PENDING">معلق</option>
          <option value="APPROVED">مقبول</option>
          <option value="REJECTED">مرفوض</option>
        </select>
        <span className="text-sm text-gray-500 self-center">{requests.length} طلب</span>
      </div>

      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b">
            <tr>{['الموظف', 'نوع البدلة', 'المقاس', 'الكمية', 'الحالة', 'التاريخ', ''].map(h =>
              <th key={h} className="text-right px-4 py-3 font-medium text-gray-600">{h}</th>)}</tr>
          </thead>
          <tbody className="divide-y">
            {requests.length === 0
              ? <tr><td colSpan={7} className="text-center py-10 text-gray-400">لا توجد طلبات</td></tr>
              : requests.map(r => (
                <tr key={r.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <p className="font-medium">{r.employee.fullName}</p>
                    <p className="text-gray-400 text-xs">{r.employee.employeeCode}</p>
                  </td>
                  <td className="px-4 py-3">{r.uniformType}</td>
                  <td className="px-4 py-3">{r.size ?? '—'}</td>
                  <td className="px-4 py-3 text-center">{r.quantity}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${STATUS[r.status]?.color}`}>{STATUS[r.status]?.label}</span>
                  </td>
                  <td className="px-4 py-3 text-gray-500 text-xs">{new Date(r.createdAt).toLocaleDateString('ar-SA')}</td>
                  <td className="px-4 py-3">
                    {r.status === 'PENDING' && (
                      <div className="flex gap-1">
                        <button onClick={() => updateStatus(r.id, 'APPROVED')} className="bg-green-50 text-green-700 px-2 py-1 rounded text-xs hover:bg-green-100">قبول</button>
                        <button onClick={() => updateStatus(r.id, 'REJECTED')} className="bg-red-50 text-red-700 px-2 py-1 rounded text-xs hover:bg-red-100">رفض</button>
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
const inp = 'border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 w-full'
