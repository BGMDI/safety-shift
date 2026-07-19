import { IsString, IsOptional, IsEnum, IsDateString, IsUUID } from 'class-validator'

export class CreateOnboardingDto {
  @IsOptional() @IsUUID() employeeId?: string // اختياري: تُجبر على صاحب الحساب إن لم يكن إدارياً
  @IsEnum(['NEW_HIRE', 'RETURN_FROM_LEAVE']) type!: 'NEW_HIRE' | 'RETURN_FROM_LEAVE'
  @IsDateString() scheduledDate!: string
  @IsOptional() @IsString() notes?: string
}
