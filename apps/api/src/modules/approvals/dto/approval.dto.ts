import { IsString, IsOptional, IsEnum, IsUUID, IsArray, ValidateNested } from 'class-validator'
import { Type } from 'class-transformer'

const REQUEST_TYPES = ['LEAVE', 'UNIFORM', 'ONBOARDING'] as const
const APPROVER_KINDS = ['ROLE', 'DEPT_HEAD', 'BRANCH_MANAGER'] as const

export class ApprovalStepDto {
  @IsString() label!: string
  @IsEnum(APPROVER_KINDS) approverKind!: 'ROLE' | 'DEPT_HEAD' | 'BRANCH_MANAGER'
  @IsOptional() @IsUUID() roleId?: string
}

export class SaveWorkflowDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ApprovalStepDto)
  steps!: ApprovalStepDto[]
}

export class DecideCaseDto {
  @IsEnum(['APPROVED', 'REJECTED']) decision!: 'APPROVED' | 'REJECTED'
  @IsOptional() @IsString() notes?: string
}

export { REQUEST_TYPES, APPROVER_KINDS }
