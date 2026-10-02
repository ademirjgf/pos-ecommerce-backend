import { ApiBearerAuth } from '@nestjs/swagger';
import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  UseGuards,
} from '@nestjs/common';

import { InventoryAdminService } from './inventory-admin.service.js';
import { RestockDto } from './dto/restock.dto.js';

import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { Roles } from '../auth/decorators/roles.decorator.js';

@ApiBearerAuth('access-token')
@Controller('inventory')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
export class InventoryController {
  constructor(
    private readonly inventoryAdminService: InventoryAdminService,
  ) {}

  @Get()
  findAll() {
    return this.inventoryAdminService.findAll();
  }

  @Post(':productId/restock')
  restock(
    @Param('productId', ParseIntPipe) productId: number,
    @Body() dto: RestockDto,
  ) {
    return this.inventoryAdminService.restock(
      productId,
      dto,
    );
  }
}
