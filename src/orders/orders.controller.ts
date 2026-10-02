import { ApiBearerAuth } from '@nestjs/swagger';
import {
  Body,
  Controller,
  Get,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';

import { OrdersService } from './orders.service.js';
import { CheckoutOrderDto } from './dto/checkout-order.dto.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { Roles } from '../auth/decorators/roles.decorator.js';

@ApiBearerAuth('access-token')
@Controller('orders')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('CUSTOMER')
export class OrdersController {
  constructor(
    private readonly ordersService: OrdersService,
  ) {}

  @Post('checkout')
  checkout(
    @Req() request: { user: { id: number } },
    @Body() dto: CheckoutOrderDto,
  ) {
    return this.ordersService.checkout(
      request.user.id,
      dto,
    );
  }

  @Get()
  findAll(
    @Req() request: { user: { id: number } },
  ) {
    return this.ordersService.findAll(request.user.id);
  }
}
