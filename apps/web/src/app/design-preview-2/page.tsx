'use client'

// اتجاه تصميمي جديد — معاينة معزولة ببيانات وهمية. لا API ولا توكن ولا أثر على أي صفحة قائمة.
import { useEffect, useState } from 'react'
import './preview2.css'

/* اليوم التشغيلي يبدأ بالوردية الصباحية 07:00 وينتهي 07:00 التالية —
   هكذا يفكّر مشغّل الورديات فعلاً، وبه تظهر الوردية الليلية كتلة واحدة
   بدل انقسامها عند منتصف الليل. */
const DAY_START = 8
const DAY_HOURS = 24

/* أطوال غير متساوية عمداً — هكذا هي ورديات فرع عسفان فعلاً في بيانات النظام.
   بها يصبح ترميز «عرض الكتلة = طول الوردية» مقروءاً بدل أن يبدو اعتباطياً. */
const SHIFT_DEFS = [
  { key: 'morning', name: 'شفت الصباح', from: 8,  to: 17, color: 'var(--morning)' },
  { key: 'evening', name: 'شفت الظهر',  from: 17, to: 25, color: 'var(--evening)' },
  { key: 'night',   name: 'شفت الليل',  from: 25, to: 32, color: 'var(--night)'   },
]

const BRANCHES = [
  {
    name: 'الرياض — المقر الرئيسي',
    rows: [
      { shift: 'صباحي', color: 'var(--morning)', present: 18, required: 20 },
      { shift: 'مسائي', color: 'var(--evening)', present: 15, required: 15 },
      { shift: 'ليلي',  color: 'var(--night)',   present: 6,  required: 8  },
    ],
  },
  {
    name: 'جدة',
    rows: [
      { shift: 'صباحي', color: 'var(--morning)', present: 10, required: 10 },
      { shift: 'مسائي', color: 'var(--evening)', present: 10, required: 10 },
      { shift: 'ليلي',  color: 'var(--night)',   present: 4,  required: 4  },
    ],
  },
  {
    // ناقص فعلاً — يطابق بند «الوردية الليلية في عسفان ناقصة 3 حراس» في قائمة القرارات
    name: 'عسفان',
    rows: [
      { shift: 'صباحي', color: 'var(--morning)', present: 14, required: 20 },
      { shift: 'مسائي', color: 'var(--evening)', present: 13, required: 13 },
      { shift: 'ليلي',  color: 'var(--night)',   present: 5,  required: 8  },
    ],
  },
]

const TASKS = [
  { tone: 'crit', title: 'الوردية الليلية في عسفان ناقصة 3 حراس', meta: 'تبدأ بعد ٤ ساعات', cta: 'أسنِد موظفين' },
  { tone: 'crit', title: 'تركي العنزي غائب بلا إذن', meta: 'وردية صباحية — الرياض', cta: 'سجّل الحالة' },
  { tone: 'warn', title: '٧ طلبات إجازة تنتظر قرارك', meta: 'أقدمها معلّق منذ يومين', cta: 'راجع الطلبات' },
  { tone: 'warn', title: 'هوية فهد القرني تنتهي خلال ١٢ يوماً', meta: 'يلزم تحديث المستند', cta: 'افتح الملف' },
  { tone: 'ok',   title: 'خطة تدوير «الأمن» تنتهي الأحد', meta: 'طبّقها لتوليد جدول الأسبوع القادم', cta: 'طبّق الخطة' },
]

const NAV_MAIN = [
  { label: 'لوحة التحكم', active: true },
  { label: 'صفحتي' },
]
const NAV_OPS = [
  { label: 'الجدول والورديات' },
  { label: 'الحضور والانصراف' },
  { label: 'الموظفون' },
]
const NAV_ADMIN = [
  { label: 'الإجازات' },
  { label: 'اعتماد الطلبات' },
  { label: 'الرواتب' },
]

/* أرقام الشريط مشتقّة من الفروع — مصدر واحد للحقيقة، فلا يمكن أن تتناقض الإجماليات */
const SHIFTS = SHIFT_DEFS.map((def, i) => ({
  ...def,
  present: BRANCHES.reduce((s, b) => s + b.rows[i].present, 0),
  required: BRANCHES.reduce((s, b) => s + b.rows[i].required, 0),
}))

const pct = (present: number, required: number) =>
  required === 0 ? 100 : Math.min(100, Math.round((present / required) * 100))

function coverageTone(present: number, required: number) {
  if (present >= required) return 'ok'
  if (present / required >= 0.85) return 'warn'
  return 'crit'
}

export default function DesignPreview2() {
  // موضع علامة «الآن» على شريط اليوم — يُحسب بعد التركيب تفادياً لاختلاف الخادم/المتصفح
  const [nowPct, setNowPct] = useState<number | null>(null)
  useEffect(() => {
    const d = new Date()
    const h = d.getHours() + d.getMinutes() / 60
    const offset = (h - DAY_START + DAY_HOURS) % DAY_HOURS
    setNowPct((offset / DAY_HOURS) * 100)
  }, [])

  const totalPresent = SHIFTS.reduce((s, x) => s + x.present, 0)
  const totalRequired = SHIFTS.reduce((s, x) => s + x.required, 0)

  return (
    <div className="dp2">
      <div className="dp2-shell">
        <aside className="dp2-rail">
          <div className="dp2-brand">
            <div className="dp2-brand-mark">أ</div>
            <div className="dp2-brand-text">
              <div className="dp2-brand-name">شركة الأفق</div>
              <div className="dp2-brand-sub">للتجارة والمقاولات</div>
            </div>
          </div>

          {[
            { label: 'الرئيسية', items: NAV_MAIN },
            { label: 'التشغيل', items: NAV_OPS },
            { label: 'الإدارة', items: NAV_ADMIN },
          ].map((group) => (
            <div className="dp2-navgroup" key={group.label}>
              <div className="dp2-navlabel">{group.label}</div>
              {group.items.map((it) => (
                <button
                  key={it.label}
                  className="dp2-nav"
                  {...('active' in it && it.active ? { 'aria-current': 'page' as const } : {})}
                >
                  <span className="dp2-nav-dot" />
                  <span>{it.label}</span>
                </button>
              ))}
            </div>
          ))}

          <div className="dp2-me">
            <div className="dp2-avatar">م</div>
            <div className="dp2-me-text">
              <div className="dp2-me-name">منى الحربي</div>
              <div className="dp2-me-role">مديرة الموارد البشرية</div>
            </div>
          </div>
        </aside>

        <main className="dp2-main">
          <div className="dp2-head">
            <div>
              <h1 className="dp2-title">تغطية اليوم</h1>
              <p className="dp2-sub">الخميس ٦ أغسطس ٢٠٢٦ · ثلاثة فروع · ثلاث ورديات</p>
            </div>
            <span className={`dp2-pill dp2-pill-${coverageTone(totalPresent, totalRequired)}`}>
              <span className="num">{totalPresent}</span> من <span className="num">{totalRequired}</span> موقعاً مشغولاً
            </span>
          </div>

          {/* ── التوقيع: شريط اليوم ── */}
          <section className="dp2-band-card">
            <div className="dp2-band-head">
              <h2 className="dp2-band-title">شريط اليوم</h2>
              <span className="dp2-band-note">يبدأ 08:00 وينتهي 08:00 — عرض الكتلة يوازي طول الوردية، والتعبئة توازي نسبة الحضور</span>
            </div>

            <div className="dp2-band">
              {SHIFTS.map((s) => {
                const hours = s.to - s.from
                const fill = pct(s.present, s.required)
                return (
                  <div
                    key={s.key}
                    className="dp2-seg"
                    style={{ flex: `${hours} 1 0`, boxShadow: `inset 0 0 0 1px ${s.color}33` }}
                  >
                    <div className="dp2-seg-fill" style={{ width: `${fill}%`, background: s.color }} />
                    <div className="dp2-seg-inner">
                      <div className="dp2-seg-name">
                        <span className="dp2-seg-swatch" style={{ background: s.color }} />
                        {s.name}
                      </div>
                      <div className="dp2-seg-hours num">
                        {String(s.from % 24).padStart(2, '0')}:00 — {String(s.to % 24).padStart(2, '0')}:00 · {hours} ساعات
                      </div>
                      <div className="dp2-seg-count num">
                        {s.present}<span> / {s.required} موظف</span>
                      </div>
                    </div>
                  </div>
                )
              })}
              {nowPct !== null && <div className="dp2-now" style={{ right: `${nowPct}%` }} />}
            </div>
          </section>

          <div className="dp2-grid">
            <section className="dp2-card">
              <div className="dp2-card-head">
                <h2 className="dp2-card-title">التغطية حسب الفرع</h2>
                <span className="dp2-card-note">المقارنة بالحد الأدنى المُهيّأ لكل وردية</span>
              </div>
              {BRANCHES.map((b) => {
                const bp = b.rows.reduce((s, r) => s + r.present, 0)
                const br = b.rows.reduce((s, r) => s + r.required, 0)
                const tone = coverageTone(bp, br)
                return (
                  <div className="dp2-branch" key={b.name}>
                    <div className="dp2-branch-name">
                      <span>{b.name}</span>
                      <span className={`dp2-pill dp2-pill-${tone}`}>
                        {tone === 'ok' ? 'مكتمل' : tone === 'warn' ? 'نقص طفيف' : 'نقص'}
                      </span>
                    </div>
                    {b.rows.map((r) => (
                      <div className="dp2-mini" key={r.shift}>
                        <span className="dp2-mini-name">{r.shift}</span>
                        <span className="dp2-track">
                          <span
                            className="dp2-track-fill"
                            style={{ width: `${pct(r.present, r.required)}%`, background: r.color }}
                          />
                        </span>
                        <span className="dp2-mini-val num">{r.present} / {r.required}</span>
                      </div>
                    ))}
                  </div>
                )
              })}
            </section>

            <section className="dp2-card">
              <div className="dp2-card-head">
                <h2 className="dp2-card-title">يحتاج قرارك</h2>
                <span className="dp2-card-note num">{TASKS.length} بنود</span>
              </div>
              {TASKS.map((t) => (
                <div className="dp2-task" key={t.title}>
                  <span className="dp2-task-bar" style={{ background: `var(--${t.tone})` }} />
                  <div style={{ minWidth: 0 }}>
                    <div className="dp2-task-title">{t.title}</div>
                    <div className="dp2-task-meta">{t.meta}</div>
                  </div>
                  <button className="dp2-btn">{t.cta}</button>
                </div>
              ))}
            </section>
          </div>
        </main>
      </div>
    </div>
  )
}
