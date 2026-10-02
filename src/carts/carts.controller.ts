import { ApiBearerAuth } from '@nestjs/swagger';
import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';

import { CartsService } from './carts.service.js';
import { AddCartItemDto } from './dto/add-cart-item.dto.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { Roles } from '../auth/decorators/roles.decorator.js';

@ApiBearerAuth('access-token')
@Controller('carts')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('CUSTOMER')
export class CartsController {
  constructor(
    private readonly cartsService: CartsService,
  ) {}

  @Get()
  findCurrent(
    @Req() request: { user: { id: number } },
  ) {
    return this.cartsService.findCurrent(request.user.id);
  }

  @Post('items')
  addItem(
    @Req() request: { user: { id: number } },
    @Body() dto: AddCartItemDto,
  ) {
    return this.cartsService.addItem(
      request.user.id,
      dto,
    );
  }

  @Delete('items/:productId')
  removeItem(
    @Req() request: { user: { id: number } },
    @Param('productId', ParseIntPipe) productId: number,
  ) {
    return this.cartsService.removeItem(
      request.user.id,
      productId,
    );
  }
}
