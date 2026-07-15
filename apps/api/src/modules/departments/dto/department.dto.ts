import { IsString, IsOptional, IsUUID } from 'class-validator'

export class CreateDepartmentDto {
  @IsString()
  name!: string

  @IsOptional() @IsUUID() parentId?: string
  @IsOptional() @IsUUID() branchId?: string
}

export class UpdateDepartmentDto {
  @IsOptional() @IsString() name?: string
  @IsOptional() @IsUUID()   parentId?: string
  @IsOptional() @IsUUID()   branchId?: string
}
