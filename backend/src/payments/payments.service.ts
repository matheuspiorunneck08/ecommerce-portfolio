import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Stripe from 'stripe';
import { PrismaService } from '../prisma/prisma.service';
import { BadRequestError, ConflictError, ForbiddenError, NotFoundError } from '../common/errors';

@Injectable()
export class PaymentsService {
  private stripe: Stripe;

  constructor(
    private prisma: PrismaService,
    private config: ConfigService,
  ) {
    this.stripe = new Stripe(this.config.get<string>('STRIPE_SECRET_KEY'));
  }

  async createCheckoutSession(userId: string, orderId: string) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { items: true, payment: true },
    });
    if (!order) throw new NotFoundError('Order');
    if (order.userId !== userId) throw new ForbiddenError();
    if (order.status !== 'PENDING') throw new ConflictError('Order is not payable');

    const session = await this.stripe.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card'],
      line_items: order.items.map((item) => ({
        quantity: item.quantity,
        price_data: {
          currency: 'brl',
          unit_amount: item.unitPriceCents,
          product_data: { name: item.productName },
        },
      })),
      success_url: `${this.config.get<string>('FRONTEND_URL')}/orders/${order.id}?payment=success`,
      cancel_url: `${this.config.get<string>('FRONTEND_URL')}/orders/${order.id}?payment=cancelled`,
      metadata: { orderId: order.id },
    });

    await this.prisma.payment.update({
      where: { orderId: order.id },
      data: { providerId: session.id },
    });

    return { url: session.url };
  }

  async handleWebhook(rawBody: Buffer, signature: string) {
    let event: Stripe.Event;
    try {
      event = this.stripe.webhooks.constructEvent(
        rawBody,
        signature,
        this.config.get<string>('STRIPE_WEBHOOK_SECRET'),
      );
    } catch {
      throw new BadRequestError('Invalid webhook signature');
    }

    if (event.type === 'checkout.session.completed') {
      const session = event.data.object as Stripe.Checkout.Session;
      await this.markOrderPaid(session.metadata.orderId);
    }

    if (event.type === 'checkout.session.expired') {
      const session = event.data.object as Stripe.Checkout.Session;
      await this.markPaymentFailed(session.metadata.orderId);
    }
  }

  private async markOrderPaid(orderId: string) {
    await this.prisma.$transaction([
      this.prisma.payment.update({ where: { orderId }, data: { status: 'SUCCEEDED' } }),
      this.prisma.order.update({ where: { id: orderId }, data: { status: 'PAID' } }),
    ]);
  }

  private markPaymentFailed(orderId: string) {
    return this.prisma.payment.update({ where: { orderId }, data: { status: 'FAILED' } });
  }
}
