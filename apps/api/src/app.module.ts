import { Module } from '@nestjs/common'
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler'
import { APP_GUARD } from '@nestjs/core'
import { AuthModule } from './modules/auth/auth.module'
import { BranchesModule } from './modules/branches/branches.module'
import { EmployeesModule } from './modules/employees/employees.module'
import { DepartmentsModule } from './modules/departments/departments.module'
import { JobTitlesModule } from './modules/job-titles/job-titles.module'
import { SalaryModule } from './modules/salary/salary.module'
import { AttendanceModule } from './modules/attendance/attendance.module'
import { ShiftsModule } from './modules/shifts/shifts.module'
import { PayrollModule } from './modules/payroll/payroll.module'
import { LeavesModule } from './modules/leaves/leaves.module'
import { CustodyModule } from './modules/custody/custody.module'
import { UniformsModule } from './modules/uniforms/uniforms.module'
import { SubscriptionsModule } from './modules/subscriptions/subscriptions.module'
import { TenantsModule } from './modules/tenants/tenants.module'
import { RolesModule } from './modules/roles/roles.module'
import { AuditModule } from './modules/audit/audit.module'
import { RotationsModule } from './modules/rotations/rotations.module'

@Module({
  imports: [
    ThrottlerModule.forRoot([{ ttl: 60000, limit: 100 }]),
    AuthModule,
    TenantsModule,
    BranchesModule,
    EmployeesModule,
    DepartmentsModule,
    JobTitlesModule,
    SalaryModule,
    AttendanceModule,
    ShiftsModule,
    PayrollModule,
    LeavesModule,
    CustodyModule,
    UniformsModule,
    SubscriptionsModule,
    RolesModule,
    AuditModule,
    RotationsModule,
  ],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
