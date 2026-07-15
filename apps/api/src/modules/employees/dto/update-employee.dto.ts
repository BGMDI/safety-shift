import { IsString, IsEmail, IsOptional, IsEnum, IsDateString } from 'class-validator'

export class UpdateEmployeeDto {
  @IsOptional() @IsString()     fullName?: string
  @IsOptional() @IsString()     firstName?: string
  @IsOptional() @IsString()     fatherName?: string
  @IsOptional() @IsString()     grandfatherName?: string
  @IsOptional() @IsString()     familyName?: string
  @IsOptional() @IsEmail()      email?: string
  @IsOptional() @IsString()     phone?: string
  @IsOptional() @IsString()     nationalId?: string
  @IsOptional() @IsDateString() idExpiryDate?: string
  @IsOptional() @IsString()     nationality?: string
  @IsOptional() @IsDateString() birthDate?: string
  @IsOptional() @IsString()     qualification?: string
  @IsOptional() @IsString()     specialization?: string
  @IsOptional() @IsString()     iban?: string
  @IsOptional() @IsString()     branchId?: string
  @IsOptional() @IsString()     departmentId?: string
  @IsOptional() @IsString()     jobTitleId?: string
  @IsOptional() @IsDateString() hireDate?: string
  @IsOptional() @IsString()     password?: string
  @IsOptional() @IsEnum(['ACTIVE', 'SUSPENDED', 'TERMINATED'])
  status?: 'ACTIVE' | 'SUSPENDED' | 'TERMINATED'
}
