'use client'
import { useState, useEffect, use } from 'react'
import { useRouter } from 'next/navigation'
import { api } from '../../../../../lib/api'
import { useAuth } from '../../../../../hooks/useAuth'

interface SalaryData {
  employee: { fullName: string; employeeCode: string; jobTitle?: { name: string }; department?: { name: string }; hireDate: string }
  components: { id: string; type: string; name: string; amount: number; effectiveDate: string }[]
  summary: { base: number; allowances: number; deductions: number; net: number }
}

const TYPE_MAP: Record<string, { label: string; color: string }> = {
  BASE:      { label: 'راتب أساسي', color: 'bg-blue-100 text-blue-700' },
  ALLOWANCE: { label: 'بدل',        color: 'bg-green-100 text-green-700' },
  DEDUCTION: { label: 'حسم',        color: 'bg-red-100 text-red-700' },
}

export default function EmployeeSalaryPage({ params }: { params: Promise<{ id: string }> }) {
  useAuth()
  const { id } = use(params)
  const router = useRouter()
  const [data, setData] = useState<SalaryData | null>(null)
  const [form, setForm] = useState({ type: 'ALLOWANCE', name: '', amount: '', effectiveDate: new Date().toISOString().split('T')[0] })
  const [loading, setLoading] = useState(false)
  const [showForm, setShowForm] = useState(false)

  const load = () => {
    api.get(`/salary/employee/${id}`).then(r => setData(r.data)).catch(() => {})
  }
  useEffect(() => { load() }, [id])

  const add = async () => {
    if (!form.name || !form.amount) return
    setLoading(true)
    try {
      await api.post('/salary/component', { employeeId: id, type: form.type, name: form.name, amount: Number(form.amount), effectiveDate: form.effectiveDate })
      setForm({ type: 'ALLOWANCE', name: '', amount: '', effectiveDate: new Date().toISOString().split('T')[0] })
      setShowForm(false)
      load()
    } catch (e: any) { alert(e.response?.data?.message) }
    setLoading(false)
  }

  const remove = async (compId: string) => {
    if (!confirm('حذف هذا المكوّن؟')) return
    await api.delete(`/salary/component/${compId}`).catch(e => alert(e.response?.data?.message))
    load()
  }

  const printCertificate = async () => {
    try {
      const r = await api.get(`/salary/employee/${id}/certificate`)
      const cert = r.data
      const win = window.open('', '_blank')!
      win.document.write(`
        <!DOCTYPE html><html lang="ar" dir="rtl">
        <head><meta charset="UTF-8"><title>تعريف بالراتب</title>
        <style>body{font-family:Arial;padding:40px;direction:rtl;} h1{text-align:center;} .info{margin:20px 0;} table{width:100%;border-collapse:collapse;} td,th{border:1px solid #ccc;padding:8px;text-align:right;} .total{font-weight:bold;background:#f0f0f0;} .sig{margin-top:60px;display:flex;justify-content:space-between;}</style>
        </head><body>
        <h1>شهادة راتب</h1>
        <div class="info">
          <p><strong>اسم الموظف:</strong> ${cert.employee?.fullName}</p>
          <p><strong>رقم الموظف:</strong> ${cert.employee?.employeeCode}</p>
          <p><strong>الوظيفة:</strong> ${cert.employee?.jobTitle?.name ?? '—'}</p>
          <p><strong>القسم:</strong> ${cert.employee?.department?.name ?? '—'}</p>
          <p><strong>تاريخ الالتحاق:</strong> ${cert.employee?.hireDate ? new Date(cert.employee.hireDate).toLocaleDateString('ar-SA') : '—'}</p>
          <p><strong>تاريخ الإصدار:</strong> ${new Date().toLocaleDateString('ar-SA')}</p>
        </div>
        <table>
          <thead><tr><th>المكوّن</th><th>النوع</th><th>المبلغ</th></tr></thead>
          <tbody>
            ${(cert.components || []).map((c: any) => `<tr><td>${c.name}</td><td>${c.type === 'BASE' ? 'أساسي' : c.type === 'ALLOWANCE' ? 'بدل' : 'حسم'}</td><td>${Number(c.amount).toLocaleString('ar-SA')} ر.س</td></tr>`).join('')}
            <tr class="total"><td colspan="2">الراتب الصافي</td><td>${Number(cert.summary?.net ?? 0).toLocaleString('ar-SA')} ر.س</td></tr>
          </tbody>
        </table>
        <div class="sig">
          <div><p>توقيع الموظف: ______________</p></div>
          <div><p>توقيع المدير: ______________</p><p>الختم الرسمي</p></div>
        </div>
        </body></html>
      `)
      win.document.close()
      win.print()
    } catch { alert('تعذّر تحميل بيانات الشهادة') }
  }

  const printJobCard = () => {
    if (!data) return
    const win = window.open('', '_blank')!
    win.document.write(`
      <!DOCTYPE html><html lang="ar" dir="rtl">
      <head><meta charset="UTF-8"><title>بطاقة وظيفية</title>
      <style>body{font-family:Arial;padding:40px;direction:rtl;} .card{border:2px solid #2563eb;border-radius:12px;padding:24px;max-width:400px;margin:auto;} h2{color:#2563eb;text-align:center;} .field{display:flex;gap:8px;margin:8px 0;} .label{font-weight:bold;min-width:120px;color:#555;} </style>
      </head><body>
      <div class="card">
        <h2>🪪 البطاقة الوظيفية</h2>
        <hr style="margin:12px 0;border-color:#e5e7eb">
        <div class="field"><span class="label">الاسم:</span><span>${data.employee.fullName}</span></div>
        <div class="field"><span class="label">رقم الموظف:</span><span>${data.employee.employeeCode}</span></div>
        <div class="field"><span class="label">المسمى الوظيفي:</span><span>${data.employee.jobTitle?.name ?? '—'}</span></div>
        <div class="field"><span class="label">القسم:</span><span>${data.employee.department?.name ?? '—'}</span></div>
        <div class="field"><span class="label">تاريخ الالتحاق:</span><span>${new Date(data.employee.hireDate).toLocaleDateString('ar-SA')}</span></div>
        <div style="text-align:center;margin-top:20px;padding:12px;background:#eff6ff;border-radius:8px;font-size:20px;font-weight:bold;color:#1d4ed8;letter-spacing:4px">${data.employee.employeeCode}</div>
      </div>
      </body></html>
    `)
    win.document.close()
    win.print()
  }

  const fmt = (n: number) => Number(n).toLocaleString('ar-SA', { minimumFractionDigits: 2 }) + ' ر.س'

  if (!data) return <div className="p-6 text-gray-500">جارٍ التحميل...</div>

  return (
    <div className="p-6 max-w-4xl">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => router.back()} className="text-blue-600 text-sm hover:underline">← رجوع</button>
        <h1 className="text-2xl font-bold">راتب — {data.employee.fullName}</h1>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        {[
          { label: 'الراتب الأساسي', value: fmt(data.summary.base), color: 'blue' },
          { label: 'البدلات', value: fmt(data.summary.allowances), color: 'green' },
          { label: 'الحسميات', value: fmt(data.summary.deductions), color: 'red' },
          { label: 'الراتب الصافي', value: fmt(data.summary.net), color: 'indigo' },
        ].map(card => (
          <div key={card.label} className={`bg-${card.color}-50 border border-${card.color}-100 rounded-xl p-4 text-center`}>
            <p className="text-xs text-gray-500 mb-1">{card.label}</p>
            <p className={`font-bold text-${card.color}-700 text-lg`}>{card.value}</p>
          </div>
        ))}
      </div>

      {/* Actions */}
      <div className="flex gap-3 mb-6">
        <button onClick={printCertificate} className="bg-white border border-gray-300 text-gray-700 px-4 py-2 rounded-lg text-sm hover:bg-gray-50 flex items-center gap-2">
          🖨️ طباعة تعريف بالراتب
        </button>
        <button onClick={printJobCard} className="bg-white border border-gray-300 text-gray-700 px-4 py-2 rounded-lg text-sm hover:bg-gray-50 flex items-center gap-2">
          🪪 طباعة البطاقة الوظيفية
        </button>
        <button onClick={() => setShowForm(!showForm)} className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-blue-700">
          + إضافة مكوّن
        </button>
      </div>

      {/* Add component form */}
      {showForm && (
        <div className="bg-white rounded-xl shadow-sm p-5 mb-6">
          <h2 className="font-semibold mb-4">إضافة مكوّن راتب</h2>
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <label className="text-xs text-gray-500 mb-1 block">النوع</label>
              <select value={form.type} onChange={e => setForm({ ...form, type: e.target.value })} className={inp}>
                <option value="BASE">راتب أساسي</option>
                <option value="ALLOWANCE">بدل</option>
                <option value="DEDUCTION">حسم</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">اسم المكوّن *</label>
              <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="بدل السكن، حسم التأخير..." className={inp} />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">المبلغ (ر.س) *</label>
              <input type="number" value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} className={inp} />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">تاريخ السريان</label>
              <input type="date" value={form.effectiveDate} onChange={e => setForm({ ...form, effectiveDate: e.target.value })} className={inp} />
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={add} disabled={loading || !form.name || !form.amount}
              className="bg-blue-600 text-white px-5 py-2 rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50">
              {loading ? 'جارٍ الحفظ...' : 'حفظ'}
            </button>
            <button onClick={() => setShowForm(false)} className="px-5 py-2 rounded-lg text-sm border hover:bg-gray-50">إلغاء</button>
          </div>
        </div>
      )}

      {/* Components table */}
      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b">
            <tr>{['المكوّن', 'النوع', 'المبلغ', 'تاريخ السريان', ''].map(h =>
              <th key={h} className="text-right px-4 py-3 font-medium text-gray-600">{h}</th>)}</tr>
          </thead>
          <tbody className="divide-y">
            {data.components.length === 0
              ? <tr><td colSpan={5} className="text-center py-10 text-gray-400">لا توجد مكونات راتب — أضف الراتب الأساسي أولاً</td></tr>
              : data.components.map(c => (
                <tr key={c.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium">{c.name}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${TYPE_MAP[c.type]?.color}`}>{TYPE_MAP[c.type]?.label}</span>
                  </td>
                  <td className="px-4 py-3 font-mono font-bold">
                    <span className={c.type === 'DEDUCTION' ? 'text-red-600' : c.type === 'ALLOWANCE' ? 'text-green-600' : 'text-blue-600'}>
                      {Number(c.amount).toLocaleString('ar-SA')} ر.س
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-500">{new Date(c.effectiveDate).toLocaleDateString('ar-SA')}</td>
                  <td className="px-4 py-3">
                    <button onClick={() => remove(c.id)} className="text-red-500 text-xs hover:underline">حذف</button>
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
