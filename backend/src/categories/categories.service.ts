import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { slugify } from '../common/slugify';
import { NotFoundError } from '../common/errors';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';

@Injectable()
export class CategoriesService {
  constructor(private prisma: PrismaService) {}

  list() {
    return this.prisma.category.findMany({ orderBy: { name: 'asc' } });
  }

  async findById(id: string) {
    const category = await this.prisma.category.findUnique({ where: { id } });
    if (!category) throw new NotFoundError('Category');
    return category;
  }

  create(dto: CreateCategoryDto) {
    return this.prisma.category.create({
      data: { name: dto.name, slug: slugify(dto.name) },
    });
  }

  async update(id: string, dto: UpdateCategoryDto) {
    await this.findById(id);
    return this.prisma.category.update({
      where: { id },
      data: {
        name: dto.name,
        ...(dto.name && { slug: slugify(dto.name) }),
      },
    });
  }

  async remove(id: string) {
    await this.findById(id);
    // ProductCategory.category has onDelete: Cascade — join rows go with it
    await this.prisma.category.delete({ where: { id } });
  }
}
