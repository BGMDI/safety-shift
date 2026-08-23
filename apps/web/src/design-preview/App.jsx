import { useState } from 'react';
// ملاحظة: لم يُستورد styles/global.css عمداً — فهو يضبط html/body عالمياً فيُعيد تنسيق
// التطبيق القائم كله. الستايلات الأساسية مطبَّقة بنطاق محصور في app/design-preview/page.tsx
import { CompanyLogin, PlatformLogin } from './screens/Auth';
import { PlatformDashboard } from './screens/PlatformDashboard';
import {
  Dashboard, Roster, EmployeeDetail, Schedule, Leaves, ApprovalsQueue, Attendance, OrgStructure, Payroll, Audit, Roles,
} from './screens/Company';
import { MePage } from './screens/MePage';
import { Sidebar, ImpersonationBanner, ConfirmDialog } from './components/Shell';
import { personas } from './data/sampleData';

// Swap for real auth/role state. 'employee' collapses the sidebar to My Page + Leaves only —
// mirrors the source spec's MGMT_ROLES gate (presentation-layer only; enforce for real server-side).
const VIEWER_ROLE = 'hr_manager'; // 'hr_manager' | 'supervisor' | 'employee'

export default function App() {
  const [view, setView] = useState('login'); // login | platformLogin | platformDash | company
  const [subview, setSubview] = useState('dashboard');
  const [impersonating, setImpersonating] = useState(false);
  const [confirmTenant, setConfirmTenant] = useState(null); // tenant name pending confirmation, or null
  const [activeTenant, setActiveTenant] = useState('');
  const [selectedEmployeeCode, setSelectedEmployeeCode] = useState(null);

  const isManagerRole = VIEWER_ROLE !== 'employee';
  const currentUser = personas[VIEWER_ROLE];

  const goLogin = () => { setView('login'); setImpersonating(false); };
  const loginSubmit = () => { setView('company'); setSubview(isManagerRole ? 'dashboard' : 'me'); };
  const enterTenant = (name) => setConfirmTenant(name);
  const confirmEnter = () => { setActiveTenant(confirmTenant); setConfirmTenant(null); setImpersonating(true); setView('company'); setSubview('dashboard'); };
  const endImpersonation = () => { setImpersonating(false); setView('platformDash'); };

  // نافذة التأكيد طبقة عائمة فوق أي شاشة — كانت مرسومة داخل فرع company فقط،
  // بينما تُستدعى من لوحة مالك المنصة التي تعود مبكراً، فلم تكن تظهر أبداً
  const dialog = confirmTenant
    ? <ConfirmDialog tenantName={confirmTenant} onCancel={() => setConfirmTenant(null)} onConfirm={confirmEnter} />
    : null;

  if (view === 'login') return <CompanyLogin onSubmit={loginSubmit} onGoPlatform={() => setView('platformLogin')} />;
  if (view === 'platformLogin') return <PlatformLogin onSubmit={() => setView('platformDash')} onBack={goLogin} />;
  if (view === 'platformDash') return (
    <>
      {dialog}
      <PlatformDashboard adminName="عبدالله الزهراني" onLogout={goLogin} onEnter={enterTenant} />
    </>
  );

  // view === 'company'
  return (
    <div dir="rtl" lang="ar" className="min-h-screen bg-bg text-ink font-body">
      {dialog}
      {impersonating && <ImpersonationBanner tenantName={activeTenant} onEnd={endImpersonation} />}
      <div className="flex min-h-screen">
        <Sidebar subview={subview} setSubview={setSubview} currentUser={currentUser} isManagerRole={isManagerRole} onLogout={goLogin} />
        <main className="flex-1 p-8 min-w-0">
          {subview === 'dashboard' && <Dashboard />}
          {subview === 'roster' && <Roster onOpenEmployee={(code) => { setSelectedEmployeeCode(code); setSubview('employeeDetail'); }} />}
          {subview === 'employeeDetail' && <EmployeeDetail code={selectedEmployeeCode} onBack={() => setSubview('roster')} />}
          {subview === 'schedule' && <Schedule />}
          {subview === 'leave' && <Leaves />}
          {subview === 'me' && <MePage currentUser={currentUser} />}
          {subview === 'approvalsQueue' && <ApprovalsQueue />}
          {subview === 'attendance' && <Attendance />}
          {subview === 'orgStructure' && <OrgStructure />}
          {subview === 'payroll' && <Payroll />}
          {subview === 'audit' && <Audit />}
          {subview === 'roles' && <Roles />}
        </main>
      </div>
    </div>
  );
}
