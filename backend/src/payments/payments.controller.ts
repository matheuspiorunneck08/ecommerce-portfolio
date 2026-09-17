import { Controller, Headers, Param, Post, RawBodyRequest, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { PaymentsService } from './payments.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';

interface AuthenticatedUser {
  id: string;
}

@Controller('payments')
export class PaymentsController {
  constructor(private payments: PaymentsService) {}

  @UseGuards(JwtAuthGuard)
  @Post('orders/:orderId/checkout-session')
  createCheckoutSession(@CurrentUser() user: AuthenticatedUser, @Param('orderId') orderId: string) {
    return this.payments.createCheckoutSession(user.id, orderId);
  }

  @Post('webhook')
  handleWebhook(@Req() req: RawBodyRequest<Request>, @Headers('stripe-signature') signature: string) {
    return this.payments.handleWebhook(req.rawBody, signature);
  }
}
