'use client'

import { useEffect, useRef, useState } from 'react'
import { Download, FileSpreadsheet, Upload, X } from 'lucide-react'
import { api } from '../lib/api'
import { isHR } from '../lib/auth'

interface ImportResult {
  total: number
  added: number
  rejected: number
  skipped: number
  errors: { row: number; message: string }[]
  skippedRows: { row: number; message: string }[]
}

export function JobTitlesImport({ onImported }: { onImported: () => void }) {
  const [allowed, setAllowed] = useState(false)
  const [open, setOpen] = useState(false)
  const [file, setFile] = useState<File | null>(null)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [result, setResult] = useState<ImportResult | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  useEffect(() => setAllowed(isHR()), [])

  async function downloadTemplate() {
    setMessage('')
    try {
      const { data } = await api.get('/job-titles/import-template', { responseType: 'blob' })
      const url = URL.createObjectURL(data)
      const link = document.createElement('a')
      link.href = url
      link.download = 'job-titles-template.xlsx'
      link.click()
      window.setTimeout(() => URL.revokeObjectURL(url), 1000)
    } catch { setMessage('تعذر تنزيل قالب المسميات الوظيفية') }
  }

  async function upload() {
    if (!file || busy) return
    if (!file.name.toLowerCase().endsWith('.xlsx') || file.size > 2 * 1024 * 1024) {
      setMessage('اختر ملف XLSX بحجم لا يتجاوز 2 ميجابايت')
      return
    }
    setBusy(true); setMessage(''); setResult(null)
    const body = new FormData()
    body.append('file', file)
    try {
      const { data } = await api.post<ImportResult>('/job-titles/import', body)
      setResult(data); setFile(null)
      if (inputRef.current) inputRef.current.value = ''
      onImported()
    } catch (error: any) {
      setMessage(error.response?.data?.message ?? 'تعذر استيراد المسميات. راجع الملف وحاول مرة أخرى.')
    } finally { setBusy(false) }
  }

  if (!allowed) return null
  return <section className="wardiya-section overflow-hidden">
    <button type="button" onClick={() => setOpen(value => !value)} aria-expanded={open} className="section-trigger">
      <span className="section-icon"><FileSpreadsheet size={21} /></span>
      <span className="min-w-0"><strong>رفع المسميات الوظيفية</strong><small>أضف جميع المسميات دفعة واحدة من ملف Excel</small></span>
      <span className="section-action">{open ? <><X size={15} /> إغلاق</> : 'فتح النموذج'}</span>
    </button>
    {open ? <div className="section-body space-y-5">
      <div className="info-panel">
        نزّل القالب ثم أدخل المسمى وسلم الدرجات والراتب والبدلات ونسبة التأمينات، وحدد هل تدخل الوظيفة في جدولة الشفتات. يمكن إضافة بدلات مسماة بصيغة موضحة داخل القالب.
      </div>
      <div className="flex flex-wrap gap-3 items-center">
        <button type="button" onClick={downloadTemplate} disabled={busy} className="btn-secondary"><Download size={17} /> تنزيل القالب</button>
        <label className="file-picker"><Upload size={17} /><span className="max-w-52 truncate">{file?.name || 'اختيار ملف XLSX'}</span><input ref={inputRef} type="file" accept=".xlsx" className="sr-only" disabled={busy} onChange={event => { setFile(event.target.files?.[0] ?? null); setMessage('') }} /></label>
        <button type="button" onClick={upload} disabled={!file || busy} className="btn-primary">{busy ? 'جارٍ الاستيراد…' : 'استيراد المسميات'}</button>
      </div>
      {message ? <p role="alert" className="form-error">{message}</p> : null}
      {result ? <div role="status" className="space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Result label="مسميات جديدة" value={result.added} tone="good" />
          <Result label="موجودة مسبقاً" value={result.skipped} />
          <Result label="صفوف مرفوضة" value={result.rejected} tone="danger" />
        </div>
        {result.errors.length ? <Rows title="الصفوف المرفوضة" rows={result.errors} /> : null}
        {result.skippedRows.length ? <Rows title="المسميات الموجودة مسبقاً" rows={result.skippedRows} /> : null}
      </div> : null}
    </div> : null}
  </section>
}

function Result({ label, value, tone }: { label: string; value: number; tone?: 'good' | 'danger' }) {
  return <div className={`import-result ${tone ? `is-${tone}` : ''}`}><strong>{value}</strong><span>{label}</span></div>
}

function Rows({ title, rows }: { title: string; rows: { row: number; message: string }[] }) {
  return <div><h3 className="text-sm font-bold mb-2">{title}</h3><div className="max-h-48 overflow-auto data-frame"><table className="w-full text-sm"><thead><tr><th className="p-3 text-right">صف Excel</th><th className="p-3 text-right">النتيجة</th></tr></thead><tbody>{rows.map((row, index) => <tr key={`${row.row}-${index}`}><td className="p-3">{row.row}</td><td className="p-3">{row.message}</td></tr>)}</tbody></table></div></div>
}
