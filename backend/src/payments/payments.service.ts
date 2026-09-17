import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Stripe from 'stripe';
import { OrderStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { BadRequestError, ConflictError, ForbiddenError, NotFoundError } from '../common/errors';
import { canTransition } from '../common/order-status-transitions';

@Injectable()
export class PaymentsService {
  private stripe: Stripe;

  constructor(
    private prisma: PrismaService,
    private config: ConfigService,
  ) {
    this.stripe = new Stripe(this.config.getOrThrow<string>('STRIPE_SECRET_KEY'));
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
      success_url: `${this.config.getOrThrow<string>('FRONTEND_URL')}/orders/${order.id}?payment=success`,
      cancel_url: `${this.config.getOrThrow<string>('FRONTEND_URL')}/orders/${order.id}?payment=cancelled`,
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
        this.config.getOrThrow<string>('STRIPE_WEBHOOK_SECRET'),
      );
    } catch {
      throw new BadRequestError('Invalid webhook signature');
    }

    if (event.type === 'checkout.session.completed') {
      const session = event.data.object as Stripe.Checkout.Session;
      await this.markOrderPaid(session.metadata?.orderId);
    }

    if (event.type === 'checkout.session.expired') {
      const session = event.data.object as Stripe.Checkout.Session;
      await this.markPaymentFailed(session.metadata?.orderId);
    }
  }

  // webhook deliveries can repeat or arrive late — only act while the order
  // is still in a state that legitimately allows the transition
  private async markOrderPaid(orderId: string | undefined) {
    if (!orderId) return;

    const order = await this.prisma.order.findUnique({ where: { id: orderId } });
    if (!order || !canTransition(order.status, OrderStatus.PAID)) return;

    await this.prisma.$transaction([
      this.prisma.payment.update({ where: { orderId }, data: { status: 'SUCCEEDED' } }),
      this.prisma.order.update({ where: { id: orderId }, data: { status: 'PAID' } }),
    ]);
  }

  private async markPaymentFailed(orderId: string | undefined) {
    if (!orderId) return;

    const payment = await this.prisma.payment.findUnique({ where: { orderId } });
    if (!payment || payment.status !== 'PENDING') return;

    await this.prisma.payment.update({ where: { orderId }, data: { status: 'FAILED' } });
  }
}
