// =============================
// Auth Types
// =============================

export interface JwtPayload {
  sub: string         // employee id
  tenantId: string
  email: string
  roles: string[]
}

export interface AuthTokens {
  accessToken: string
  refreshToken: string
}

// =============================
// API Response Types
// =============================

export interface ApiResponse<T = unknown> {
  success: boolean
  data?: T
  message?: string
  error?: string
}

export interface PaginatedResponse<T> {
  data: T[]
  total: number
  page: number
  limit: number
  totalPages: number
}

// =============================
// Subscription Plans
// =============================

export type PlanInterval = 'monthly' | 'quarterly' | 'annual'

export interface PlanPrice {
  interval: PlanInterval
  amount: number
  currency: string
  stripePriceId: string
}

// =============================
// Attendance Types
// =============================

export interface AttendanceSummary {
  employeeId: string
  month: number
  year: number
  presentDays: number
  absentDays: number
  lateDays: number
  totalLateMinutes: number
  totalOvertimeMinutes: number
}

// =============================
// Shift Schedule Types
// =============================

export interface ShiftScheduleEntry {
  employeeId: string
  employeeName: string
  shiftId: string
  shiftName: string
  date: string
  startTime: string
  endTime: string
}
