import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common'
import { prisma } from '@shift-saas/database'

@Injectable()
export class TenantsService {
  private readonly certificateSelect = {
    id: true, name: true, logo: true,
    salaryCertificateText: true, employmentCertificateText: true,
    certificateSignature: true, certificateStamp: true,
    certificateHeader: true, certificateFooter: true,
    certificateSignerName: true, certificateSignerTitle: true,
    payrollInsuranceRate: true,
    payrollBasicRate: true, payrollHousingRate: true, payrollTransportRate: true,
  }
  /** بيانات عرض الشركة الأساسية لأي موظف مسجّل دخول — الاسم والشعار فقط */
  async getMine(tenantId: string) {
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { id: true, name: true, logo: true },
    })
    if (!tenant) throw new NotFoundException('الشركة غير موجودة')
    return tenant
  }

  async getCertificateSettings(tenantId: string) {
    const tenant = await prisma.tenant.findUnique({ where: { id: tenantId }, select: this.certificateSelect })
    if (!tenant) throw new NotFoundException('الشركة غير موجودة')
    return tenant
  }

  async updateCertificateSettings(tenantId: string, data: { salaryCertificateText?: string; employmentCertificateText?: string; certificateSignerName?: string; certificateSignerTitle?: string; payrollInsuranceRate?: number; payrollBasicRate?: number; payrollHousingRate?: number; payrollTransportRate?: number }) {
    const current = await this.getCertificateSettings(tenantId)
    const rates = [data.payrollBasicRate ?? current.payrollBasicRate, data.payrollHousingRate ?? current.payrollHousingRate, data.payrollTransportRate ?? current.payrollTransportRate].map(Number)
    if (Math.abs(rates.reduce((sum, rate) => sum + rate, 0) - 100) > 0.001) {
      throw new BadRequestException('يجب أن يكون مجموع نسب الأساسي والسكن والمواصلات 100٪')
    }
    return prisma.tenant.update({
      where: { id: tenantId },
      data: {
        salaryCertificateText: data.salaryCertificateText?.trim() || null,
        employmentCertificateText: data.employmentCertificateText?.trim() || null,
        certificateSignerName: data.certificateSignerName?.trim() || null,
        certificateSignerTitle: data.certificateSignerTitle?.trim() || null,
        payrollInsuranceRate: data.payrollInsuranceRate,
        payrollBasicRate: data.payrollBasicRate,
        payrollHousingRate: data.payrollHousingRate,
        payrollTransportRate: data.payrollTransportRate,
      },
      select: this.certificateSelect,
    })
  }

  async updateCertificateAsset(tenantId: string, kind: 'signature' | 'stamp' | 'header' | 'footer', url: string) {
    await this.getCertificateSettings(tenantId)
    return prisma.tenant.update({
      where: { id: tenantId },
      data: kind === 'signature' ? { certificateSignature: url }
        : kind === 'stamp' ? { certificateStamp: url }
        : kind === 'header' ? { certificateHeader: url }
        : { certificateFooter: url },
      select: this.certificateSelect,
    })
  }
}
