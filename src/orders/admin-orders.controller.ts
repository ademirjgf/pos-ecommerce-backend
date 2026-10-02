import { ApiBearerAuth } from '@nestjs/swagger';
import {
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  UseGuards,
} from '@nestjs/common';

import { AdminOrdersService } from './admin-orders.service.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { Roles } from '../auth/decorators/roles.decorator.js';

@ApiBearerAuth('access-token')
@Controller('admin/orders')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
export class AdminOrdersController {
  constructor(
    private readonly adminOrdersService: AdminOrdersService,
  ) {}

  @Get()
  findAll() {
    return this.adminOrdersService.findAll();
  }

  @Patch(':id/in-transit')
  markInTransit(
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.adminOrdersService.markInTransit(id);
  }

  @Patch(':id/delivered')
  markDelivered(
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.adminOrdersService.markDelivered(id);
  }
}
