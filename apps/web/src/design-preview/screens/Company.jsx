import { useState } from 'react';
import { Button, Tag, Card, Field, inputClass, th, td } from '../ui/Primitives';
import {
  employees, coverage, activity, leaveHistory, statusVariant, shiftVariant,
  attendanceCompany, branches, departments, payrollSeed, auditLog, roles,
} from '../data/sampleData';

const weekdays = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];

export function Dashboard() {
  const kpis = [
    ['الحضور اليوم', '142/150', '94.7٪'],
    ['فجوة التغطية', '3', 'ورديات دون الحد الأدنى'],
    ['بانتظار الاعتماد', '7', 'طلبات معلّقة'],
    ['الموظفون النشطون', '150', 'في فرعين'],
  ];
  return (
    <div>
      <h1 className="text-3xl font-heading font-extrabold mb-1">لوحة التحكم</h1>
      <p className="opacity-60 mb-4">نظرة عامة على اليوم — الخميس 6 أغسطس 2026</p>
      <div className="grid grid-cols-4 gap-4 mb-8">
        {kpis.map(([label, value, sub]) => (
          <div key={label} className="bg-surface border border-line p-4">
            <div className="text-xs opacity-60">{label}</div>
            <div className="font-heading font-extrabold text-3xl">{value}</div>
            <div className="text-xs opacity-60">{sub}</div>
          </div>
        ))}
      </div>
      <h3 className="text-xl font-heading font-extrabold mb-2">تغطية الورديات</h3>
      <table className="w-full mb-8">
        <thead><tr><th className={th}>الفرع</th><th className={th}>الوردية</th><th className={th}>المطلوب</th><th className={th}>الحاضر</th><th className={th}>الحالة</th></tr></thead>
        <tbody>
          {coverage.map((c, i) => (
            <tr key={i}>
              <td className={td}>{c.branch}</td><td className={td}>{c.shift}</td><td className={td}>{c.need}</td><td className={td}>{c.have}</td>
              <td className={td}><Tag variant={c.have < c.need ? 'accent' : 'outline'}>{c.have < c.need ? 'نقص' : 'مكتمل'}</Tag></td>
            </tr>
          ))}
        </tbody>
      </table>
      <h3 className="text-xl font-heading font-extrabold mb-2">النشاط الأخير</h3>
      {activity.map((a, i) => (
        <div key={i} className="flex justify-between py-3 border-b border-line">
          <span>{a.text}</span><span className="text-xs opacity-60">{a.time}</span>
        </div>
      ))}
    </div>
  );
}

export function Roster({ onOpenEmployee }) {
  return (
    <div>
      <h1 className="text-3xl font-heading font-extrabold mb-1">الموظفون</h1>
      <p className="opacity-60 mb-4">8 موظفين — فرع الرياض وفرع جدة</p>
      <table className="w-full">
        <thead><tr><th className={th}>الكود</th><th className={th}>الاسم</th><th className={th}>الفرع</th><th className={th}>القسم</th><th className={th}>المسمى الوظيفي</th><th className={th}>الحالة</th></tr></thead>
        <tbody>
          {employees.map((e) => (
            <tr key={e.code} className="cursor-pointer" onClick={() => onOpenEmployee(e.code)}>
              <td className={`${td} opacity-60`}>{e.code}</td><td className={td}>{e.name}</td><td className={td}>{e.branch}</td>
              <td className={td}>{e.dept}</td><td className={td}>{e.title}</td>
              <td className={td}><Tag variant={statusVariant(e.status)}>{e.status}</Tag></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function EmployeeDetail({ code, onBack }) {
  const e = employees.find((x) => x.code === code) || employees[0];
  return (
    <div>
      <div className="text-sm opacity-60 cursor-pointer mb-2" onClick={onBack}>→ رجوع للموظفين</div>
      <h1 className="text-3xl font-heading font-extrabold mb-1">{e.name}</h1>
      <p className="opacity-60 mb-4">{e.title} <Tag variant={statusVariant(e.status)}>{e.status}</Tag></p>
      <div className="grid grid-cols-2 gap-4 max-w-xl mb-8">
        <div><div className="text-xs opacity-60">الكود</div><div>{e.code}</div></div>
        <div><div className="text-xs opacity-60">تاريخ التعيين</div><div>{e.hireDate}</div></div>
        <div><div className="text-xs opacity-60">الفرع</div><div>{e.branch}</div></div>
        <div><div className="text-xs opacity-60">القسم</div><div>{e.dept}</div></div>
      </div>
      <h3 className="text-xl font-heading font-extrabold mb-2">الجدول الأسبوعي</h3>
      <table className="max-w-2xl">
        <thead><tr>{weekdays.map((d) => <th key={d} className={th}>{d}</th>)}</tr></thead>
        <tbody><tr>{e.cells.map((c, i) => <td key={i} className={td}><Tag variant={shiftVariant(c)}>{c}</Tag></td>)}</tr></tbody>
      </table>
    </div>
  );
}

export function Schedule() {
  return (
    <div>
      <h1 className="text-3xl font-heading font-extrabold mb-1">الجدول والورديات</h1>
      <p className="opacity-60 mb-4">الأسبوع من 3 إلى 9 أغسطس 2026</p>
      <table className="w-full">
        <thead><tr><th className={th}>الموظف</th>{weekdays.map((d) => <th key={d} className={th}>{d}</th>)}</tr></thead>
        <tbody>
          {employees.map((e) => (
            <tr key={e.code}>
              <td className={td}>{e.name}</td>
              {e.cells.map((c, i) => <td key={i} className={td}><Tag variant={shiftVariant(c)}>{c}</Tag></td>)}
            </tr>
          ))}
        </tbody>
      </table>
      <p className="text-xs opacity-60 mt-3">ص = صباحي · م = مسائي · ل = ليلي</p>
    </div>
  );
}

export function Leaves() {
  const [submitted, setSubmitted] = useState(false);
  return (
    <div>
      <h1 className="text-3xl font-heading font-extrabold mb-1">الإجازات</h1>
      <p className="opacity-60 mb-4">أرصدتي وطلباتي</p>
      <div className="grid grid-cols-3 gap-4 mb-8">
        <Card kicker="سنوية" title="18 يوم متبقي">مستحق 30 · مستخدم 12</Card>
        <Card kicker="مرضية" title="27 يوم متبقي">مستحق 30 · مستخدم 3</Card>
        <Card kicker="طارئة" title="4 أيام متبقية">مستحق 5 · مستخدم 1</Card>
      </div>
      <h3 className="text-xl font-heading font-extrabold mb-2">طلب إجازة جديد</h3>
      <div className="grid grid-cols-2 gap-4 max-w-2xl">
        <Field label="نوع الإجازة" htmlFor="ltype">
          <select id="ltype" className={inputClass}><option>سنوية</option><option>مرضية</option><option>طارئة</option></select>
        </Field>
        <div />
        <Field label="من تاريخ" htmlFor="lfrom"><input id="lfrom" type="date" className={inputClass} defaultValue="2026-08-20" /></Field>
        <Field label="إلى تاريخ" htmlFor="lto"><input id="lto" type="date" className={inputClass} defaultValue="2026-08-27" /></Field>
      </div>
      <Field label="ملاحظات" htmlFor="lnotes"><textarea id="lnotes" rows={2} placeholder="اختياري" className={`${inputClass} max-w-2xl`} /></Field>
      <div className="flex items-center gap-3">
        <Button variant="primary" onClick={() => setSubmitted(true)}>إرسال الطلب</Button>
        {submitted && <Tag variant="outline">تم إرسال الطلب — قيد الانتظار</Tag>}
      </div>
      <h3 className="text-xl font-heading font-extrabold mt-8 mb-2">طلباتي السابقة</h3>
      <table className="w-full">
        <thead><tr><th className={th}>النوع</th><th className={th}>من</th><th className={th}>إلى</th><th className={th}>المدة</th><th className={th}>الحالة</th></tr></thead>
        <tbody>
          {leaveHistory.map((l, i) => (
            <tr key={i}><td className={td}>{l.type}</td><td className={td}>{l.from}</td><td className={td}>{l.to}</td><td className={td}>{l.days}</td>
              <td className={td}><Tag variant={statusVariant(l.status)}>{l.status}</Tag></td></tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function ApprovalsQueue() {
  const seed = [
    { id: 1, type: 'طلب إجازة سنوية', person: 'عبدالعزيز الشهري', date: '18 أغسطس 2026', detail: '5 أيام' },
    { id: 2, type: 'طلب زي موظف', person: 'ريم الحارثي', date: '10 يوليو 2026', detail: 'مقاس M' },
    { id: 3, type: 'طلب مباشرة — عودة من إجازة', person: 'فهد القرني', date: '2 يونيو 2026', detail: '—' },
    { id: 4, type: 'طلب إجازة مرضية', person: 'تركي العنزي', date: '25 يوليو 2026', detail: '3 أيام' },
  ];
  const [decisions, setDecisions] = useState({});
  return (
    <div>
      <h1 className="text-3xl font-heading font-extrabold mb-1">اعتماد الطلبات</h1>
      <p className="opacity-60 mb-4">طلبات بانتظار قرارك</p>
      <table className="w-full">
        <thead><tr><th className={th}>نوع الطلب</th><th className={th}>مقدّم الطلب</th><th className={th}>التاريخ</th><th className={th}>التفاصيل</th><th className={th}></th></tr></thead>
        <tbody>
          {seed.map((ap) => {
            const decided = decisions[ap.id];
            return (
              <tr key={ap.id}>
                <td className={td}>{ap.type}</td><td className={td}>{ap.person}</td><td className={`${td} opacity-60`}>{ap.date}</td><td className={td}>{ap.detail}</td>
                <td className={td}>
                  {decided ? (
                    <Tag variant={statusVariant(decided)}>{decided}</Tag>
                  ) : (
                    <div className="flex gap-2">
                      <Button variant="secondary" onClick={() => setDecisions((d) => ({ ...d, [ap.id]: 'معتمدة' }))}>اعتماد</Button>
                      <Button variant="ghost" onClick={() => setDecisions((d) => ({ ...d, [ap.id]: 'مرفوضة' }))}>رفض</Button>
                    </div>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export function Attendance() {
  return (
    <div>
      <h1 className="text-3xl font-heading font-extrabold mb-1">الحضور</h1>
      <p className="opacity-60 mb-4">الخميس 6 أغسطس 2026 — كل الفروع</p>
      <table className="w-full">
        <thead><tr><th className={th}>الكود</th><th className={th}>الاسم</th><th className={th}>الحضور</th><th className={th}>الانصراف</th><th className={th}>الحالة</th><th className={th}>دقائق التأخير</th></tr></thead>
        <tbody>
          {attendanceCompany.map((r) => (
            <tr key={r.code}><td className={`${td} opacity-60`}>{r.code}</td><td className={td}>{r.name}</td><td className={td}>{r.in}</td><td className={td}>{r.out}</td>
              <td className={td}><Tag variant={statusVariant(r.status)}>{r.status}</Tag></td><td className={`${td} opacity-60`}>{r.late}</td></tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function OrgStructure() {
  return (
    <div>
      <h1 className="text-3xl font-heading font-extrabold mb-1">الفروع والأقسام</h1>
      <p className="opacity-60 mb-4">الهيكل التنظيمي</p>
      <h3 className="text-xl font-heading font-extrabold mb-2">الفروع</h3>
      <table className="w-full mb-8">
        <thead><tr><th className={th}>الفرع</th><th className={th}>الموقع</th><th className={th}>التوقيت</th><th className={th}>المدير</th></tr></thead>
        <tbody>{branches.map((b) => (
          <tr key={b.name}><td className={td}>{b.name}</td><td className={td}>{b.location}</td><td className={`${td} opacity-60`}>{b.timezone}</td><td className={td}>{b.manager}</td></tr>
        ))}</tbody>
      </table>
      <h3 className="text-xl font-heading font-extrabold mb-2">الأقسام</h3>
      <table className="w-full">
        <thead><tr><th className={th}>القسم</th><th className={th}>الفرع</th><th className={th}>رئيس القسم</th></tr></thead>
        <tbody>{departments.map((d) => (
          <tr key={d.name}><td className={td}>{d.name}</td><td className={`${td} opacity-60`}>{d.branch}</td><td className={td}>{d.head}</td></tr>
        ))}</tbody>
      </table>
    </div>
  );
}

export function Payroll() {
  const rows = payrollSeed.map((p) => ({
    ...p, net: p.active ? (p.base + p.allowances - p.deductions).toLocaleString('en-US') : '0',
  }));
  const total = payrollSeed.reduce((sum, p) => sum + (p.active ? p.base + p.allowances - p.deductions : 0), 0).toLocaleString('en-US');
  return (
    <div>
      <h1 className="text-3xl font-heading font-extrabold mb-1">الرواتب</h1>
      <p className="opacity-60 mb-4">تشغيل أغسطس 2026 — مسودة</p>
      <div className="flex items-center gap-4 mb-4">
        <div className="bg-surface border border-line p-4 min-w-[220px]">
          <div className="text-xs opacity-60">إجمالي التشغيل</div>
          <div className="font-heading font-extrabold text-3xl">{total} ريال</div>
        </div>
        <Button variant="primary">اعتماد التشغيل</Button>
      </div>
      <table className="w-full">
        <thead><tr><th className={th}>الكود</th><th className={th}>الاسم</th><th className={th}>الأساسي</th><th className={th}>البدلات</th><th className={th}>الاستقطاعات</th><th className={th}>صافي الراتب</th><th className={th}>الحالة</th></tr></thead>
        <tbody>
          {rows.map((p) => (
            <tr key={p.code}><td className={`${td} opacity-60`}>{p.code}</td><td className={td}>{p.name}</td><td className={td}>{p.base}</td><td className={td}>{p.allowances}</td>
              <td className={td}>{p.deductions}</td><td className={`${td} font-bold`}>{p.net}</td>
              <td className={td}><Tag variant={p.active ? 'neutral' : 'accent'}>{p.active ? 'نشط' : 'معلّق'}</Tag></td></tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function Audit() {
  return (
    <div>
      <h1 className="text-3xl font-heading font-extrabold mb-1">سجل التدقيق</h1>
      <p className="opacity-60 mb-4">كل الإجراءات المسجّلة تلقائياً عبر الوحدات</p>
      <table className="w-full">
        <thead><tr><th className={th}>الوقت</th><th className={th}>المستخدم</th><th className={th}>الإجراء</th><th className={th}>الوحدة</th><th className={th}>السجل</th><th className={th}>جلسة انتحال</th></tr></thead>
        <tbody>
          {auditLog.map((a, i) => (
            <tr key={i}><td className={`${td} opacity-60`}>{a.time}</td><td className={td}>{a.actor}</td>
              <td className={td}><Tag variant={a.action === 'حذف' ? 'accent' : a.action === 'اعتماد' ? 'outline' : 'neutral'}>{a.action}</Tag></td>
              <td className={td}>{a.module}</td><td className={`${td} opacity-60`}>{a.entity}</td>
              <td className={td}>{a.impersonatedBy ? <Tag variant="accent">{a.impersonatedBy}</Tag> : '—'}</td></tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function Roles() {
  return (
    <div>
      <h1 className="text-3xl font-heading font-extrabold mb-1">الأدوار والصلاحيات</h1>
      <p className="opacity-60 mb-4">4 أدوار في الشركة</p>
      <table className="w-full">
        <thead><tr><th className={th}>الدور</th><th className={th}>عدد الموظفين</th><th className={th}>نطاق الصلاحيات</th></tr></thead>
        <tbody>{roles.map((r) => (
          <tr key={r.name}><td className={td}>{r.name}</td><td className={td}>{r.count}</td><td className={`${td} opacity-60`}>{r.scope}</td></tr>
        ))}</tbody>
      </table>
    </div>
  );
}
