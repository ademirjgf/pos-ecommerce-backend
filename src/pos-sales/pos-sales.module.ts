import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module.js';
import { InventoryModule } from '../inventory/inventory.module.js';
import { PosSalesController } from './pos-sales.controller.js';
import { PosSalesService } from './pos-sales.service.js';

@Module({
  imports: [AuthModule, InventoryModule],
  controllers: [PosSalesController],
  providers: [PosSalesService],
  exports: [PosSalesService],
})
export class PosSalesModule {}