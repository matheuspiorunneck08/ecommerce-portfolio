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

  async getOrCreateCart(userId: string) {
    const cart = await this.findCartByUserId(userId);
    if (cart) return cart;

    return this.prisma.cart.create({
      data: { userId },
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
    const product = await this.products.findById(productId);
    if (dto.quantity > product.stock) throw new InsufficientStockError(product.stock);

    const cart = await this.getOrCreateCart(userId);
    await this.assertItemExists(cart.id, productId);

    await this.prisma.cartItem.update({
      where: { cartId_productId: { cartId: cart.id, productId } },
      data: { quantity: dto.quantity },
    });

    return this.getOrCreateCart(userId);
  }

  async removeItem(userId: string, productId: string) {
    const cart = await this.getOrCreateCart(userId);
    await this.assertItemExists(cart.id, productId);

    await this.prisma.cartItem.delete({
      where: { cartId_productId: { cartId: cart.id, productId } },
    });

    return this.getOrCreateCart(userId);
  }

  async clear(userId: string) {
    const cart = await this.getOrCreateCart(userId);
    await this.prisma.cartItem.deleteMany({ where: { cartId: cart.id } });
  }

  private findCartByUserId(userId: string) {
    return this.prisma.cart.findUnique({
      where: { userId },
      include: { items: { include: { product: true } } },
    });
  }

  private async assertItemExists(cartId: string, productId: string) {
    const item = await this.prisma.cartItem.findUnique({
      where: { cartId_productId: { cartId, productId } },
    });
    if (!item) throw new NotFoundError('Cart item');
  }
}
