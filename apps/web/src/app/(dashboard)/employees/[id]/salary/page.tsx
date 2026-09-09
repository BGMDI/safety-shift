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

type CertificateType = 'salary' | 'employment'
const API_URL = (process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000').replace(/\/$/, '')
const DEFAULT_SALARY_TEXT = 'تشهد {اسم_الشركة} بأن الموظف/ة {اسم_الموظف}، رقم وظيفي {الرقم_الوظيفي}، يعمل لدينا بمسمى {المسمى_الوظيفي} منذ تاريخ {تاريخ_التعيين}، ويتقاضى راتباً شهرياً موضحاً أدناه. وقد أُعطي هذا التعريف بناءً على طلبه دون أدنى مسؤولية على الشركة.'
const DEFAULT_EMPLOYMENT_TEXT = 'تشهد {اسم_الشركة} بأن الموظف/ة {اسم_الموظف}، رقم وظيفي {الرقم_الوظيفي}، يعمل لدينا بمسمى {المسمى_الوظيفي} في قسم {القسم} منذ تاريخ {تاريخ_التعيين}. وقد أُعطي هذا التعريف بناءً على طلبه دون أدنى مسؤولية على الشركة.'

function escapeHtml(value: unknown) {
  return String(value ?? '').replace(/[&<>'"]/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[char]!)
}

function assetUrl(path?: string | null) {
  if (!path) return ''
  return /^\/uploads\/[a-zA-Z0-9/_\-.]+$/.test(path) ? `${API_URL}${path}` : ''
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
  const [showCertificate, setShowCertificate] = useState(false)
  const [certificateType, setCertificateType] = useState<CertificateType>('salary')
  const [recipient, setRecipient] = useState('')
  const [certificateLoading, setCertificateLoading] = useState(false)

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
    if (!recipient.trim()) return
    setCertificateLoading(true)
    try {
      const r = await api.get(`/salary/employee/${id}/certificate`)
      const cert = r.data
      const template = certificateType === 'salary'
        ? cert.tenant?.salaryCertificateText || DEFAULT_SALARY_TEXT
        : cert.tenant?.employmentCertificateText || DEFAULT_EMPLOYMENT_TEXT
      const fields: Record<string, string> = {
        '{اسم_الشركة}': cert.tenant?.name ?? 'الشركة', '{اسم_الموظف}': cert.employee?.fullName,
        '{الرقم_الوظيفي}': cert.employee?.employeeCode, '{رقم_الهوية}': cert.employee?.nationalId ?? '—',
        '{الجنسية}': cert.employee?.nationality ?? '—', '{المسمى_الوظيفي}': cert.employee?.jobTitle?.name ?? '—',
        '{القسم}': cert.employee?.department?.name ?? '—', '{الفرع}': cert.employee?.branch?.name ?? '—',
        '{تاريخ_التعيين}': cert.employee?.hireDate ? new Date(cert.employee.hireDate).toLocaleDateString('ar-SA') : '—',
        '{تاريخ_الإصدار}': new Date().toLocaleDateString('ar-SA'), '{الجهة}': recipient.trim(),
      }
      let body = escapeHtml(template)
      for (const [key, value] of Object.entries(fields)) body = body.replaceAll(key, escapeHtml(value))
      body = body.replace(/\r?\n/g, '<br>')
      const logo = assetUrl(cert.tenant?.logo)
      const signature = assetUrl(cert.tenant?.certificateSignature)
      const stamp = assetUrl(cert.tenant?.certificateStamp)
      const header = assetUrl(cert.tenant?.certificateHeader)
      const footer = assetUrl(cert.tenant?.certificateFooter)
      const win = window.open('', '_blank')
      if (!win) throw new Error('popup blocked')
      win.document.write(`
        <!DOCTYPE html><html lang="ar" dir="rtl">
        <head><meta charset="UTF-8"><title>${certificateType === 'salary' ? 'تعريف بالراتب' : 'تعريف موظف'}</title>
        <style>@page{size:A4;margin:12mm 18mm 18mm}*{box-sizing:border-box}body{font-family:Arial;color:#0b2135;direction:rtl;margin:0;padding-bottom:${footer ? '86px' : '30px'}}.letterhead{width:100%;height:105px;object-fit:contain;object-position:center top;margin-bottom:16px}.head{display:flex;align-items:center;justify-content:space-between;border-bottom:3px solid #1e90ff;padding-bottom:18px}.head img{width:100px;height:70px;object-fit:contain}.company{font-size:22px;font-weight:bold}.ref{font-size:12px;color:#64748b;line-height:1.8}.title{text-align:center;margin:34px 0 8px;font-size:25px}.to{text-align:center;color:#334155;margin-bottom:30px}.body{font-size:16px;line-height:2.25;text-align:justify;min-height:180px}table{width:100%;border-collapse:collapse;margin:24px 0}td,th{border:1px solid #cbd5e1;padding:10px;text-align:right}.total{font-weight:bold;background:#eff6ff}.approval{margin-top:45px;display:flex;justify-content:flex-end}.approval-box{text-align:center;min-width:260px}.assets{height:105px;display:flex;align-items:center;justify-content:center;gap:5px}.assets img{max-width:125px;max-height:100px;object-fit:contain}.footer{position:fixed;bottom:0;left:0;right:0;text-align:center;color:#64748b}.footer img{width:100%;height:75px;object-fit:contain;object-position:center bottom}.footer-text{border-top:1px solid #cbd5e1;padding-top:8px;font-size:10px}</style>
        </head><body>
        ${header ? `<img class="letterhead" src="${escapeHtml(header)}" alt="ترويسة الخطاب">` : `<header class="head"><div><div class="company">${escapeHtml(cert.tenant?.name ?? 'الشركة')}</div><div class="ref">التاريخ: ${new Date().toLocaleDateString('ar-SA')}<br>الرقم الوظيفي: ${escapeHtml(cert.employee?.employeeCode)}</div></div>${logo ? `<img src="${escapeHtml(logo)}" alt="شعار الشركة">` : ''}</header>`}
        <h1 class="title">${certificateType === 'salary' ? 'تعريف بالراتب' : 'تعريف موظف'}</h1>
        <p class="to">إلى: <strong>${escapeHtml(recipient.trim())}</strong></p>
        <div class="body">${body}</div>
        ${certificateType === 'salary' ? `<table>
          <thead><tr><th>المكوّن</th><th>النوع</th><th>المبلغ</th></tr></thead>
          <tbody>
            ${(cert.components || []).map((c: any) => `<tr><td>${escapeHtml(c.name)}</td><td>${c.type === 'BASE' ? 'أساسي' : c.type === 'ALLOWANCE' ? 'بدل' : 'حسم'}</td><td>${Number(c.amount).toLocaleString('ar-SA')} ر.س</td></tr>`).join('')}
            <tr class="total"><td colspan="2">الراتب الصافي</td><td>${Number(cert.summary?.net ?? 0).toLocaleString('ar-SA')} ر.س</td></tr>
          </tbody>
        </table>` : ''}
        <div class="approval"><div class="approval-box"><strong>إدارة شؤون الموظفين</strong><div class="assets">${signature ? `<img src="${escapeHtml(signature)}" alt="التوقيع">` : ''}${stamp ? `<img src="${escapeHtml(stamp)}" alt="الختم">` : ''}</div></div></div>
        <footer class="footer">${footer ? `<img src="${escapeHtml(footer)}" alt="تذييل الخطاب">` : `<div class="footer-text">صدر هذا التعريف إلكترونياً من نظام وردية لصالح ${escapeHtml(cert.tenant?.name ?? 'الشركة')}</div>`}</footer>
        </body></html>
      `)
      win.document.close()
      window.setTimeout(() => win.print(), 500)
      setShowCertificate(false)
    } catch { alert('تعذّر تحميل بيانات الشهادة') }
    finally { setCertificateLoading(false) }
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
        <button onClick={() => setShowCertificate(true)} className="bg-white border border-gray-300 text-gray-700 px-4 py-2 rounded-lg text-sm hover:bg-gray-50 flex items-center gap-2">
          🖨️ إصدار تعريف
        </button>
        <button onClick={printJobCard} className="bg-white border border-gray-300 text-gray-700 px-4 py-2 rounded-lg text-sm hover:bg-gray-50 flex items-center gap-2">
          🪪 طباعة البطاقة الوظيفية
        </button>
        <button onClick={() => setShowForm(!showForm)} className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-blue-700">
          + إضافة مكوّن
        </button>
      </div>

      {showCertificate ? <div className="fixed inset-0 z-50 bg-slate-950/50 grid place-items-center p-4" role="dialog" aria-modal="true" aria-labelledby="certificate-title">
        <section className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6">
          <h2 id="certificate-title" className="text-xl font-black mb-1">إصدار تعريف رسمي</h2>
          <p className="text-sm text-gray-500 mb-5">اختر نوع الخطاب وحدد الجهة الموجه لها قبل الطباعة.</p>
          <div className="grid grid-cols-2 gap-3 mb-5">
            <button type="button" onClick={() => setCertificateType('salary')} className={`border rounded-xl p-4 text-right ${certificateType === 'salary' ? 'border-blue-600 bg-blue-50 text-blue-800' : ''}`}><strong className="block">تعريف بالراتب</strong><span className="text-xs">يتضمن تفاصيل الراتب والصافي</span></button>
            <button type="button" onClick={() => setCertificateType('employment')} className={`border rounded-xl p-4 text-right ${certificateType === 'employment' ? 'border-blue-600 bg-blue-50 text-blue-800' : ''}`}><strong className="block">تعريف بدون راتب</strong><span className="text-xs">يثبت العمل والمسمى فقط</span></button>
          </div>
          <label className="block text-sm font-bold mb-2" htmlFor="certificate-recipient">الجهة الموجه لها التعريف *</label>
          <input id="certificate-recipient" autoFocus maxLength={150} value={recipient} onChange={e => setRecipient(e.target.value)} placeholder="مثال: إلى من يهمه الأمر، البنك الأهلي…" className="w-full border rounded-xl px-4 py-3 mb-5 focus:outline-none focus:ring-2 focus:ring-blue-400" />
          <div className="flex gap-3 justify-end"><button type="button" onClick={() => setShowCertificate(false)} className="px-4 py-2 text-gray-600">إلغاء</button><button type="button" onClick={printCertificate} disabled={!recipient.trim() || certificateLoading} className="bg-blue-600 text-white px-5 py-2 rounded-xl font-bold disabled:opacity-40">{certificateLoading ? 'جارٍ التجهيز…' : 'معاينة وطباعة'}</button></div>
        </section>
      </div> : null}

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
