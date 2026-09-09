import { IsString, IsOptional, IsNumber, IsBoolean, IsInt, Min, Max, IsArray, ValidateNested, MaxLength } from 'class-validator'
import { Type } from 'class-transformer'

export class JobAllowanceDto {
  @IsString() @MaxLength(100) name!: string
  @Type(() => Number) @IsNumber() @Min(0) amount!: number
}

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

  @Type(() => Number) @IsInt() @Min(1) @Max(100) maxGrade!: number
  @Type(() => Number) @IsNumber() @Min(0) gradeIncrement!: number
  @Type(() => Number) @IsNumber() @Min(0) housingAllowance!: number
  @Type(() => Number) @IsNumber() @Min(0) transportAllowance!: number
  @Type(() => Number) @IsNumber() @Min(0) otherAllowance!: number
  @Type(() => Number) @IsNumber() @Min(0) @Max(100) insuranceRate!: number
  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => JobAllowanceDto) customAllowances?: JobAllowanceDto[]
}

export class UpdateJobTitleDto {
  @IsOptional() @IsString() name?: string
  @IsOptional() @IsString() grade?: string
  @IsOptional() @Type(() => Number) @IsNumber() baseSalary?: number
  @IsOptional() @IsBoolean() isShiftEligible?: boolean
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) maxGrade?: number
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) gradeIncrement?: number
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) housingAllowance?: number
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) transportAllowance?: number
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) otherAllowance?: number
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) @Max(100) insuranceRate?: number
  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => JobAllowanceDto) customAllowances?: JobAllowanceDto[]
}
