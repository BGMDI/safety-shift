import { Injectable, BadRequestException } from '@nestjs/common'
import Stripe from 'stripe'
import { prisma } from '@shift-saas/database'
import { PlanInterval } from '@shift-saas/types'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2024-04-10' })

const PLAN_PRICE_IDS: Record<PlanInterval, string> = {
  monthly: process.env.STRIPE_PRICE_MONTHLY!,
  quarterly: process.env.STRIPE_PRICE_QUARTERLY!,
  annual: process.env.STRIPE_PRICE_ANNUAL!,
}

@Injectable()
export class SubscriptionsService {
  async createCheckoutSession(tenantId: string, interval: PlanInterval, successUrl: string, cancelUrl: string) {
    const tenant = await prisma.tenant.findUniqueOrThrow({ where: { id: tenantId } })

    let customerId = tenant.stripeCustomerId

    if (!customerId) {
      const customer = await stripe.customers.create({ name: tenant.name, metadata: { tenantId } })
      customerId = customer.id
      await prisma.tenant.update({ where: { id: tenantId }, data: { stripeCustomerId: customerId } })
    }

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: 'subscription',
      line_items: [{ price: PLAN_PRICE_IDS[interval], quantity: 1 }],
      success_url: successUrl,
      cancel_url: cancelUrl,
      metadata: { tenantId, interval },
    })

    return { url: session.url }
  }

  async handleWebhook(rawBody: Buffer, signature: string) {
    let event: Stripe.Event

    try {
      event = stripe.webhooks.constructEvent(rawBody, signature, process.env.STRIPE_WEBHOOK_SECRET!)
    } catch {
      throw new BadRequestException('توقيع Webhook غير صالح')
    }

    switch (event.type) {
      case 'customer.subscription.created':
      case 'customer.subscription.updated': {
        const sub = event.data.object as Stripe.Subscription
        const tenantId = sub.metadata.tenantId
        const interval = sub.metadata.interval as PlanInterval

        await prisma.tenant.update({
          where: { id: tenantId },
          data: {
            plan: interval === 'monthly' ? 'MONTHLY' : interval === 'quarterly' ? 'QUARTERLY' : 'ANNUAL',
            planStatus: sub.status === 'active' ? 'ACTIVE' : 'EXPIRED',
          },
        })
        break
      }
      case 'customer.subscription.deleted': {
        const sub = event.data.object as Stripe.Subscription
        await prisma.tenant.update({
          where: { stripeCustomerId: sub.customer as string },
          data: { planStatus: 'CANCELLED' },
        })
        break
      }
    }

    return { received: true }
  }

  async getPortalUrl(tenantId: string, returnUrl: string) {
    const tenant = await prisma.tenant.findUniqueOrThrow({ where: { id: tenantId } })
    if (!tenant.stripeCustomerId) throw new BadRequestException('لا يوجد اشتراك نشط')

    const session = await stripe.billingPortal.sessions.create({
      customer: tenant.stripeCustomerId,
      return_url: returnUrl,
    })

    return { url: session.url }
  }
}
