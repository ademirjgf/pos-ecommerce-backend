import { ApiBearerAuth } from '@nestjs/swagger';
import {
  Controller,
  Param,
  ParseIntPipe,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';

import { PaymentsService } from './payments.service.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { Roles } from '../auth/decorators/roles.decorator.js';

@ApiBearerAuth('access-token')
@Controller('payments')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('CUSTOMER')
export class PaymentsController {
  constructor(
    private readonly paymentsService: PaymentsService,
  ) {}

  @Post('orders/:orderId/checkout')
  createCheckout(
    @Param('orderId', ParseIntPipe) orderId: number,
    @Req() request: { user: { id: number } },
  ) {
    return this.paymentsService.createCheckout(
      request.user.id,
      orderId,
    );
  }

  @Post('orders/:orderId/reconcile')
  reconcile(
    @Param('orderId', ParseIntPipe) orderId: number,
    @Req() request: { user: { id: number } },
  ) {
    return this.paymentsService.reconcile(
      request.user.id,
      orderId,
    );
  }
}
