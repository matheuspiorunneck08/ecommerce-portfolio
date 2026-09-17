import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotFoundError } from '../common/errors';
import { CreateAddressDto } from './dto/create-address.dto';

@Injectable()
export class AddressesService {
  constructor(private prisma: PrismaService) {}

  list(userId: string) {
    return this.prisma.address.findMany({ where: { userId } });
  }

  create(userId: string, dto: CreateAddressDto) {
    return this.prisma.address.create({ data: { ...dto, userId } });
  }

  async assertBelongsToUser(id: string, userId: string) {
    const address = await this.prisma.address.findFirst({ where: { id, userId } });
    if (!address) throw new NotFoundError('Address');
    return address;
  }
}
