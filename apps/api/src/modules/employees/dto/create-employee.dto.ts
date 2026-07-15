import { IsString, IsEmail, IsOptional, IsDateString, MinLength, IsUUID } from 'class-validator'

export class CreateEmployeeDto {
  @IsOptional() @IsString() employeeCode?: string
  @IsOptional() @IsString() codePrefix?: string

  @IsOptional() @IsString() fullName?: string          // يُحسب تلقائياً إذا أُرسلت الأجزاء
  @IsOptional() @IsString() firstName?: string
  @IsOptional() @IsString() fatherName?: string
  @IsOptional() @IsString() grandfatherName?: string
  @IsOptional() @IsString() familyName?: string
  @IsUUID()   branchId!: string

  @IsOptional() @IsUUID()       departmentId?: string
  @IsOptional() @IsUUID()       jobTitleId?: string
  @IsDateString()               hireDate!: string
  @IsOptional() @IsEmail()      email?: string
  @IsOptional() @IsString()     phone?: string
  @IsOptional() @IsString()     nationalId?: string
  @IsOptional() @IsDateString() idExpiryDate?: string
  @IsOptional() @IsString()     nationality?: string
  @IsOptional() @IsDateString() birthDate?: string
  @IsOptional() @IsString()     qualification?: string
  @IsOptional() @IsString()     specialization?: string
  @IsOptional() @IsString()     iban?: string
  @IsOptional() @IsString() @MinLength(8) password?: string
}
