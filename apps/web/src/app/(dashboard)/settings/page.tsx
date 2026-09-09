'use client'

import { useEffect, useState } from 'react'
import { Eye, FileSignature, ImageUp, LayoutPanelTop, Save, Stamp } from 'lucide-react'
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
  certificateHeader: string | null
  certificateFooter: string | null
  certificateSignerName: string | null
  certificateSignerTitle: string | null
  payrollInsuranceRate: number
  payrollBasicRate: number
  payrollHousingRate: number
  payrollTransportRate: number
}

export default function SettingsPage() {
  useAuth()
  const [allowed, setAllowed] = useState(false)
  const [settings, setSettings] = useState<Settings | null>(null)
  const [salaryText, setSalaryText] = useState(DEFAULT_SALARY)
  const [employmentText, setEmploymentText] = useState(DEFAULT_EMPLOYMENT)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [previewType, setPreviewType] = useState<'salary' | 'employment'>('salary')
  const [signerName, setSignerName] = useState('')
  const [signerTitle, setSignerTitle] = useState('إدارة شؤون الموظفين')
  const [insuranceRate, setInsuranceRate] = useState('0')
  const [basicRate, setBasicRate] = useState('65')
  const [housingRate, setHousingRate] = useState('25')
  const [transportRate, setTransportRate] = useState('10')

  useEffect(() => {
    setAllowed(isHR())
    api.get<Settings>('/tenants/certificate-settings').then(({ data }) => {
      setSettings(data)
      setSalaryText(data.salaryCertificateText || DEFAULT_SALARY)
      setEmploymentText(data.employmentCertificateText || DEFAULT_EMPLOYMENT)
      setSignerName(data.certificateSignerName || '')
      setSignerTitle(data.certificateSignerTitle || 'إدارة شؤون الموظفين')
      setInsuranceRate(String(data.payrollInsuranceRate ?? 0))
      setBasicRate(String(data.payrollBasicRate ?? 65))
      setHousingRate(String(data.payrollHousingRate ?? 25))
      setTransportRate(String(data.payrollTransportRate ?? 10))
    }).catch(() => setMessage('تعذر تحميل إعدادات التعاريف'))
  }, [])

  async function save() {
    const allocationTotal = Number(basicRate) + Number(housingRate) + Number(transportRate)
    if (Math.abs(allocationTotal - 100) > 0.001) { setMessage('يجب أن يكون مجموع نسب الأساسي والسكن والمواصلات 100٪'); return }
    setSaving(true); setMessage('')
    try {
      const { data } = await api.put<Settings>('/tenants/certificate-settings', {
        salaryCertificateText: salaryText,
        employmentCertificateText: employmentText,
        certificateSignerName: signerName,
        certificateSignerTitle: signerTitle,
        payrollInsuranceRate: Number(insuranceRate) || 0,
        payrollBasicRate: Number(basicRate) || 0,
        payrollHousingRate: Number(housingRate) || 0,
        payrollTransportRate: Number(transportRate) || 0,
      })
      setSettings(data); setMessage('تم حفظ قوالب التعاريف')
    } catch (e: any) { setMessage(e.response?.data?.message ?? 'تعذر حفظ القوالب') }
    finally { setSaving(false) }
  }

  async function upload(kind: 'signature' | 'stamp' | 'header' | 'footer', file?: File) {
    if (!file) return
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type) || file.size > 3 * 1024 * 1024) {
      setMessage('اختر صورة PNG أو JPG أو WebP بحجم لا يتجاوز 3 ميجابايت'); return
    }
    setMessage('جارٍ رفع الصورة…')
    const body = new FormData(); body.append('file', file)
    try {
      const { data } = await api.post<Settings>(`/tenants/certificate-assets/${kind}`, body)
      const labels = { signature: 'التوقيع', stamp: 'الختم', header: 'الهيدر', footer: 'الفوتر' }
      setSettings(data); setMessage(`تم حفظ ${labels[kind]}`)
    } catch (e: any) { setMessage(e.response?.data?.message ?? 'تعذر رفع الصورة') }
  }

  if (!allowed) return <div className="p-6 text-gray-500">إعداد قوالب التعاريف متاح لإدارة الموارد البشرية فقط.</div>
  if (!settings) return <div className="p-6 text-gray-500">جارٍ تحميل الإعدادات…</div>

  return (
    <main className="p-6 max-w-7xl mx-auto">
      <header className="mb-7">
        <p className="text-blue-600 text-sm font-bold mb-2">شؤون الموظفين</p>
        <h1 className="text-3xl font-black text-gray-900">قوالب التعاريف الرسمية</h1>
        <p className="text-gray-500 mt-2">اضبط الصياغة المعتمدة والتوقيع والختم مرة واحدة، وسيستخدمها النظام عند طباعة أي تعريف.</p>
      </header>

      <div className="grid xl:grid-cols-[minmax(0,1fr)_340px] gap-5 items-start">
        <section className="space-y-5">
          <article className="wardiya-section p-5">
            <div><p className="text-xs font-bold text-blue-600">إعداد موحد لجميع الرواتب</p><h2 className="mt-1 font-black">توزيع الراتب والاستقطاعات</h2><p className="mt-1 text-xs text-slate-500">عدّل نسب توزيع إجمالي راتب الدرجة. يجب أن يكون مجموع مكونات الراتب 100٪.</p></div>
            <div className="mt-5 grid grid-cols-2 md:grid-cols-4 gap-3">
              <RateField id="basic-rate" label="الراتب الأساسي" value={basicRate} onChange={setBasicRate} />
              <RateField id="housing-rate" label="بدل السكن" value={housingRate} onChange={setHousingRate} />
              <RateField id="transport-rate" label="بدل المواصلات" value={transportRate} onChange={setTransportRate} />
              <RateField id="insurance-rate" label="استقطاع التأمينات" value={insuranceRate} onChange={setInsuranceRate} />
            </div>
            <div className={`mt-4 rounded-xl px-4 py-3 text-sm font-bold ${Math.abs(Number(basicRate) + Number(housingRate) + Number(transportRate) - 100) < .001 ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>مجموع مكونات الراتب: {(Number(basicRate) + Number(housingRate) + Number(transportRate)).toLocaleString('ar-SA')}٪ {Math.abs(Number(basicRate) + Number(housingRate) + Number(transportRate) - 100) < .001 ? '✓' : '— يجب أن يساوي 100٪'}</div>
          </article>
          <TemplateEditor title="إفادة" value={salaryText} onChange={setSalaryText} />
          <TemplateEditor title="تعريف بدون راتب" value={employmentText} onChange={setEmploymentText} />
          <div className="flex items-center gap-4">
            <button onClick={save} disabled={saving || !salaryText.trim() || !employmentText.trim()} className="inline-flex items-center gap-2 bg-blue-600 text-white px-5 py-2.5 rounded-xl font-bold disabled:opacity-40"><Save size={17} />{saving ? 'جارٍ الحفظ…' : 'حفظ القوالب'}</button>
            {message ? <p role="status" className="text-sm text-gray-600">{message}</p> : null}
          </div>
        </section>

        <aside className="space-y-5 xl:sticky xl:top-6">
          <section className="wardiya-section p-5">
            <h2 className="font-black mb-1">هوية الخطاب</h2>
            <p className="text-xs text-gray-500 mb-5">استخدم صورًا أفقية واضحة للهيدر والفوتر، وPNG شفافًا للتوقيع والختم.</p>
            <AssetUpload title="هيدر الخطاب" hint="مقترح 1600 × 240 بكسل" icon={<LayoutPanelTop size={18} />} url={settings.certificateHeader} wide onChange={file => upload('header', file)} />
            <AssetUpload title="فوتر الخطاب" hint="مقترح 1600 × 180 بكسل" icon={<LayoutPanelTop size={18} className="rotate-180" />} url={settings.certificateFooter} wide onChange={file => upload('footer', file)} />
            <div className="grid grid-cols-2 gap-3">
              <AssetUpload title="التوقيع" icon={<FileSignature size={18} />} url={settings.certificateSignature} compact onChange={file => upload('signature', file)} />
              <AssetUpload title="الختم" icon={<Stamp size={18} />} url={settings.certificateStamp} compact onChange={file => upload('stamp', file)} />
            </div>
            <div className="mt-4 pt-4 border-t space-y-3">
              <div className="field-group"><label htmlFor="signer-name">اسم معتمد الإفادة</label><input id="signer-name" value={signerName} onChange={e => setSignerName(e.target.value)} maxLength={150} placeholder="مثال: أحمد محمد" className="w-full" /></div>
              <div className="field-group">
                <label>منصب معتمد الإفادة</label>
                <div className="grid grid-cols-2 gap-2 rounded-xl bg-slate-100 p-1">
                  <button type="button" onClick={() => setSignerTitle('إدارة شؤون الموظفين')} className={`rounded-lg px-3 py-2 text-xs font-bold transition ${signerTitle === 'إدارة شؤون الموظفين' ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-500'}`}>إدارة شؤون الموظفين</button>
                  <button type="button" onClick={() => signerTitle === 'إدارة شؤون الموظفين' && setSignerTitle('')} className={`rounded-lg px-3 py-2 text-xs font-bold transition ${signerTitle !== 'إدارة شؤون الموظفين' ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-500'}`}>مسمى آخر</button>
                </div>
                {signerTitle !== 'إدارة شؤون الموظفين' ? <input id="signer-title" value={signerTitle} onChange={e => setSignerTitle(e.target.value)} maxLength={150} placeholder="مثال: مدير الموارد البشرية" className="mt-2 w-full" autoFocus /> : null}
              </div>
            </div>
          </section>
        </aside>
      </div>

      <section className="wardiya-section mt-6 overflow-hidden">
        <div className="p-5 border-b flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3"><span className="section-icon"><Eye size={20} /></span><div><h2 className="font-black">معاينة الخطاب</h2><p className="text-xs text-gray-500 mt-1">تتحدث المعاينة مباشرة أثناء تعديل النص أو رفع الصور.</p></div></div>
          <div className="flex bg-gray-100 rounded-xl p-1">
            <button onClick={() => setPreviewType('salary')} className={`px-4 py-2 rounded-lg text-xs font-bold ${previewType === 'salary' ? 'bg-white text-blue-700 shadow-sm' : 'text-gray-500'}`}>إفادة</button>
            <button onClick={() => setPreviewType('employment')} className={`px-4 py-2 rounded-lg text-xs font-bold ${previewType === 'employment' ? 'bg-white text-blue-700 shadow-sm' : 'text-gray-500'}`}>بدون راتب</button>
          </div>
        </div>
        <div className="p-4 sm:p-7 bg-slate-100 overflow-auto">
          <CertificatePreview settings={settings} type={previewType} text={previewType === 'salary' ? salaryText : employmentText} signerName={signerName} signerTitle={signerTitle} />
        </div>
      </section>
    </main>
  )
}

function RateField({ id, label, value, onChange }: { id: string; label: string; value: string; onChange: (value: string) => void }) {
  return <div className="field-group"><label htmlFor={id}>{label} (%)</label><input id={id} type="number" min="0" max="100" step="0.01" value={value} onChange={e => onChange(e.target.value)} className="w-full" /></div>
}

function TemplateEditor({ title, value, onChange }: { title: string; value: string; onChange: (value: string) => void }) {
  return <article className="bg-white border rounded-2xl p-5 shadow-sm">
    <div className="flex items-center gap-3 mb-4"><span className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 grid place-items-center"><FileSignature size={20} /></span><div><h2 className="font-black">{title}</h2><p className="text-xs text-gray-500">يمكنك تعديل النص واستخدام الحقول الديناميكية أدناه.</p></div></div>
    <textarea value={value} onChange={e => onChange(e.target.value)} maxLength={5000} rows={7} className="w-full border rounded-xl p-4 leading-8 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
    <div className="mt-3 flex flex-wrap gap-2">{['{اسم_الشركة}', '{اسم_الموظف}', '{الرقم_الوظيفي}', '{رقم_الهوية}', '{الجنسية}', '{المسمى_الوظيفي}', '{القسم}', '{الفرع}', '{تاريخ_التعيين}', '{تاريخ_الإصدار}', '{الجهة}'].map(tag => <code key={tag} className="text-[11px] bg-gray-100 text-gray-600 px-2 py-1 rounded-md">{tag}</code>)}</div>
  </article>
}

function AssetUpload({ title, hint, icon, url, wide = false, compact = false, onChange }: { title: string; hint?: string; icon: React.ReactNode; url: string | null; wide?: boolean; compact?: boolean; onChange: (file?: File) => void }) {
  return <label className={`block border rounded-xl p-3 cursor-pointer hover:border-blue-400 transition ${wide ? 'mb-3' : ''}`}>
    <span className="flex items-center gap-2 font-bold text-xs mb-2">{icon}{title}<ImageUp size={14} className="mr-auto text-blue-600" /></span>
    {hint ? <small className="block text-[10px] text-gray-400 mb-2">{hint}</small> : null}
    {url ? <img src={`${API_URL}${url}`} alt={title} className={`${compact ? 'h-16' : wide ? 'h-20' : 'h-24'} w-full object-contain bg-gray-50 rounded-lg`} /> : <span className={`${compact ? 'h-16' : 'h-20'} grid place-items-center rounded-lg bg-gray-50 text-[10px] text-gray-400 text-center px-2`}>اضغط للرفع</span>}
    <input type="file" className="sr-only" accept="image/png,image/jpeg,image/webp" onChange={e => onChange(e.target.files?.[0])} />
  </label>
}

function CertificatePreview({ settings, type, text, signerName, signerTitle }: { settings: Settings; type: 'salary' | 'employment'; text: string; signerName: string; signerTitle: string }) {
  const fields: Record<string, string> = {
    '{اسم_الشركة}': settings.name, '{اسم_الموظف}': 'محمد أحمد العتيبي', '{الرقم_الوظيفي}': 'WRD-1024',
    '{رقم_الهوية}': '10XXXXXXXX', '{الجنسية}': 'سعودي', '{المسمى_الوظيفي}': 'أخصائي موارد بشرية',
    '{القسم}': 'الموارد البشرية', '{الفرع}': 'المقر الرئيسي', '{تاريخ_التعيين}': '١٤٤٦/٠١/١٥',
    '{تاريخ_الإصدار}': new Date().toLocaleDateString('ar-SA'), '{الجهة}': 'إلى من يهمه الأمر',
  }
  let preview = text
  for (const [key, value] of Object.entries(fields)) preview = preview.replaceAll(key, value)
  const url = (path: string | null) => path ? `${API_URL}${path}` : ''
  return <article className="relative bg-white text-slate-900 mx-auto w-[794px] min-h-[1040px] shadow-xl border border-slate-200 px-16 pt-10 pb-28" dir="rtl">
    {settings.certificateHeader ? <img src={url(settings.certificateHeader)} alt="هيدر الخطاب" className="w-full h-28 object-contain object-top" /> : <header className="flex items-center justify-between border-b-[3px] border-blue-500 pb-5"><strong className="text-xl">{settings.name}</strong>{settings.logo ? <img src={url(settings.logo)} alt="شعار الشركة" className="w-24 h-16 object-contain" /> : null}</header>}
    <div className="mt-4 text-xs text-slate-500">التاريخ: {new Date().toLocaleDateString('ar-SA')}</div>
    <h1 className="text-center text-2xl font-black mt-9">إفادة</h1>
    <p className="text-center text-sm text-slate-600 mt-2 mb-8">إلى: <strong>إلى من يهمه الأمر</strong></p>
    <p className="text-[15px] leading-9 text-justify whitespace-pre-wrap min-h-44">{preview}</p>
    {type === 'salary' ? <table className="w-full text-sm mt-6 border-collapse"><tbody><tr><td className="border p-3">الراتب الأساسي</td><td className="border p-3">٨٬٠٠٠ ر.س</td></tr><tr><td className="border p-3">إجمالي البدلات</td><td className="border p-3">٢٬٠٠٠ ر.س</td></tr><tr className="bg-blue-50 font-bold"><td className="border p-3">الراتب الصافي</td><td className="border p-3">٩٬٢٥٠ ر.س</td></tr></tbody></table> : null}
    <div className="mt-12 mr-auto w-64 text-center">{signerTitle.trim() ? <strong className="block text-sm">{signerTitle}</strong> : null}{signerName.trim() ? <span className="block text-xs text-slate-600 mt-1">{signerName}</span> : null}<div className="h-24 flex items-center justify-center gap-2">{settings.certificateSignature ? <img src={url(settings.certificateSignature)} alt="التوقيع" className="max-w-28 max-h-20 object-contain" /> : null}{settings.certificateStamp ? <img src={url(settings.certificateStamp)} alt="الختم" className="max-w-28 max-h-20 object-contain" /> : null}</div></div>
    <footer className="absolute bottom-5 left-16 right-16">{settings.certificateFooter ? <img src={url(settings.certificateFooter)} alt="فوتر الخطاب" className="w-full h-20 object-contain object-bottom" /> : <p className="border-t pt-2 text-center text-[10px] text-slate-500">صدر هذا التعريف إلكترونيًا من نظام وردية لصالح {settings.name}</p>}</footer>
  </article>
}
