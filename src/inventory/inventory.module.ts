import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module.js';

import { InventoryController } from './inventory.controller.js';
import { InventoryService } from './inventory.service.js';
import { InventoryAdminService } from './inventory-admin.service.js';

@Module({
  imports: [AuthModule],
  controllers: [InventoryController],
  providers: [
    InventoryService,
    InventoryAdminService,
  ],
  exports: [InventoryService],
})
export class InventoryModule {}