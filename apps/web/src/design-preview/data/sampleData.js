// Illustrative sample data only — wire these shapes to real API responses in the real build.

export function statusVariant(status) {
  if (['نشط', 'معتمد', 'معتمدة', 'مكتمل', 'مكتملة', 'حاضر'].includes(status)) return 'neutral';
  if (['قيد الانتظار', 'تجريبي', 'تجريبية', 'متأخر'].includes(status)) return 'outline';
  return 'accent';
}
export function shiftVariant(label) {
  if (label === 'راحة') return 'outline';
  if (label === 'معلق') return 'accent';
  return 'neutral';
}

export const employees = [
  { code: 'EMP-1001', name: 'سارة العتيبي', branch: 'فرع الرياض', dept: 'المبيعات', title: 'مشرفة مبيعات', status: 'نشط', hireDate: '3 مارس 2021', cells: ['ص','ص','ص','ص','ص','راحة','راحة'] },
  { code: 'EMP-1002', name: 'خالد المطيري', branch: 'فرع الرياض', dept: 'الحسابات', title: 'محاسب', status: 'نشط', hireDate: '14 يناير 2019', cells: ['ص','ص','ص','ص','ص','راحة','راحة'] },
  { code: 'EMP-1003', name: 'فهد القرني', branch: 'فرع جدة', dept: 'العمليات', title: 'فني صيانة', status: 'نشط', hireDate: '22 أغسطس 2022', cells: ['م','م','م','راحة','م','م','راحة'] },
  { code: 'EMP-1004', name: 'نورة الدوسري', branch: 'فرع الرياض', dept: 'الموارد البشرية', title: 'أخصائية موارد بشرية', status: 'نشط', hireDate: '5 أبريل 2023', cells: ['ص','ص','ص','ص','راحة','راحة','ص'] },
  { code: 'EMP-1005', name: 'عبدالعزيز الشهري', branch: 'فرع جدة', dept: 'المبيعات', title: 'مندوب مبيعات', status: 'نشط', hireDate: '15 سبتمبر 2022', cells: ['م','م','راحة','م','م','م','راحة'] },
  { code: 'EMP-1006', name: 'ريم الحارثي', branch: 'فرع الرياض', dept: 'خدمة العملاء', title: 'ممثلة خدمة عملاء', status: 'معلق', hireDate: '10 يونيو 2021', cells: ['راحة','راحة','راحة','راحة','راحة','راحة','راحة'] },
  { code: 'EMP-1007', name: 'تركي العنزي', branch: 'فرع الرياض', dept: 'تقنية المعلومات', title: 'مشغل نظام', status: 'نشط', hireDate: '30 نوفمبر 2020', cells: ['ل','ل','ل','راحة','راحة','ل','ل'] },
  { code: 'EMP-1008', name: 'منيرة الزهراني', branch: 'فرع جدة', dept: 'الإدارة', title: 'مديرة فرع', status: 'نشط', hireDate: '1 فبراير 2018', cells: ['ص','ص','ص','ص','ص','ص','راحة'] },
];

export const tenants = [
  { name: 'شركة الأفق للتجارة والمقاولات', plan: 'سنوية', status: 'نشط', usersLabel: '150 موظف' },
  { name: 'مجموعة نجم الخليج للخدمات', plan: 'تجريبية', status: 'تجريبي', usersLabel: '22/50 موظف' },
  { name: 'مؤسسة الرواد الطبية', plan: 'شهرية', status: 'نشط', usersLabel: '340/500 موظف' },
  { name: 'شركة سهم للوجستيات', plan: 'ربع سنوية', status: 'منتهي', usersLabel: '88/100 موظف' },
];

export const coverage = [
  { branch: 'الرياض — الرئيسي', shift: 'صباحي', need: 20, have: 18 },
  { branch: 'الرياض — الرئيسي', shift: 'مسائي', need: 15, have: 15 },
  { branch: 'الرياض — الرئيسي', shift: 'ليلي', need: 8, have: 6 },
  { branch: 'جدة', shift: 'صباحي', need: 10, have: 10 },
  { branch: 'جدة', shift: 'مسائي', need: 10, have: 8 },
  { branch: 'جدة', shift: 'ليلي', need: 4, have: 4 },
];

export const activity = [
  { text: 'تسجيل حضور متأخر — خالد المطيري', time: 'منذ 12 دقيقة' },
  { text: 'تمت الموافقة على طلب إجازة — سارة العتيبي', time: 'منذ ساعة' },
  { text: 'طلب عهدة جديد — فهد القرني', time: 'منذ ساعتين' },
  { text: 'تحديث بيانات — نورة الدوسري', time: 'أمس' },
  { text: 'غياب بلا إذن — تركي العنزي', time: 'أمس' },
];

export const leaveHistory = [
  { type: 'سنوية', from: '20 أغسطس 2026', to: '27 أغسطس 2026', days: '8 أيام', status: 'قيد الانتظار' },
  { type: 'طارئة', from: '2 يوليو 2026', to: '2 يوليو 2026', days: 'يوم واحد', status: 'معتمدة' },
  { type: 'مرضية', from: '14 يونيو 2026', to: '16 يونيو 2026', days: '3 أيام', status: 'معتمدة' },
  { type: 'سنوية', from: '5 مارس 2026', to: '6 مارس 2026', days: 'يومان', status: 'مرفوضة' },
];

export const approvalsTrail = [
  { type: 'طلب إجازة سنوية', date: '18 أغسطس 2026', step: 'مدير الفرع', status: 'قيد الانتظار' },
  { type: 'طلب زي موظف', date: '10 يوليو 2026', step: '—', status: 'معتمدة' },
  { type: 'طلب مباشرة — عودة من إجازة', date: '2 يونيو 2026', step: 'رئيس القسم', status: 'مرفوضة' },
];

export const attendanceRows = [
  { date: '5 أغسطس 2026', in: '07:02', out: '15:05', status: 'حاضر', late: '—' },
  { date: '4 أغسطس 2026', in: '07:18', out: '15:00', status: 'متأخر', late: '18' },
  { date: '3 أغسطس 2026', in: '07:00', out: '15:01', status: 'حاضر', late: '—' },
  { date: '2 أغسطس 2026', in: '—', out: '—', status: 'غياب', late: '—' },
];

export const personas = {
  hr_manager: { code: 'EMP-0001', name: 'منى الحربي', title: 'مديرة الموارد البشرية', branch: 'فرع الرياض', dept: 'الموارد البشرية', hireDate: '10 يناير 2020', cells: ['ص','ص','ص','ص','ص','راحة','راحة'] },
  supervisor: { code: 'EMP-1001', name: 'سارة العتيبي', title: 'مشرفة مبيعات', branch: 'فرع الرياض', dept: 'المبيعات', hireDate: '3 مارس 2021', cells: ['ص','ص','ص','ص','ص','راحة','راحة'] },
  employee: { code: 'EMP-1005', name: 'عبدالعزيز الشهري', title: 'مندوب مبيعات', branch: 'فرع جدة', dept: 'المبيعات', hireDate: '15 سبتمبر 2022', cells: ['م','م','راحة','م','م','م','راحة'] },
};

export const approvalsQueueSeed = [
  { id: 1, type: 'طلب إجازة سنوية', person: 'عبدالعزيز الشهري', date: '18 أغسطس 2026', detail: '5 أيام' },
  { id: 2, type: 'طلب زي موظف', person: 'ريم الحارثي', date: '10 يوليو 2026', detail: 'مقاس M' },
  { id: 3, type: 'طلب مباشرة — عودة من إجازة', person: 'فهد القرني', date: '2 يونيو 2026', detail: '—' },
  { id: 4, type: 'طلب إجازة مرضية', person: 'تركي العنزي', date: '25 يوليو 2026', detail: '3 أيام' },
];

export const attendanceCompany = [
  { code: 'EMP-1001', name: 'سارة العتيبي', in: '07:01', out: '15:03', status: 'حاضر', late: '—' },
  { code: 'EMP-1002', name: 'خالد المطيري', in: '07:18', out: '15:00', status: 'متأخر', late: '18' },
  { code: 'EMP-1003', name: 'فهد القرني', in: '15:02', out: '23:05', status: 'حاضر', late: '—' },
  { code: 'EMP-1004', name: 'نورة الدوسري', in: '07:00', out: '15:00', status: 'حاضر', late: '—' },
  { code: 'EMP-1005', name: 'عبدالعزيز الشهري', in: '15:10', out: '23:00', status: 'متأخر', late: '10' },
  { code: 'EMP-1006', name: 'ريم الحارثي', in: '—', out: '—', status: 'غياب', late: '—' },
  { code: 'EMP-1007', name: 'تركي العنزي', in: '23:05', out: '—', status: 'حاضر', late: '—' },
  { code: 'EMP-1008', name: 'منيرة الزهراني', in: '06:58', out: '15:02', status: 'حاضر', late: '—' },
];

export const branches = [
  { name: 'الفرع الرئيسي — الرياض', location: 'الرياض، حي العليا', timezone: 'آسيا/الرياض', manager: 'غير معيّن' },
  { name: 'فرع جدة', location: 'جدة، حي الشاطئ', timezone: 'آسيا/الرياض', manager: 'منيرة الزهراني' },
];

export const departments = [
  { name: 'المبيعات', branch: 'الرياض وجدة', head: 'سارة العتيبي' },
  { name: 'الحسابات', branch: 'فرع الرياض', head: 'خالد المطيري' },
  { name: 'العمليات', branch: 'فرع جدة', head: 'فهد القرني' },
  { name: 'الموارد البشرية', branch: 'فرع الرياض', head: 'منى الحربي' },
  { name: 'خدمة العملاء', branch: 'فرع الرياض', head: 'غير معيّن' },
  { name: 'تقنية المعلومات', branch: 'فرع الرياض', head: 'تركي العنزي' },
  { name: 'الإدارة', branch: 'فرع جدة', head: 'منيرة الزهراني' },
];

export const payrollSeed = [
  { code: 'EMP-1001', name: 'سارة العتيبي', base: 7000, allowances: 1500, deductions: 210, active: true },
  { code: 'EMP-1002', name: 'خالد المطيري', base: 6500, allowances: 1500, deductions: 195, active: true },
  { code: 'EMP-1003', name: 'فهد القرني', base: 5200, allowances: 1500, deductions: 156, active: true },
  { code: 'EMP-1004', name: 'نورة الدوسري', base: 6800, allowances: 1500, deductions: 204, active: true },
  { code: 'EMP-1005', name: 'عبدالعزيز الشهري', base: 4800, allowances: 1500, deductions: 144, active: true },
  { code: 'EMP-1006', name: 'ريم الحارثي', base: 4500, allowances: 0, deductions: 0, active: false },
  { code: 'EMP-1007', name: 'تركي العنزي', base: 5600, allowances: 1500, deductions: 168, active: true },
  { code: 'EMP-1008', name: 'منيرة الزهراني', base: 9500, allowances: 1500, deductions: 285, active: true },
];

export const auditLog = [
  { time: '06/08/2026 09:12', actor: 'منى الحربي', action: 'تعديل', module: 'الرواتب', entity: 'SAL-2201', impersonatedBy: null },
  { time: '06/08/2026 08:47', actor: 'النظام', action: 'اعتماد', module: 'الإجازات', entity: 'LR-1042', impersonatedBy: null },
  { time: '05/08/2026 16:30', actor: 'أدمن الشركة', action: 'تعديل', module: 'الموظفون', entity: 'EMP-1006', impersonatedBy: 'عبدالله الزهراني' },
  { time: '05/08/2026 11:05', actor: 'خالد المطيري', action: 'إنشاء', module: 'العهد', entity: 'CUST-330', impersonatedBy: null },
  { time: '04/08/2026 14:20', actor: 'منى الحربي', action: 'حذف', module: 'المسميات الوظيفية', entity: 'JT-12', impersonatedBy: null },
];

export const roles = [
  { name: 'مدير النظام', count: 1, scope: 'كل الوحدات' },
  { name: 'مدير الموارد البشرية', count: 2, scope: 'الموظفون، الرواتب، الإجازات، الاعتمادات' },
  { name: 'مشرف', count: 3, scope: 'عرض الفرق، اعتماد الحضور' },
  { name: 'موظف', count: 142, scope: 'صفحتي فقط' },
];
