
import { ApiBearerAuth } from '@nestjs/swagger';
import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Query,
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

  // Abrir una venta
  @Post()
  open(
    @Req() request: { user: { id: number } },
  ) {
    return this.posSalesService.open(request.user.id);
  }

  // Consultar ventas abiertas del cajero
  @Get('open')
  findOpen(
    @Req() request: { user: { id: number } },
  ) {
    return this.posSalesService.findOpen(request.user.id);
  }

  // Consultar historial de ventas pagadas por fecha
  // Debe declararse antes de @Get(':id')
  @Get('history')
  findHistory(
    @Req() request: { user: { id: number } },
    @Query('date') date: string,
  ) {
    if (
      !date ||
      !/^\d{4}-\d{2}-\d{2}$/.test(date)
    ) {
      throw new BadRequestException(
        'Debes proporcionar una fecha válida en formato YYYY-MM-DD',
      );
    }

    const inicio = new Date(`${date}T00:00:00-05:00`);

    if (
      Number.isNaN(inicio.getTime()) ||
      inicio.toISOString().slice(0, 10) !== date
    ) {
      throw new BadRequestException('Fecha inválida');
    }

    return this.posSalesService.findHistory(
      request.user.id,
      date,
    );
  }

  // Consultar una venta específica
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

  // Agregar productos a una venta
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

  // Cancelar una venta
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
