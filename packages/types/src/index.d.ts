export interface JwtPayload {
    sub: string;
    tenantId: string;
    email: string;
    roles: string[];
}
export interface AuthTokens {
    accessToken: string;
    refreshToken: string;
}
export interface ApiResponse<T = unknown> {
    success: boolean;
    data?: T;
    message?: string;
    error?: string;
}
export interface PaginatedResponse<T> {
    data: T[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
}
export type PlanInterval = 'monthly' | 'quarterly' | 'annual';
export interface PlanPrice {
    interval: PlanInterval;
    amount: number;
    currency: string;
    stripePriceId: string;
}
export interface AttendanceSummary {
    employeeId: string;
    month: number;
    year: number;
    presentDays: number;
    absentDays: number;
    lateDays: number;
    totalLateMinutes: number;
    totalOvertimeMinutes: number;
}
export interface ShiftScheduleEntry {
    employeeId: string;
    employeeName: string;
    shiftId: string;
    shiftName: string;
    date: string;
    startTime: string;
    endTime: string;
}
