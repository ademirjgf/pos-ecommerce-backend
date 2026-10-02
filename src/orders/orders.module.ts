import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module.js';
import { InventoryModule } from '../inventory/inventory.module.js';

import { OrdersController } from './orders.controller.js';
import { OrdersService } from './orders.service.js';
import { ReservationExpiryService } from './reservation-expiry.service.js';

import { AdminOrdersController } from './admin-orders.controller.js';
import { AdminOrdersService } from './admin-orders.service.js';

@Module({
  imports: [
    AuthModule,
    InventoryModule,
  ],
  controllers: [
    OrdersController,
    AdminOrdersController,
  ],
  providers: [
    OrdersService,
    ReservationExpiryService,
    AdminOrdersService,
  ],
  exports: [OrdersService],
})
export class OrdersModule {}