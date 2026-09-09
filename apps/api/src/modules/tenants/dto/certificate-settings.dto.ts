import { IsOptional, IsString, MaxLength } from 'class-validator'

export class UpdateCertificateSettingsDto {
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
