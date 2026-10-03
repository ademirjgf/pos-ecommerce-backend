import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Body, Controller, Post, UseGuards } from '@nestjs/common';

import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { CreateManualOrderDto } from './dto/create-manual-order.dto.js';
import { ManualOrdersService } from './manual-orders.service.js';

@ApiTags('Admin Orders')
@ApiBearerAuth('access-token')
@Controller('admin/orders')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
export class ManualOrdersController {
  constructor(private readonly manualOrdersService: ManualOrdersService) {}

  @Post('manual')
  @ApiOperation({
    summary: 'Registrar pedido de Marketplace o venta externa ya pagada',
    description:
      'ADMIN confirma un pago recibido fuera de esta API; el stock se descuenta de forma transaccional. El delivery lo paga el cliente directamente al conductor y NO se suma al total.',
  })
  create(@Body() dto: CreateManualOrderDto) {
    return this.manualOrdersService.createPaidExternalOrder(dto);
  }
}
