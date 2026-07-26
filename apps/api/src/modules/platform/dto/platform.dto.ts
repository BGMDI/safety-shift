import { IsString, IsOptional, IsArray, IsEnum, IsUUID, IsNumber, IsBoolean, IsIn } from 'class-validator'
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

export { MODULES, BILLING_CYCLES }
