// حساب دقائق التأخير
export function calcLateMinutes(scheduledStart: string, actualCheckIn: Date): number {
  const [h, m] = scheduledStart.split(':').map(Number)
  const scheduled = new Date(actualCheckIn)
  scheduled.setHours(h, m, 0, 0)
  const diff = Math.floor((actualCheckIn.getTime() - scheduled.getTime()) / 60000)
  return Math.max(0, diff)
}

// حساب الراتب اليومي
export function dailySalary(monthlySalary: number, workingDaysPerMonth = 22): number {
  return monthlySalary / workingDaysPerMonth
}

// حساب خصم الغياب
export function absenceDeduction(monthlySalary: number, absentDays: number): number {
  return dailySalary(monthlySalary) * absentDays
}

// حساب خصم التأخير
export function lateDeduction(monthlySalary: number, lateMinutes: number): number {
  const hourlyRate = monthlySalary / (22 * 8)
  return (hourlyRate / 60) * lateMinutes
}
