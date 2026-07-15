import { Controller, Post, Body, Headers, RawBodyRequest, Req, UseGuards } from '@nestjs/common'
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger'
import { Request } from 'express'
import { SubscriptionsService } from './subscriptions.service'
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard'
import { CurrentUser } from '../../common/decorators/current-user.decorator'
import { Public } from '../../common/decorators/public.decorator'
import { JwtPayload } from '@shift-saas/types'

@ApiTags('Subscriptions')
@Controller('subscriptions')
export class SubscriptionsController {
  constructor(private subscriptionsService: SubscriptionsService) {}

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Post('checkout')
  checkout(
    @CurrentUser() user: JwtPayload,
    @Body() body: { interval: 'monthly' | 'quarterly' | 'annual'; successUrl: string; cancelUrl: string },
  ) {
    return this.subscriptionsService.createCheckoutSession(
      user.tenantId,
      body.interval,
      body.successUrl,
      body.cancelUrl,
    )
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Post('portal')
  portal(@CurrentUser() user: JwtPayload, @Body() body: { returnUrl: string }) {
    return this.subscriptionsService.getPortalUrl(user.tenantId, body.returnUrl)
  }

  // Stripe webhook — must be public and receive raw body
  @Public()
  @Post('webhook')
  webhook(
    @Req() req: RawBodyRequest<Request>,
    @Headers('stripe-signature') signature: string,
  ) {
    return this.subscriptionsService.handleWebhook(req.rawBody!, signature)
  }
}
