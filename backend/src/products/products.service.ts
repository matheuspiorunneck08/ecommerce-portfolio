import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { slugify } from '../common/slugify';
import { NotFoundError } from '../common/errors';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { ListProductsDto } from './dto/list-products.dto';

@Injectable()
export class ProductsService {
  constructor(private prisma: PrismaService) {}

  async list(query: ListProductsDto) {
    const where: Prisma.ProductWhereInput = {
      active: true,
      ...(query.search && {
        name: { contains: query.search, mode: 'insensitive' },
      }),
      ...(query.categoryId && {
        categories: { some: { categoryId: query.categoryId } },
      }),
    };

    const [products, total] = await this.prisma.$transaction([
      this.prisma.product.findMany({
        where,
        include: { categories: { include: { category: true } } },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.product.count({ where }),
    ]);

    return {
      data: products,
      meta: { total, page: query.page, limit: query.limit },
    };
  }

  // public read — hides deactivated products same as list()
  async findById(id: string) {
    const product = await this.findByIdInternal(id);
    if (!product.active) throw new NotFoundError('Product');
    return product;
  }

  async create(dto: CreateProductDto) {
    if (dto.categoryIds) await this.assertCategoriesExist(dto.categoryIds);

    return this.prisma.product.create({
      data: {
        name: dto.name,
        slug: slugify(dto.name),
        description: dto.description,
        priceCents: dto.priceCents,
        stock: dto.stock,
        imageUrl: dto.imageUrl,
        active: dto.active ?? true,
        categories: dto.categoryIds
          ? { create: dto.categoryIds.map((categoryId) => ({ categoryId })) }
          : undefined,
      },
    });
  }

  async update(id: string, dto: UpdateProductDto) {
    await this.findByIdInternal(id);
    if (dto.categoryIds) await this.assertCategoriesExist(dto.categoryIds);

    return this.prisma.product.update({
      where: { id },
      data: {
        name: dto.name,
        description: dto.description,
        priceCents: dto.priceCents,
        stock: dto.stock,
        imageUrl: dto.imageUrl,
        active: dto.active,
        ...(dto.categoryIds && {
          categories: {
            deleteMany: {},
            create: dto.categoryIds.map((categoryId) => ({ categoryId })),
          },
        }),
      },
    });
  }

  async remove(id: string) {
    await this.findByIdInternal(id);
    // FK from OrderItem is RESTRICT — deleting a product referenced by past
    // orders throws Prisma P2003, mapped to 409 by HttpExceptionFilter.
    await this.prisma.product.delete({ where: { id } });
  }

  // internal read — includes inactive products, used by admin write paths
  private async findByIdInternal(id: string) {
    const product = await this.prisma.product.findUnique({
      where: { id },
      include: { categories: { include: { category: true } } },
    });
    if (!product) throw new NotFoundError('Product');
    return product;
  }

  private async assertCategoriesExist(categoryIds: string[]) {
    const uniqueIds = [...new Set(categoryIds)];
    const count = await this.prisma.category.count({ where: { id: { in: uniqueIds } } });
    if (count !== uniqueIds.length) throw new NotFoundError('Category');
  }
}
