import { IsString, IsNumber, IsBoolean, IsOptional, IsEnum, IsDateString, IsUUID, IsIn } from 'class-validator'
import { Type } from 'class-transformer'

export class CreateLeaveTypeDto {
  @IsString() name!: string
  @IsOptional() @IsString() description?: string
  @Type(() => Number) @IsNumber() maxDays!: number
  @IsOptional() @Type(() => Number) @IsNumber() maxDaysHalfPay?: number
  @IsOptional() @Type(() => Number) @IsNumber() maxDaysUnpaid?: number
  @IsOptional() @IsBoolean() requiresApproval?: boolean
  @IsOptional() @IsString() color?: string
  @IsOptional() @IsBoolean() isSystemDefault?: boolean
  @IsOptional() @IsIn(['FIXED','SENIORITY_BASED','SICK_TIERED','ONCE_PER_EMPLOYMENT','PER_EVENT'])
  calculationType?: string
  @IsOptional() @Type(() => Number) @IsNumber() minDays?: number
  @IsOptional() @Type(() => Number) @IsNumber() seniorityThreshold?: number
}

export class UpdateLeaveTypeDto {
  @IsOptional() @IsString() name?: string
  @IsOptional() @IsString() description?: string
  @IsOptional() @Type(() => Number) @IsNumber() maxDays?: number
  @IsOptional() @Type(() => Number) @IsNumber() maxDaysHalfPay?: number
  @IsOptional() @Type(() => Number) @IsNumber() maxDaysUnpaid?: number
  @IsOptional() @IsBoolean() requiresApproval?: boolean
  @IsOptional() @IsString() color?: string
  @IsOptional() @IsIn(['FIXED','SENIORITY_BASED','SICK_TIERED','ONCE_PER_EMPLOYMENT','PER_EVENT'])
  calculationType?: string
  @IsOptional() @Type(() => Number) @IsNumber() minDays?: number
  @IsOptional() @Type(() => Number) @IsNumber() seniorityThreshold?: number
}

export class AutoAssignBalancesDto {
  @Type(() => Number) @IsNumber() year!: number
  @IsOptional() @IsUUID() employeeId?: string
}

export class CreateLeaveBalanceDto {
  @IsUUID() employeeId!: string
  @IsUUID() leaveTypeId!: string
  @Type(() => Number) @IsNumber() year!: number
  @Type(() => Number) @IsNumber() entitledDays!: number
}

export class CreateLeaveRequestDto {
  @IsUUID() leaveTypeId!: string
  @IsDateString() startDate!: string
  @IsDateString() endDate!: string
  @IsOptional() @IsString() notes?: string
}

export class ApproveLeaveDto {
  @IsEnum(['APPROVED', 'REJECTED']) status!: 'APPROVED' | 'REJECTED'
  @IsOptional() @IsString() notes?: string
}
