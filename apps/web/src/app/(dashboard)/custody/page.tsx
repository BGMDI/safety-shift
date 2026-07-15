'use client'
import { useState, useEffect } from 'react'
import { api } from '../../../lib/api'
import { useAuth } from '../../../hooks/useAuth'

interface Employee { id: string; fullName: string; employeeCode: string }
interface CustodyItem { id: string; itemName: string; assignedDate: string; returnedDate: string | null; status: string }
interface Clearance { cleared: boolean; issues: { type: string; label: string }[] }

export default function CustodyPage() {
  useAuth()
  const [employees, setEmployees] = useState<Employee[]>([])
  const [selectedEmp, setSelectedEmp] = useState<string>('')
  const [items, setItems] = useState<CustodyItem[]>([])
  const [clearance, setClearance] = useState<Clearance | null>(null)
  const [form, setForm] = useState({ itemName: '', assignedDate: new Date().toISOString().split('T')[0] })
  const [tab, setTab] = useState<'custody' | 'clearance'>('custody')

  useEffect(() => {
    api.get('/employees?limit=500').then(r => setEmployees(r.data.data ?? r.data)).catch(() => {})
  }, [])

  const loadCustody = (empId: string) => {
    api.get(`/custody/employee/${empId}`).then(r => setItems(r.data)).catch(() => {})
    api.get(`/custody/clearance/${empId}`).then(r => setClearance(r.data)).catch(() => {})
  }

  const selectEmployee = (id: string) => {
    setSelectedEmp(id)
    if (id) loadCustody(id)
    else { setItems([]); setClearance(null) }
  }

  const addItem = async () => {
    if (!selectedEmp || !form.itemName) return
    await api.post('/custody', { employeeId: selectedEmp, itemName: form.itemName, assignedDate: form.assignedDate })
    setForm({ itemName: '', assignedDate: new Date().toISOString().split('T')[0] })
    loadCustody(selectedEmp)
  }

  const returnItem = async (id: string) => {
    if (!confirm('تأكيد إرجاع العهدة؟')) return
    await api.put(`/custody/${id}/return`, {}).catch(e => alert(e.response?.data?.message))
    loadCustody(selectedEmp)
  }

  const emp = employees.find(e => e.id === selectedEmp)

  return (
    <div className="p-6 max-w-5xl">
      <h1 className="text-2xl font-bold mb-6">العهد وإخلاء الطرف</h1>

      {/* Employee selector */}
      <div className="bg-white rounded-xl shadow-sm p-5 mb-6">
        <label className="text-sm font-medium text-gray-700 block mb-2">اختر الموظف</label>
        <select value={selectedEmp} onChange={e => selectEmployee(e.target.value)}
          className="border rounded-lg px-3 py-2 text-sm w-full max-w-sm focus:outline-none focus:ring-2 focus:ring-blue-400">
          <option value="">-- اختر موظفاً --</option>
          {employees.map(e => (
            <option key={e.id} value={e.id}>{e.fullName} ({e.employeeCode})</option>
          ))}
        </select>
      </div>

      {selectedEmp && (
        <>
          {/* Tabs */}
          <div className="flex gap-2 mb-6 border-b">
            {[{ id: 'custody', label: 'العهد' }, { id: 'clearance', label: 'إخلاء الطرف' }].map(t => (
              <button key={t.id} onClick={() => setTab(t.id as any)}
                className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition ${tab === t.id ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
                {t.label}
              </button>
            ))}
          </div>

          {tab === 'custody' && (
            <>
              {/* Add item form */}
              <div className="bg-white rounded-xl shadow-sm p-5 mb-6">
                <h2 className="font-semibold mb-4">إضافة عهدة لـ {emp?.fullName}</h2>
                <div className="flex gap-3 items-end flex-wrap">
                  <div className="flex-1 min-w-48">
                    <label className="text-xs text-gray-500 mb-1 block">اسم العهدة *</label>
                    <input value={form.itemName} onChange={e => setForm({ ...form, itemName: e.target.value })}
                      placeholder="جهاز لاب توب، مفتاح، بطاقة..." className={inp} />
                  </div>
                  <div className="w-40">
                    <label className="text-xs text-gray-500 mb-1 block">تاريخ التسليم</label>
                    <input type="date" value={form.assignedDate} onChange={e => setForm({ ...form, assignedDate: e.target.value })} className={inp} />
                  </div>
                  <button onClick={addItem} disabled={!form.itemName}
                    className="bg-blue-600 text-white px-5 py-2 rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50">
                    + إضافة عهدة
                  </button>
                </div>
              </div>

              {/* Custody table */}
              <div className="bg-white rounded-xl shadow-sm overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b">
                    <tr>{['العهدة', 'تاريخ التسليم', 'تاريخ الإرجاع', 'الحالة', ''].map(h =>
                      <th key={h} className="text-right px-4 py-3 font-medium text-gray-600">{h}</th>)}</tr>
                  </thead>
                  <tbody className="divide-y">
                    {items.length === 0
                      ? <tr><td colSpan={5} className="text-center py-10 text-gray-400">لا توجد عهد مسجلة</td></tr>
                      : items.map(item => (
                        <tr key={item.id} className="hover:bg-gray-50">
                          <td className="px-4 py-3 font-medium">{item.itemName}</td>
                          <td className="px-4 py-3 text-gray-600">{new Date(item.assignedDate).toLocaleDateString('ar-SA')}</td>
                          <td className="px-4 py-3 text-gray-600">{item.returnedDate ? new Date(item.returnedDate).toLocaleDateString('ar-SA') : '—'}</td>
                          <td className="px-4 py-3">
                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${item.status === 'active' ? 'bg-orange-100 text-orange-700' : 'bg-green-100 text-green-700'}`}>
                              {item.status === 'active' ? 'لم يُرجع' : 'مُرجع'}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            {item.status === 'active' && (
                              <button onClick={() => returnItem(item.id)} className="text-blue-600 text-xs hover:underline">
                                تسجيل الإرجاع
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </>
          )}

          {tab === 'clearance' && clearance && (
            <div className="bg-white rounded-xl shadow-sm p-6">
              <h2 className="font-semibold mb-4 text-lg">إخلاء الطرف — {emp?.fullName}</h2>
              <div className={`rounded-xl p-5 mb-6 ${clearance.cleared ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
                <div className="flex items-center gap-3">
                  <span className="text-3xl">{clearance.cleared ? '✅' : '❌'}</span>
                  <div>
                    <p className="font-bold text-lg">{clearance.cleared ? 'الموظف خالٍ من أي التزامات' : 'لا يمكن إخلاء الطرف'}</p>
                    <p className="text-sm text-gray-600">{clearance.cleared ? 'يمكن إصدار شهادة إخلاء الطرف' : 'يوجد التزامات معلقة'}</p>
                  </div>
                </div>
              </div>

              {!clearance.cleared && clearance.issues.length > 0 && (
                <div>
                  <h3 className="font-semibold mb-3 text-gray-700">الالتزامات المعلقة:</h3>
                  <ul className="space-y-2">
                    {clearance.issues.map((issue, i) => (
                      <li key={i} className="flex items-center gap-2 text-sm text-red-700 bg-red-50 px-4 py-2 rounded-lg">
                        <span>•</span> {issue.label}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {clearance.cleared && (
                <button onClick={() => window.print()} className="bg-blue-600 text-white px-6 py-2 rounded-lg text-sm hover:bg-blue-700">
                  🖨️ طباعة شهادة إخلاء الطرف
                </button>
              )}
            </div>
          )}
        </>
      )}
    </div>
  )
}
const inp = 'border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 w-full'
