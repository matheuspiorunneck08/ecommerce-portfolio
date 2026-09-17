import { Module } from '@nestjs/common';
import { ProductsModule } from '../products/products.module';
import { CartService } from './cart.service';
import { CartController } from './cart.controller';

@Module({
  imports: [ProductsModule],
  controllers: [CartController],
  providers: [CartService],
})
export class CartModule {}
