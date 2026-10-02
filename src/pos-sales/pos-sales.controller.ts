import { ApiBearerAuth } from '@nestjs/swagger';
import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';

import { PosSalesService } from './pos-sales.service.js';
import { AddPosSaleItemDto } from './dto/add-pos-sale-item.dto.js';
import { CheckoutPosSaleDto } from './dto/checkout-pos-sale.dto.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { Roles } from '../auth/decorators/roles.decorator.js';

@ApiBearerAuth('access-token')
@Controller('pos-sales')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN', 'CASHIER')
export class PosSalesController {
  constructor(
    private readonly posSalesService: PosSalesService,
  ) {}

  // Abrir venta
  @Post()
  open(
    @Req() request: { user: { id: number } },
  ) {
    return this.posSalesService.open(request.user.id);
  }

  // IMPORTANTE: esta ruta debe estar antes de GET(':id')
  @Get('open')
  findOpen(
    @Req() request: { user: { id: number } },
  ) {
    return this.posSalesService.findOpen(request.user.id);
  }

  // Consultar venta
  @Get(':id')
  findOne(
    @Param('id', ParseIntPipe) id: number,
    @Req() request: { user: { id: number } },
  ) {
    return this.posSalesService.findOne(
      id,
      request.user.id,
    );
  }

  // Agregar productos
  @Post(':id/items')
  addItem(
    @Param('id', ParseIntPipe) id: number,
    @Req() request: { user: { id: number } },
    @Body() dto: AddPosSaleItemDto,
  ) {
    return this.posSalesService.addItem(
      id,
      request.user.id,
      dto,
    );
  }

  // Confirmar pago
  @Post(':id/checkout')
  checkout(
    @Param('id', ParseIntPipe) id: number,
    @Req() request: { user: { id: number } },
    @Body() dto: CheckoutPosSaleDto,
  ) {
    return this.posSalesService.checkout(
      id,
      request.user.id,
      dto,
    );
  }

  // Cancelar venta
  @Post(':id/cancel')
  cancel(
    @Param('id', ParseIntPipe) id: number,
    @Req() request: { user: { id: number } },
  ) {
    return this.posSalesService.cancel(
      id,
      request.user.id,
    );
  }
}
