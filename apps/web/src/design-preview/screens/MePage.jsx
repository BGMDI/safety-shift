import { useState } from 'react';
import { Tag, Card, th, td } from '../ui/Primitives';
import { approvalsTrail, attendanceRows, statusVariant, shiftVariant } from '../data/sampleData';

const weekdays = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
const tabs = [
  ['overview', 'نظرة عامة'], ['approvals', 'موافقاتي'], ['attendance', 'حضوري'], ['schedule', 'جدولي'],
  ['salary', 'راتبي'], ['leave', 'إجازاتي'], ['custody', 'عهدتي وبدلتي'], ['onboarding', 'مباشرتي'],
];

export function MePage({ currentUser }) {
  const [tab, setTab] = useState('overview');
  return (
    <div>
      <h1 className="text-3xl font-heading font-extrabold mb-1">صفحتي</h1>
      <p className="opacity-60 mb-4">{currentUser.name} — {currentUser.title}</p>
      <div className="flex gap-2 flex-wrap mb-4">
        {tabs.map(([key, label]) => (
          <div key={key}
            className={`cursor-pointer font-heading font-semibold text-sm px-3.5 py-2 border ${tab === key ? 'bg-accent text-white border-accent' : 'border-line'}`}
            onClick={() => setTab(key)}>
            {label}
          </div>
        ))}
      </div>
      <div className="h-0.5 bg-line mb-4" />

      {tab === 'overview' && (
        <div className="grid grid-cols-2 gap-4 max-w-2xl">
          <div><div className="text-xs opacity-60">الاسم الكامل</div><div>{currentUser.name}</div></div>
          <div><div className="text-xs opacity-60">الرقم الوظيفي</div><div>{currentUser.code}</div></div>
          <div><div className="text-xs opacity-60">الفرع</div><div>{currentUser.branch}</div></div>
          <div><div className="text-xs opacity-60">القسم</div><div>{currentUser.dept}</div></div>
          <div><div className="text-xs opacity-60">المسمى الوظيفي</div><div>{currentUser.title}</div></div>
          <div><div className="text-xs opacity-60">تاريخ التعيين</div><div>{currentUser.hireDate}</div></div>
        </div>
      )}

      {tab === 'approvals' && (
        <table className="w-full">
          <thead><tr><th className={th}>نوع الطلب</th><th className={th}>تاريخ التقديم</th><th className={th}>الخطوة الحالية</th><th className={th}>الحالة</th></tr></thead>
          <tbody>{approvalsTrail.map((ap, i) => (
            <tr key={i}><td className={td}>{ap.type}</td><td className={td}>{ap.date}</td><td className={td}>{ap.step}</td>
              <td className={td}><Tag variant={statusVariant(ap.status)}>{ap.status}</Tag></td></tr>
          ))}</tbody>
        </table>
      )}

      {tab === 'attendance' && (
        <table className="w-full">
          <thead><tr><th className={th}>التاريخ</th><th className={th}>الحضور</th><th className={th}>الانصراف</th><th className={th}>الحالة</th><th className={th}>دقائق التأخير</th></tr></thead>
          <tbody>{attendanceRows.map((r, i) => (
            <tr key={i}><td className={td}>{r.date}</td><td className={td}>{r.in}</td><td className={td}>{r.out}</td>
              <td className={td}><Tag variant={statusVariant(r.status)}>{r.status}</Tag></td><td className={`${td} opacity-60`}>{r.late}</td></tr>
          ))}</tbody>
        </table>
      )}

      {tab === 'schedule' && (
        <table className="max-w-2xl">
          <thead><tr>{weekdays.map((d) => <th key={d} className={th}>{d}</th>)}</tr></thead>
          <tbody><tr>{currentUser.cells.map((c, i) => <td key={i} className={td}><Tag variant={shiftVariant(c)}>{c}</Tag></td>)}</tr></tbody>
        </table>
      )}

      {tab === 'salary' && (
        <table className="max-w-md">
          <tbody>
            <tr><td className={td}>الراتب الأساسي</td><td className={td}>9,000 ريال</td></tr>
            <tr><td className={td}>بدل سكن</td><td className={td}>1,500 ريال</td></tr>
            <tr><td className={td}>بدل نقل</td><td className={td}>800 ريال</td></tr>
            <tr><td className={td}>استقطاع تأمينات</td><td className={td}>450- ريال</td></tr>
            <tr><td className={`${td} font-extrabold`}>صافي الراتب</td><td className={`${td} font-extrabold`}>10,850 ريال</td></tr>
          </tbody>
        </table>
      )}

      {tab === 'leave' && (
        <div>
          <div className="grid grid-cols-3 gap-4 max-w-2xl">
            <Card kicker="سنوية" title="18 يوم متبقي" />
            <Card kicker="مرضية" title="27 يوم متبقي" />
            <Card kicker="طارئة" title="4 أيام متبقية" />
          </div>
          <p className="opacity-60 mt-3">التفاصيل والطلب الجديد ضمن تبويب «الإجازات» في القائمة الجانبية.</p>
        </div>
      )}

      {tab === 'custody' && (
        <div>
          <table className="max-w-2xl mb-4">
            <thead><tr><th className={th}>العهدة</th><th className={th}>تاريخ التسليم</th><th className={th}>الحالة</th></tr></thead>
            <tbody>
              <tr><td className={td}>حاسب محمول — Dell Latitude</td><td className={td}>10 يناير 2024</td><td className={td}><Tag>نشطة</Tag></td></tr>
              <tr><td className={td}>هاتف شركة</td><td className={td}>1 يونيو 2023</td><td className={td}><Tag>نشطة</Tag></td></tr>
            </tbody>
          </table>
          <p>طلب زي رسمي — مقاس M <Tag>معتمد</Tag></p>
        </div>
      )}

      {tab === 'onboarding' && (
        <Card kicker="المباشرة" title="10 يناير 2020" className="max-w-sm">
          مباشرة كموظف جديد <Tag>مكتملة</Tag>
        </Card>
      )}
    </div>
  );
}
