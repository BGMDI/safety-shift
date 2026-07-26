import { IsString, IsOptional, IsNumber, IsBoolean } from 'class-validator'
import { Type } from 'class-transformer'

export class CreateJobTitleDto {
  @IsString()
  name!: string

  @IsOptional()
  @IsString()
  grade?: string

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  baseSalary?: number

  @IsOptional()
  @IsBoolean()
  isShiftEligible?: boolean
}

export class UpdateJobTitleDto {
  @IsOptional() @IsString() name?: string
  @IsOptional() @IsString() grade?: string
  @IsOptional() @Type(() => Number) @IsNumber() baseSalary?: number
  @IsOptional() @IsBoolean() isShiftEligible?: boolean
}
