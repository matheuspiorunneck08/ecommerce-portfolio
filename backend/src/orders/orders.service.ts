import { Injectable } from '@nestjs/common';
import { OrderStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AddressesService } from '../addresses/addresses.service';
import { ConflictError, ForbiddenError, InsufficientStockError, NotFoundError } from '../common/errors';
import { CreateOrderDto } from './dto/create-order.dto';

const ORDER_INCLUDE = { items: true, payment: true } as const;

@Injectable()
export class OrdersService {
  constructor(
    private prisma: PrismaService,
    private addresses: AddressesService,
  ) {}

  async create(userId: string, dto: CreateOrderDto) {
    await this.addresses.assertBelongsToUser(dto.addressId, userId);

    const cart = await this.prisma.cart.findUnique({
      where: { userId },
      include: { items: { include: { product: true } } },
    });
    if (!cart || cart.items.length === 0) throw new ConflictError('Cart is empty');

    for (const item of cart.items) {
      if (item.quantity > item.product.stock) throw new InsufficientStockError(item.product.stock);
    }

    const totalCents = cart.items.reduce((sum, item) => sum + item.quantity * item.product.priceCents, 0);

    return this.prisma.$transaction(async (tx) => {
      const order = await tx.order.create({
        data: {
          userId,
          addressId: dto.addressId,
          totalCents,
          items: {
            create: cart.items.map((item) => ({
              productId: item.productId,
              productName: item.product.name,
              unitPriceCents: item.product.priceCents,
              quantity: item.quantity,
            })),
          },
          payment: { create: { amountCents: totalCents } },
        },
        include: ORDER_INCLUDE,
      });

      for (const item of cart.items) {
        await tx.product.update({
          where: { id: item.productId },
          data: { stock: { decrement: item.quantity } },
        });
      }

      await tx.cartItem.deleteMany({ where: { cartId: cart.id } });

      return order;
    });
  }

  list(userId: string) {
    return this.prisma.order.findMany({
      where: { userId },
      include: ORDER_INCLUDE,
      orderBy: { createdAt: 'desc' },
    });
  }

  async findById(userId: string, isAdmin: boolean, id: string) {
    const order = await this.prisma.order.findUnique({
      where: { id },
      include: { ...ORDER_INCLUDE, address: true },
    });
    if (!order) throw new NotFoundError('Order');
    if (!isAdmin && order.userId !== userId) throw new ForbiddenError();
    return order;
  }

  async updateStatus(id: string, status: OrderStatus) {
    const order = await this.prisma.order.findUnique({ where: { id } });
    if (!order) throw new NotFoundError('Order');

    return this.prisma.order.update({ where: { id }, data: { status } });
  }
}
