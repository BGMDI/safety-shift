'use client'
import { useState, useEffect } from 'react'
import { api } from '../../../lib/api'
import { useAuth } from '../../../hooks/useAuth'
import { Building2, CalendarDays, Download, Landmark, ShieldCheck, X } from 'lucide-react'

interface PayrollRun {
  id: string; month: number; year: number; status: string; totalAmount: number; approvedAt: string | null
  _count: { details: number }
}
interface PayrollDetail {
  id: string; baseSalary: number; totalAllowances: number; totalDeductions: number
  housingAllowance: number; allowanceBreakdown: { name: string; amount: number; category: string }[] | null
  bonusAmount: number; insuranceDeduction: number; overtimeMinutes: number; overtimeAmount: number
  absenceDeduction: number; lateDeduction: number; netSalary: number; absentDays: number
  employee: { fullName: string; employeeCode: string; jobTitle: { name: string } | null }
}
interface BankOption { id: string; name: string; sarie: string }

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
  const [banks, setBanks] = useState<BankOption[]>([])
  const [exportOpen, setExportOpen] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [exportError, setExportError] = useState<string[]>([])
  const [bankForm, setBankForm] = useState({ bankId: '', employerIban: '', bankCustomerId: '', molEstablishmentId: '', valueDate: new Date().toISOString().slice(0, 10) })

  const loadRuns = () => api.get('/payroll').then(r => setRuns(r.data)).catch(() => {})
  useEffect(() => {
    loadRuns()
    api.get('/payroll/export/banks').then(r => {
      setBanks(r.data)
      setBankForm(value => ({ ...value, bankId: value.bankId || r.data[0]?.id || '' }))
    }).catch(() => {})
  }, [])

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
  const selectedRun = runs.find(run => run.id === selected)

  const exportBankFile = async () => {
    if (!selected || exporting) return
    setExporting(true); setExportError([])
    try {
      const response = await api.post(`/payroll/${selected}/export`, bankForm, { responseType: 'blob' })
      const disposition = response.headers['content-disposition'] as string | undefined
      const filename = disposition?.match(/filename="?([^";]+)"?/)?.[1] ?? 'payroll-wps.txt'
      const url = URL.createObjectURL(response.data)
      const link = document.createElement('a')
      link.href = url; link.download = filename; link.click()
      window.setTimeout(() => URL.revokeObjectURL(url), 1000)
      setExportOpen(false)
    } catch (error: any) {
      let payload: any = error.response?.data
      if (payload instanceof Blob) {
        try { payload = JSON.parse(await payload.text()) } catch { payload = null }
      }
      setExportError(payload?.message?.errors ?? payload?.errors ?? [typeof payload?.message === 'string' ? payload.message : 'تعذر إنشاء الملف البنكي'])
    } finally { setExporting(false) }
  }

  return (
    <div className="p-6 max-w-6xl">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div><h1 className="text-2xl font-bold">مسير الرواتب</h1><p className="text-sm text-gray-500 mt-1">احتساب واعتماد وتصدير الرواتب إلى البنك</p></div>
        {selectedRun && ['APPROVED', 'PAID'].includes(selectedRun.status) ? <button onClick={() => { setExportError([]); setExportOpen(true) }} className="btn-primary"><Landmark size={17} /> تصدير للبنك</button> : null}
      </div>

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
            <div className="bg-white rounded-xl shadow-sm overflow-x-auto">
              <table className="w-full min-w-[1080px] text-xs">
                <thead className="bg-gray-50 border-b">
                  <tr>{['الموظف', 'الأساسي', 'تفصيل البدلات', 'عمل إضافي', 'مكافآت', 'التأمينات', 'خصم الغياب', 'حسميات أخرى', 'الصافي'].map(h =>
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
                      <td className="px-3 py-2 min-w-40">
                        {d.allowanceBreakdown?.length ? <div className="space-y-1">{d.allowanceBreakdown.filter(item => item.category !== 'BONUS').map((item, index) => <div key={`${item.name}-${index}`} className="flex justify-between gap-3"><span className="text-gray-500">{item.name}</span><b className="font-mono text-green-600">{fmt(item.amount)}</b></div>)}</div> : <span className="font-mono text-green-600">{Number(d.totalAllowances) > 0 ? fmt(Number(d.totalAllowances) - Number(d.bonusAmount ?? 0)) : '—'}</span>}
                      </td>
                      <td className="px-3 py-2"><p className="font-mono text-green-600 font-bold">{Number(d.overtimeAmount) > 0 ? fmt(d.overtimeAmount) : '—'}</p>{d.overtimeMinutes > 0 ? <p className="text-gray-400 mt-1">{Math.floor(d.overtimeMinutes / 60)}س {d.overtimeMinutes % 60}د</p> : null}</td>
                      <td className="px-3 py-2 font-mono text-green-600">{Number(d.bonusAmount) > 0 ? fmt(d.bonusAmount) : '—'}</td>
                      <td className="px-3 py-2 font-mono text-red-500">{Number(d.insuranceDeduction) > 0 ? fmt(d.insuranceDeduction) : '—'}</td>
                      <td className="px-3 py-2 font-mono text-red-500">{d.absentDays > 0 ? <><p>{fmt(d.absenceDeduction)}</p><p className="text-gray-400 mt-1">{d.absentDays} يوم</p></> : '—'}</td>
                      <td className="px-3 py-2 font-mono text-red-500">{Number(d.totalDeductions) - Number(d.insuranceDeduction ?? 0) + Number(d.lateDeduction) > 0 ? fmt(Number(d.totalDeductions) - Number(d.insuranceDeduction ?? 0) + Number(d.lateDeduction)) : '—'}</td>
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

      {exportOpen && selectedRun ? <div className="fixed inset-0 z-[80] bg-slate-950/55 backdrop-blur-sm p-4 grid place-items-center" onMouseDown={event => { if (event.currentTarget === event.target) setExportOpen(false) }}>
        <section role="dialog" aria-modal="true" aria-labelledby="bank-export-title" className="wardiya-section w-full max-w-2xl max-h-[92vh] overflow-y-auto">
          <header className="p-5 border-b flex items-start gap-3">
            <span className="section-icon"><Landmark size={21} /></span>
            <div className="flex-1"><h2 id="bank-export-title" className="font-extrabold text-lg">تصدير ملف البنك</h2><p className="text-xs text-gray-500 mt-1">مسير {MONTHS[selectedRun.month - 1]} {selectedRun.year} · {selectedRun._count.details} موظف · {fmt(selectedRun.totalAmount)} ر.س</p></div>
            <button onClick={() => setExportOpen(false)} aria-label="إغلاق" className="w-9 h-9 grid place-items-center rounded-xl hover:bg-gray-100 text-gray-500"><X size={19} /></button>
          </header>
          <div className="p-6 space-y-5">
            <div className="info-panel flex gap-3"><ShieldCheck size={20} className="text-green-600 shrink-0 mt-1" /><span>ينشئ النظام ملف WPS الرسمي بصيغة TXT ويفحص الهوية والآيبان وتطابق صافي الرواتب قبل التنزيل.</span></div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="field-group md:col-span-2"><label>البنك الذي تُرفع إليه الرواتب <em>*</em></label><select value={bankForm.bankId} onChange={e => setBankForm(v => ({ ...v, bankId: e.target.value }))} className="w-full"><option value="">اختر البنك</option>{banks.map(bank => <option key={bank.id} value={bank.id}>{bank.name} ({bank.sarie})</option>)}</select></div>
              <div className="field-group md:col-span-2"><label>آيبان حساب المنشأة المخصوم منه <em>*</em></label><div className="relative"><Building2 size={17} className="absolute right-4 top-3.5 text-gray-400" /><input dir="ltr" value={bankForm.employerIban} onChange={e => setBankForm(v => ({ ...v, employerIban: e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '') }))} maxLength={24} placeholder="SA0000000000000000000000" className="w-full pr-11 font-mono" /></div></div>
              <div className="field-group"><label>رقم المنشأة لدى البنك <em>*</em></label><input inputMode="numeric" value={bankForm.bankCustomerId} onChange={e => setBankForm(v => ({ ...v, bankCustomerId: e.target.value.replace(/\D/g, '').slice(0, 10) }))} placeholder="رقم العميل أو المنشأة" className="w-full" /></div>
              <div className="field-group"><label>رقم المنشأة بوزارة الموارد <em>*</em></label><input inputMode="numeric" value={bankForm.molEstablishmentId} onChange={e => setBankForm(v => ({ ...v, molEstablishmentId: e.target.value.replace(/\D/g, '').slice(0, 15) }))} placeholder="رقم مكتب العمل والمنشأة" className="w-full" /></div>
              <div className="field-group md:col-span-2"><label>تاريخ تنفيذ الرواتب <em>*</em></label><div className="relative"><CalendarDays size={17} className="absolute right-4 top-3.5 text-gray-400" /><input type="date" min={new Date().toISOString().slice(0, 10)} value={bankForm.valueDate} onChange={e => setBankForm(v => ({ ...v, valueDate: e.target.value }))} className="w-full pr-11" /></div></div>
            </div>
            {exportError.length ? <div className="form-error"><strong className="block mb-2">تعذر إنشاء الملف:</strong><ul className="list-disc pr-5 space-y-1">{exportError.map((message, index) => <li key={`${message}-${index}`}>{message}</li>)}</ul></div> : null}
          </div>
          <footer className="p-5 border-t flex flex-wrap justify-end gap-3 bg-gray-50/60">
            <button onClick={() => setExportOpen(false)} className="btn-secondary">إلغاء</button>
            <button onClick={exportBankFile} disabled={exporting || !bankForm.bankId || !bankForm.employerIban || !bankForm.bankCustomerId || !bankForm.molEstablishmentId || !bankForm.valueDate} className="btn-primary"><Download size={17} />{exporting ? 'جارٍ التحقق…' : 'تحقق وتنزيل الملف'}</button>
          </footer>
        </section>
      </div> : null}
    </div>
  )
}
