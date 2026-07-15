import { IsString, IsOptional, IsNumber } from 'class-validator'
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
}

export class UpdateJobTitleDto {
  @IsOptional() @IsString() name?: string
  @IsOptional() @IsString() grade?: string
  @IsOptional() @Type(() => Number) @IsNumber() baseSalary?: number
}
