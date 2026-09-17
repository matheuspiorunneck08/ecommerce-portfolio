import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ProductsService } from '../products/products.service';
import { InsufficientStockError, NotFoundError } from '../common/errors';
import { AddCartItemDto } from './dto/add-cart-item.dto';
import { UpdateCartItemDto } from './dto/update-cart-item.dto';

@Injectable()
export class CartService {
  constructor(
    private prisma: PrismaService,
    private products: ProductsService,
  ) {}

  getOrCreateCart(userId: string) {
    // upsert avoids the check-then-create race of findUnique + create
    return this.prisma.cart.upsert({
      where: { userId },
      update: {},
      create: { userId },
      include: { items: { include: { product: true } } },
    });
  }

  async addItem(userId: string, dto: AddCartItemDto) {
    const product = await this.products.findById(dto.productId);
    const cart = await this.getOrCreateCart(userId);

    const existingItem = cart.items.find((item) => item.productId === dto.productId);
    const requestedQuantity = (existingItem?.quantity ?? 0) + dto.quantity;
    if (requestedQuantity > product.stock) throw new InsufficientStockError(product.stock);

    await this.prisma.cartItem.upsert({
      where: { cartId_productId: { cartId: cart.id, productId: dto.productId } },
      update: { quantity: requestedQuantity },
      create: { cartId: cart.id, productId: dto.productId, quantity: dto.quantity },
    });

    return this.getOrCreateCart(userId);
  }

  async updateItem(userId: string, productId: string, dto: UpdateCartItemDto) {
    const cart = await this.getOrCreateCart(userId);
    const item = cart.items.find((i) => i.productId === productId);
    if (!item) throw new NotFoundError('Cart item');
    if (dto.quantity > item.product.stock) throw new InsufficientStockError(item.product.stock);

    await this.prisma.cartItem.update({
      where: { cartId_productId: { cartId: cart.id, productId } },
      data: { quantity: dto.quantity },
    });

    return this.getOrCreateCart(userId);
  }

  async removeItem(userId: string, productId: string) {
    const cart = await this.getOrCreateCart(userId);
    const item = cart.items.find((i) => i.productId === productId);
    if (!item) throw new NotFoundError('Cart item');

    await this.prisma.cartItem.delete({
      where: { cartId_productId: { cartId: cart.id, productId } },
    });

    return this.getOrCreateCart(userId);
  }

  async clear(userId: string) {
    const cart = await this.getOrCreateCart(userId);
    await this.prisma.cartItem.deleteMany({ where: { cartId: cart.id } });
  }
}
