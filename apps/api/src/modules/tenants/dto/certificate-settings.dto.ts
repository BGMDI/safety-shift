import { IsOptional, IsString, MaxLength, IsNumber, Min, Max } from 'class-validator'
import { Type } from 'class-transformer'

export class UpdateCertificateSettingsDto {
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(100)
  payrollInsuranceRate?: number

  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) @Max(100)
  payrollBasicRate?: number

  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) @Max(100)
  payrollHousingRate?: number

  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) @Max(100)
  payrollTransportRate?: number
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  salaryCertificateText?: string

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  employmentCertificateText?: string

  @IsOptional()
  @IsString()
  @MaxLength(150)
  certificateSignerName?: string

  @IsOptional()
  @IsString()
  @MaxLength(150)
  certificateSignerTitle?: string
}
