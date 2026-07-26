import { SetMetadata } from '@nestjs/common'

export const REQUIRES_MODULE_KEY = 'requiresModule'

/** يقيّد الوصول لهذا المتحكم/المسار بشركة فعّلت هذا القسم في اشتراكها — الموظفون والهيكل التنظيمي أساسيان دائماً ولا يحتاجان هذا الديكوريتور */
export const RequiresModule = (module: string) => SetMetadata(REQUIRES_MODULE_KEY, module)
