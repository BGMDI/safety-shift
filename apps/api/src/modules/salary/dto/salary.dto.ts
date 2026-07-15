import { IsString, IsNumber, IsBoolean, IsOptional, IsEnum, IsDateString } from 'class-validator'
import { Type } from 'class-transformer'

export class CreateSalaryComponentDto {
  @IsString()
  employeeId!: string

  @IsEnum(['BASE', 'ALLOWANCE', 'DEDUCTION'])
  type!: 'BASE' | 'ALLOWANCE' | 'DEDUCTION'

  @IsString()
  name!: string

  @Type(() => Number)
  @IsNumber()
  amount!: number

  @IsOptional()
  @IsBoolean()
  isPercentage?: boolean

  @IsDateString()
  effectiveDate!: string
}

export class UpdateSalaryComponentDto {
  @IsOptional() @Type(() => Number) @IsNumber() amount?: number
  @IsOptional() @IsBoolean() isPercentage?: boolean
  @IsOptional() @IsDateString() effectiveDate?: string
}
