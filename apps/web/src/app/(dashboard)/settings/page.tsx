'use client'

import { useEffect, useState } from 'react'
import { FileSignature, ImageUp, Save, Stamp } from 'lucide-react'
import { useAuth } from '../../../hooks/useAuth'
import { api } from '../../../lib/api'
import { isHR } from '../../../lib/auth'

const API_URL = (process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000').replace(/\/$/, '')
const DEFAULT_SALARY = 'تشهد {اسم_الشركة} بأن الموظف/ة {اسم_الموظف}، رقم وظيفي {الرقم_الوظيفي}، يعمل لدينا بمسمى {المسمى_الوظيفي} منذ تاريخ {تاريخ_التعيين}، ويتقاضى راتباً شهرياً موضحاً أدناه. وقد أُعطي هذا التعريف بناءً على طلبه دون أدنى مسؤولية على الشركة.'
const DEFAULT_EMPLOYMENT = 'تشهد {اسم_الشركة} بأن الموظف/ة {اسم_الموظف}، رقم وظيفي {الرقم_الوظيفي}، يعمل لدينا بمسمى {المسمى_الوظيفي} في قسم {القسم} منذ تاريخ {تاريخ_التعيين}. وقد أُعطي هذا التعريف بناءً على طلبه دون أدنى مسؤولية على الشركة.'

interface Settings {
  name: string
  logo: string | null
  salaryCertificateText: string | null
  employmentCertificateText: string | null
  certificateSignature: string | null
  certificateStamp: string | null
}

export default function SettingsPage() {
  useAuth()
  const [allowed, setAllowed] = useState(false)
  const [settings, setSettings] = useState<Settings | null>(null)
  const [salaryText, setSalaryText] = useState(DEFAULT_SALARY)
  const [employmentText, setEmploymentText] = useState(DEFAULT_EMPLOYMENT)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')

  useEffect(() => {
    setAllowed(isHR())
    api.get<Settings>('/tenants/certificate-settings').then(({ data }) => {
      setSettings(data)
      setSalaryText(data.salaryCertificateText || DEFAULT_SALARY)
      setEmploymentText(data.employmentCertificateText || DEFAULT_EMPLOYMENT)
    }).catch(() => setMessage('تعذر تحميل إعدادات التعاريف'))
  }, [])

  async function save() {
    setSaving(true); setMessage('')
    try {
      const { data } = await api.put<Settings>('/tenants/certificate-settings', {
        salaryCertificateText: salaryText,
        employmentCertificateText: employmentText,
      })
      setSettings(data); setMessage('تم حفظ قوالب التعاريف')
    } catch (e: any) { setMessage(e.response?.data?.message ?? 'تعذر حفظ القوالب') }
    finally { setSaving(false) }
  }

  async function upload(kind: 'signature' | 'stamp', file?: File) {
    if (!file) return
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type) || file.size > 3 * 1024 * 1024) {
      setMessage('اختر صورة PNG أو JPG أو WebP بحجم لا يتجاوز 3 ميجابايت'); return
    }
    setMessage('جارٍ رفع الصورة…')
    const body = new FormData(); body.append('file', file)
    try {
      const { data } = await api.post<Settings>(`/tenants/certificate-assets/${kind}`, body)
      setSettings(data); setMessage(kind === 'signature' ? 'تم حفظ التوقيع' : 'تم حفظ الختم')
    } catch (e: any) { setMessage(e.response?.data?.message ?? 'تعذر رفع الصورة') }
  }

  if (!allowed) return <div className="p-6 text-gray-500">إعداد قوالب التعاريف متاح لإدارة الموارد البشرية فقط.</div>
  if (!settings) return <div className="p-6 text-gray-500">جارٍ تحميل الإعدادات…</div>

  return (
    <main className="p-6 max-w-5xl mx-auto">
      <header className="mb-7">
        <p className="text-blue-600 text-sm font-bold mb-2">شؤون الموظفين</p>
        <h1 className="text-3xl font-black text-gray-900">قوالب التعاريف الرسمية</h1>
        <p className="text-gray-500 mt-2">اضبط الصياغة المعتمدة والتوقيع والختم مرة واحدة، وسيستخدمها النظام عند طباعة أي تعريف.</p>
      </header>

      <div className="grid lg:grid-cols-[1fr_300px] gap-5 items-start">
        <section className="space-y-5">
          <TemplateEditor title="تعريف بالراتب" value={salaryText} onChange={setSalaryText} />
          <TemplateEditor title="تعريف بدون راتب" value={employmentText} onChange={setEmploymentText} />
          <div className="flex items-center gap-4">
            <button onClick={save} disabled={saving || !salaryText.trim() || !employmentText.trim()} className="inline-flex items-center gap-2 bg-blue-600 text-white px-5 py-2.5 rounded-xl font-bold disabled:opacity-40"><Save size={17} />{saving ? 'جارٍ الحفظ…' : 'حفظ القوالب'}</button>
            {message ? <p role="status" className="text-sm text-gray-600">{message}</p> : null}
          </div>
        </section>

        <aside className="bg-white border rounded-2xl p-5 shadow-sm lg:sticky lg:top-6">
          <h2 className="font-black mb-1">اعتماد الخطاب</h2>
          <p className="text-xs text-gray-500 mb-5">يفضّل استخدام PNG بخلفية شفافة.</p>
          <AssetUpload title="التوقيع" icon={<FileSignature size={18} />} url={settings.certificateSignature} onChange={file => upload('signature', file)} />
          <AssetUpload title="الختم" icon={<Stamp size={18} />} url={settings.certificateStamp} onChange={file => upload('stamp', file)} />
        </aside>
      </div>
    </main>
  )
}

function TemplateEditor({ title, value, onChange }: { title: string; value: string; onChange: (value: string) => void }) {
  return <article className="bg-white border rounded-2xl p-5 shadow-sm">
    <div className="flex items-center gap-3 mb-4"><span className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 grid place-items-center"><FileSignature size={20} /></span><div><h2 className="font-black">{title}</h2><p className="text-xs text-gray-500">يمكنك تعديل النص واستخدام الحقول الديناميكية أدناه.</p></div></div>
    <textarea value={value} onChange={e => onChange(e.target.value)} maxLength={5000} rows={7} className="w-full border rounded-xl p-4 leading-8 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
    <div className="mt-3 flex flex-wrap gap-2">{['{اسم_الشركة}', '{اسم_الموظف}', '{الرقم_الوظيفي}', '{رقم_الهوية}', '{الجنسية}', '{المسمى_الوظيفي}', '{القسم}', '{الفرع}', '{تاريخ_التعيين}', '{تاريخ_الإصدار}', '{الجهة}'].map(tag => <code key={tag} className="text-[11px] bg-gray-100 text-gray-600 px-2 py-1 rounded-md">{tag}</code>)}</div>
  </article>
}

function AssetUpload({ title, icon, url, onChange }: { title: string; icon: React.ReactNode; url: string | null; onChange: (file?: File) => void }) {
  return <label className="block border rounded-xl p-3 mb-3 cursor-pointer hover:border-blue-400 transition">
    <span className="flex items-center gap-2 font-bold text-sm mb-3">{icon}{title}<ImageUp size={15} className="mr-auto text-blue-600" /></span>
    {url ? <img src={`${API_URL}${url}`} alt={title} className="h-24 w-full object-contain bg-gray-50 rounded-lg" /> : <span className="h-20 grid place-items-center rounded-lg bg-gray-50 text-xs text-gray-400">اختياري · اضغط للرفع</span>}
    <input type="file" className="sr-only" accept="image/png,image/jpeg,image/webp" onChange={e => onChange(e.target.files?.[0])} />
  </label>
}
