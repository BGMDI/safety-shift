'use client'

import { useEffect, useState } from 'react'
import { Download, FileSpreadsheet, Upload } from 'lucide-react'
import { api } from '../lib/api'
import { isHR } from '../lib/auth'

interface ImportResult {
  total: number
  addedBranches: number
  addedDepartments: number
  rejected: number
  skipped: number
  errors: { row: number; message: string }[]
  skippedRows: { row: number; message: string }[]
}

export function OrganizationImport({ onImported }: { onImported: () => void }) {
  const [allowed, setAllowed] = useState(false)
  const [open, setOpen] = useState(false)
  const [file, setFile] = useState<File | null>(null)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [result, setResult] = useState<ImportResult | null>(null)
  useEffect(() => setAllowed(isHR()), [])

  async function downloadTemplate() {
    setMessage('')
    try {
      const { data } = await api.get('/branches/structure-import-template', { responseType: 'blob' })
      const url = URL.createObjectURL(data)
      const link = document.createElement('a')
      link.href = url; link.download = 'organization-structure-template.xlsx'; link.click()
      window.setTimeout(() => URL.revokeObjectURL(url), 1000)
    } catch { setMessage('تعذر تنزيل القالب') }
  }

  async function uploadFile() {
    if (!file || busy) return
    if (!file.name.toLowerCase().endsWith('.xlsx') || file.size > 2 * 1024 * 1024) {
      setMessage('اختر ملف XLSX بحجم لا يتجاوز 2 ميجابايت'); return
    }
    setBusy(true); setMessage(''); setResult(null)
    const body = new FormData(); body.append('file', file)
    try {
      const { data } = await api.post<ImportResult>('/branches/structure-import', body)
      setResult(data); setFile(null); onImported()
    } catch (error: any) {
      setMessage(error.response?.data?.message ?? 'تعذر تأكيد نتيجة الاستيراد. راجع الهيكل قبل إعادة رفع الملف.')
    } finally { setBusy(false) }
  }

  if (!allowed) return null
  return <section className="bg-white border border-blue-100 rounded-2xl shadow-sm overflow-hidden">
    <button type="button" onClick={() => setOpen(value => !value)} aria-expanded={open} className="w-full p-4 flex items-center gap-3 text-right hover:bg-blue-50/40">
      <span className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 grid place-items-center"><FileSpreadsheet size={20} /></span>
      <span><strong className="block text-sm">استيراد الفروع والأقسام من Excel</strong><small className="text-gray-500">قالب واحد وورقة واحدة للهيكل التنظيمي</small></span>
      <span className="mr-auto text-blue-600 text-sm">{open ? 'إغلاق' : 'فتح'}</span>
    </button>
    {open ? <div className="border-t p-5 space-y-4">
      <div className="rounded-xl bg-slate-50 p-4 text-sm text-slate-600 leading-7">
        <strong className="text-slate-800">طريقة التعبئة:</strong> اكتب اسم الفرع وموقعه في كل صف. أضف اسم القسم إن وجد، ويمكنك تحديد قسم رئيسي في الفرع نفسه. يقرأ النظام الفروع أولًا ثم يربط الأقسام مهما كان ترتيب الصفوف.
      </div>
      <div className="flex flex-wrap gap-3 items-center">
        <button type="button" onClick={downloadTemplate} disabled={busy} className="inline-flex items-center gap-2 border border-blue-200 text-blue-700 px-4 py-2 rounded-xl text-sm"><Download size={16} />تنزيل القالب الموحد</button>
        <label className="inline-flex items-center gap-2 border rounded-xl px-4 py-2 text-sm cursor-pointer hover:border-blue-400"><Upload size={16} /><span>{file?.name || 'اختيار ملف XLSX'}</span><input key={result ? 'done' : 'ready'} type="file" accept=".xlsx" className="sr-only" disabled={busy} onChange={event => { setFile(event.target.files?.[0] ?? null); setMessage('') }} /></label>
        <button type="button" onClick={uploadFile} disabled={!file || busy} className="bg-blue-600 text-white px-5 py-2 rounded-xl text-sm font-bold disabled:opacity-40">{busy ? 'جارٍ الاستيراد…' : 'استيراد الهيكل'}</button>
      </div>
      {message ? <p role="alert" className="text-sm text-red-700">{message}</p> : null}
      {result ? <div role="status" className="space-y-3">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center text-sm">
          <ResultCard label="فروع جديدة" value={result.addedBranches} /><ResultCard label="أقسام جديدة" value={result.addedDepartments} /><ResultCard label="موجود مسبقًا" value={result.skipped} /><ResultCard label="صفوف مرفوضة" value={result.rejected} danger={result.rejected > 0} />
        </div>
        {result.errors.length ? <ResultTable title="الصفوف المرفوضة" rows={result.errors} /> : null}
        {result.skippedRows.length ? <ResultTable title="السجلات الموجودة مسبقًا" rows={result.skippedRows} /> : null}
      </div> : null}
    </div> : null}
  </section>
}

function ResultCard({ label, value, danger = false }: { label: string; value: number; danger?: boolean }) {
  return <div className={`rounded-xl p-3 ${danger ? 'bg-red-50 text-red-700' : 'bg-slate-50 text-slate-700'}`}><strong className="block text-xl">{value}</strong>{label}</div>
}

function ResultTable({ title, rows }: { title: string; rows: { row: number; message: string }[] }) {
  return <div><h3 className="font-bold text-sm mb-2">{title}</h3><div className="max-h-48 overflow-auto border rounded-xl"><table className="w-full text-sm"><thead className="bg-gray-50"><tr><th className="p-2 text-right">صف Excel</th><th className="p-2 text-right">النتيجة</th></tr></thead><tbody>{rows.map((row, index) => <tr key={`${row.row}-${index}`} className="border-t"><td className="p-2">{row.row}</td><td className="p-2">{row.message}</td></tr>)}</tbody></table></div></div>
}
