import { DashboardIcon, UserIcon, UsersIcon, CalendarIcon, CalendarXIcon, LogOutIcon, InboxIcon, ClockIcon, BuildingIcon, WalletIcon, ListIcon, ShieldIcon, TriangleAlertIcon } from '../icons';
import { Button } from '../ui/Primitives';

const navItem = (active) =>
  `flex items-center gap-2.5 px-3.5 py-2.5 cursor-pointer font-heading font-semibold text-sm border-e-2 ${
    active ? 'bg-accent-100 border-accent' : 'border-transparent hover:bg-accent-100'
  }`;

// Company-wide items (dashboard/roster/schedule/approvals/attendance/org/payroll/audit/roles) are
// hidden entirely for the `employee` role — mirrors the source spec's MGMT_ROLES gate. Enforce the
// real access control server-side; this is presentation-layer only.
export function Sidebar({ subview, setSubview, currentUser, isManagerRole, onLogout }) {
  const managerItems = [
    ['dashboard', 'لوحة التحكم', DashboardIcon],
    ['roster', 'الموظفون', UsersIcon],
    ['schedule', 'الجدول والورديات', CalendarIcon],
    ['approvalsQueue', 'اعتماد الطلبات', InboxIcon],
    ['attendance', 'الحضور', ClockIcon],
    ['orgStructure', 'الفروع والأقسام', BuildingIcon],
    ['payroll', 'الرواتب', WalletIcon],
    ['audit', 'سجل التدقيق', ListIcon],
    ['roles', 'الأدوار والصلاحيات', ShieldIcon],
  ];
  return (
    <aside className="w-60 flex-none border-s-2 border-line flex flex-col justify-between">
      <div>
        <div className="flex items-center gap-2.5 px-3.5 py-4 border-b-2 border-line">
          <div className="w-7 h-7 bg-accent text-white flex items-center justify-center font-heading font-extrabold">أ</div>
          <span className="font-heading font-extrabold text-sm">شركة الأفق</span>
        </div>
        {isManagerRole && managerItems.slice(0, 1).map(([key, label, Icon]) => (
          <div key={key} className={navItem(subview === key)} onClick={() => setSubview(key)}><Icon size={17} />{label}</div>
        ))}
        <div className={navItem(subview === 'me')} onClick={() => setSubview('me')}><UserIcon size={17} />صفحتي</div>
        {isManagerRole && managerItems.slice(1).map(([key, label, Icon]) => (
          <div key={key} className={navItem(subview === key)} onClick={() => setSubview(key)}><Icon size={17} />{label}</div>
        ))}
        <div className={navItem(subview === 'leave')} onClick={() => setSubview('leave')}><CalendarXIcon size={17} />الإجازات</div>
      </div>
      <div className="p-3.5 border-t-2 border-line flex items-center gap-2.5">
        <div className="w-[30px] h-[30px] bg-neutral-300 flex items-center justify-center font-heading font-extrabold flex-none">{currentUser.name.charAt(0)}</div>
        <div className="flex-1 overflow-hidden">
          <div className="text-sm font-semibold">{currentUser.name}</div>
          <div className="text-xs opacity-55">{currentUser.title}</div>
        </div>
        <Button variant="icon" aria-label="خروج" onClick={onLogout}><LogOutIcon size={15} /></Button>
      </div>
    </aside>
  );
}

export function ImpersonationBanner({ tenantName, onEnd }) {
  return (
    <div className="sticky top-0 z-10 bg-accent text-white px-5 py-2.5 flex items-center justify-between gap-3">
      <div className="flex items-center gap-2 text-sm font-semibold">
        <TriangleAlertIcon size={16} />
        أنت تتصفّح كمالك منصة — الشركة: {tenantName} · تنتهي الجلسة خلال 15 دقيقة
      </div>
      <Button variant="secondary" className="!bg-white" onClick={onEnd}>إنهاء الجلسة</Button>
    </div>
  );
}

export function ConfirmDialog({ tenantName, onCancel, onConfirm }) {
  return (
    <div className="fixed inset-0 bg-neutral-900/60 flex items-center justify-center z-20">
      <div className="bg-white shadow-lg p-6 max-w-md w-full">
        <div className="font-heading font-extrabold text-lg mb-2">الدخول كشركة «{tenantName}»؟</div>
        <div className="text-sm opacity-80 mb-5">
          ستدخل بصلاحيات أدمن الشركة لمدة 15 دقيقة غير قابلة للتمديد. سيظهر شريط دائم يوضّح أنك في جلسة انتحال،
          والإجراءات تُنسب إليك في سجل التدقيق.
        </div>
        <div className="flex gap-2 justify-end">
          <Button variant="secondary" onClick={onCancel}>إلغاء</Button>
          <Button variant="primary" onClick={onConfirm}>دخول</Button>
        </div>
      </div>
    </div>
  );
}
