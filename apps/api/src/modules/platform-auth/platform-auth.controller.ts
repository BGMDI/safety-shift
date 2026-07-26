import { Controller, Post, Body } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'
import { PlatformAuthService } from './platform-auth.service'
import { PlatformLoginDto, PlatformBootstrapDto } from './dto/platform-login.dto'

@ApiTags('PlatformAuth')
@Controller('platform-auth')
export class PlatformAuthController {
  constructor(private svc: PlatformAuthService) {}

  @Post('login')
  login(@Body() dto: PlatformLoginDto) { return this.svc.login(dto) }

  /** يعمل مرة واحدة فقط لإنشاء أول حساب مالك منصة */
  @Post('bootstrap')
  bootstrap(@Body() dto: PlatformBootstrapDto) { return this.svc.bootstrap(dto) }
}
