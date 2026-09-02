import { IsString, IsOptional, IsArray, IsEnum, IsUUID, IsNumber, IsBoolean, IsIn, IsEmail, MinLength, MaxLength } from 'class-validator'
import { Type } from 'class-transformer'

const MODULES = ['ATTENDANCE', 'SHIFTS', 'LEAVES', 'PAYROLL', 'CUSTODY', 'UNIFORMS', 'ONBOARDING', 'APPROVALS', 'ROLES', 'AUDIT'] as const
const BILLING_CYCLES = ['MONTHLY', 'QUARTERLY', 'ANNUAL'] as const

export class CreateTemplateDto {
  @IsString() name!: string
  @IsArray() @IsEnum(MODULES, { each: true }) modules!: string[]
  @IsOptional() @Type(() => Number) @IsNumber() monthlyPrice?: number
}

export class UpdateTemplateDto {
  @IsOptional() @IsString() name?: string
  @IsOptional() @IsArray() @IsEnum(MODULES, { each: true }) modules?: string[]
  @IsOptional() @Type(() => Number) @IsNumber() monthlyPrice?: number
  @IsOptional() @IsBoolean() isActive?: boolean
}

export class CreateTenantDto {
  @IsString() name!: string
  @IsOptional() @IsUUID() subscriptionTemplateId?: string
  @IsIn(BILLING_CYCLES) billingCycle!: 'MONTHLY' | 'QUARTERLY' | 'ANNUAL'
  @IsOptional() @Type(() => Number) @IsNumber() maxUsers?: number
  // بيانات أول مستخدم (super_admin) في الشركة الجديدة
  @IsString() ownerFullName!: string
  @IsString() ownerEmail!: string
  @IsString() ownerPassword!: string
}

export class UpdateTenantModulesDto {
  @IsArray() @IsEnum(MODULES, { each: true }) modules!: string[]
}

export class ExtendSubscriptionDto {
  @IsIn(BILLING_CYCLES) billingCycle!: 'MONTHLY' | 'QUARTERLY' | 'ANNUAL'
}

export class UpdateTenantInfoDto {
  @IsOptional() @IsString() name?: string
  @IsOptional() @Type(() => Number) @IsNumber() maxUsers?: number | null
}

export class UpdatePlatformEmployeeDto {
  @IsOptional() @IsString() @MaxLength(200) fullName?: string
  @IsOptional() @IsEmail() email?: string
  @IsOptional() @IsString() @MaxLength(30) phone?: string
  @IsOptional() @IsIn(['ACTIVE', 'SUSPENDED', 'TERMINATED']) status?: 'ACTIVE' | 'SUSPENDED' | 'TERMINATED'
}

export class ResetPlatformEmployeePasswordDto {
  @IsString() @MinLength(12) @MaxLength(100) password!: string
}

export { MODULES, BILLING_CYCLES }
