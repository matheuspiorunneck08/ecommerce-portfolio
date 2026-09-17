import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { AddressesService } from './addresses.service';
import { CreateAddressDto } from './dto/create-address.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';

interface AuthenticatedUser {
  id: string;
}

@UseGuards(JwtAuthGuard)
@Controller('addresses')
export class AddressesController {
  constructor(private addresses: AddressesService) {}

  @Get()
  list(@CurrentUser() user: AuthenticatedUser) {
    return this.addresses.list(user.id);
  }

  @Post()
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateAddressDto) {
    return this.addresses.create(user.id, dto);
  }
}
