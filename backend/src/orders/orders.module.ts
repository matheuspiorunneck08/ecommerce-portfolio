import { Module } from '@nestjs/common';
import { AddressesModule } from '../addresses/addresses.module';
import { OrdersService } from './orders.service';
import { OrdersController } from './orders.controller';

@Module({
  imports: [AddressesModule],
  controllers: [OrdersController],
  providers: [OrdersService],
})
export class OrdersModule {}
