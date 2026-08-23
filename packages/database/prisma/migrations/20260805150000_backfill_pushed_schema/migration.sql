-- CreateEnum
CREATE TYPE "SystemModule" AS ENUM ('ATTENDANCE', 'SHIFTS', 'LEAVES', 'PAYROLL', 'CUSTODY', 'UNIFORMS', 'ONBOARDING', 'APPROVALS', 'ROLES', 'AUDIT');

-- CreateEnum
CREATE TYPE "OnboardingType" AS ENUM ('NEW_HIRE', 'RETURN_FROM_LEAVE');

-- CreateEnum
CREATE TYPE "ApprovalRequestType" AS ENUM ('LEAVE', 'UNIFORM', 'ONBOARDING');

-- CreateEnum
CREATE TYPE "ApproverKind" AS ENUM ('ROLE', 'DEPT_HEAD', 'BRANCH_MANAGER');

-- CreateEnum
CREATE TYPE "ApprovalCaseStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "ApprovalFallbackTier" AS ENUM ('HR', 'SUPER_ADMIN');

-- CreateEnum
CREATE TYPE "ApprovalActionStatus" AS ENUM ('PENDING', 'SKIPPED', 'APPROVED', 'REJECTED');

-- AlterTable
ALTER TABLE "branches" ADD COLUMN     "managerEmployeeId" TEXT,
ADD COLUMN     "siteSupervisorEmployeeId" TEXT;

-- AlterTable
ALTER TABLE "departments" ADD COLUMN     "headEmployeeId" TEXT;

-- AlterTable
ALTER TABLE "job_titles" ADD COLUMN     "isShiftEligible" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "rotation_group_members" ADD COLUMN     "pinnedShiftId" TEXT;

-- AlterTable
ALTER TABLE "rotation_groups" ADD COLUMN     "supervisorEmployeeId" TEXT;

-- AlterTable
ALTER TABLE "rotation_plans" DROP COLUMN "rotateEveryDays",
DROP COLUMN "shiftIds",
ADD COLUMN     "workDaysBeforeRest" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "shifts" ADD COLUMN     "absentAfterMinutes" INTEGER NOT NULL DEFAULT 60,
ADD COLUMN     "checkInWindowMinutes" INTEGER NOT NULL DEFAULT 30,
ADD COLUMN     "checkOutEarlyMinutes" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "lateAfterMinutes" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "minStaffing" INTEGER;

-- AlterTable
ALTER TABLE "tenants" ADD COLUMN     "enabledModules" "SystemModule"[],
ADD COLUMN     "maxUsers" INTEGER,
ADD COLUMN     "subscriptionEndsAt" TIMESTAMP(3),
ADD COLUMN     "subscriptionStartsAt" TIMESTAMP(3),
ADD COLUMN     "subscriptionTemplateId" TEXT;

-- CreateTable
CREATE TABLE "platform_admins" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "platform_admins_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subscription_templates" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "modules" "SystemModule"[],
    "monthlyPrice" DECIMAL(10,2),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "subscription_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rotation_steps" (
    "id" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "shiftId" TEXT NOT NULL,
    "days" INTEGER NOT NULL,

    CONSTRAINT "rotation_steps_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "onboarding_requests" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "type" "OnboardingType" NOT NULL,
    "scheduledDate" DATE NOT NULL,
    "notes" TEXT,
    "status" "RequestStatus" NOT NULL DEFAULT 'PENDING',
    "approvedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "onboarding_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "approval_workflows" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "type" "ApprovalRequestType" NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "approval_workflows_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "approval_steps" (
    "id" TEXT NOT NULL,
    "workflowId" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "label" TEXT NOT NULL,
    "approverKind" "ApproverKind" NOT NULL,
    "roleId" TEXT,

    CONSTRAINT "approval_steps_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "approval_cases" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "workflowId" TEXT NOT NULL,
    "requestType" "ApprovalRequestType" NOT NULL,
    "requestId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "status" "ApprovalCaseStatus" NOT NULL DEFAULT 'PENDING',
    "currentOrder" INTEGER NOT NULL DEFAULT 1,
    "fallbackTier" "ApprovalFallbackTier",
    "decidedById" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "decidedAt" TIMESTAMP(3),

    CONSTRAINT "approval_cases_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "approval_actions" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "stepId" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "status" "ApprovalActionStatus" NOT NULL DEFAULT 'PENDING',
    "decidedBy" TEXT,
    "decidedAt" TIMESTAMP(3),
    "notes" TEXT,

    CONSTRAINT "approval_actions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "platform_admins_email_key" ON "platform_admins"("email");

-- CreateIndex
CREATE UNIQUE INDEX "rotation_steps_planId_order_key" ON "rotation_steps"("planId", "order");

-- CreateIndex
CREATE UNIQUE INDEX "approval_workflows_tenantId_type_key" ON "approval_workflows"("tenantId", "type");

-- CreateIndex
CREATE UNIQUE INDEX "approval_steps_workflowId_order_key" ON "approval_steps"("workflowId", "order");

-- CreateIndex
CREATE UNIQUE INDEX "approval_cases_requestType_requestId_key" ON "approval_cases"("requestType", "requestId");

-- CreateIndex
CREATE UNIQUE INDEX "approval_actions_caseId_order_key" ON "approval_actions"("caseId", "order");

-- CreateIndex
CREATE UNIQUE INDEX "employees_email_key" ON "employees"("email");

-- CreateIndex
CREATE UNIQUE INDEX "employees_tenantId_phone_key" ON "employees"("tenantId", "phone");

-- CreateIndex
CREATE UNIQUE INDEX "employees_tenantId_nationalId_key" ON "employees"("tenantId", "nationalId");

-- CreateIndex
CREATE UNIQUE INDEX "employees_tenantId_iban_key" ON "employees"("tenantId", "iban");

-- AddForeignKey
ALTER TABLE "tenants" ADD CONSTRAINT "tenants_subscriptionTemplateId_fkey" FOREIGN KEY ("subscriptionTemplateId") REFERENCES "subscription_templates"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "branches" ADD CONSTRAINT "branches_managerEmployeeId_fkey" FOREIGN KEY ("managerEmployeeId") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "branches" ADD CONSTRAINT "branches_siteSupervisorEmployeeId_fkey" FOREIGN KEY ("siteSupervisorEmployeeId") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "departments" ADD CONSTRAINT "departments_headEmployeeId_fkey" FOREIGN KEY ("headEmployeeId") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rotation_steps" ADD CONSTRAINT "rotation_steps_planId_fkey" FOREIGN KEY ("planId") REFERENCES "rotation_plans"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rotation_steps" ADD CONSTRAINT "rotation_steps_shiftId_fkey" FOREIGN KEY ("shiftId") REFERENCES "shifts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rotation_groups" ADD CONSTRAINT "rotation_groups_supervisorEmployeeId_fkey" FOREIGN KEY ("supervisorEmployeeId") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rotation_group_members" ADD CONSTRAINT "rotation_group_members_pinnedShiftId_fkey" FOREIGN KEY ("pinnedShiftId") REFERENCES "shifts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "onboarding_requests" ADD CONSTRAINT "onboarding_requests_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "onboarding_requests" ADD CONSTRAINT "onboarding_requests_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approval_workflows" ADD CONSTRAINT "approval_workflows_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approval_steps" ADD CONSTRAINT "approval_steps_workflowId_fkey" FOREIGN KEY ("workflowId") REFERENCES "approval_workflows"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approval_steps" ADD CONSTRAINT "approval_steps_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "roles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approval_cases" ADD CONSTRAINT "approval_cases_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approval_cases" ADD CONSTRAINT "approval_cases_workflowId_fkey" FOREIGN KEY ("workflowId") REFERENCES "approval_workflows"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approval_cases" ADD CONSTRAINT "approval_cases_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approval_cases" ADD CONSTRAINT "approval_cases_decidedById_fkey" FOREIGN KEY ("decidedById") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approval_actions" ADD CONSTRAINT "approval_actions_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "approval_cases"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approval_actions" ADD CONSTRAINT "approval_actions_stepId_fkey" FOREIGN KEY ("stepId") REFERENCES "approval_steps"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approval_actions" ADD CONSTRAINT "approval_actions_decidedBy_fkey" FOREIGN KEY ("decidedBy") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;

