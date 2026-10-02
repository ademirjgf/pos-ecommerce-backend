import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module.js';
import { InventoryModule } from '../inventory/inventory.module.js';

import { PaymentsController } from './payments.controller.js';
import { PaymentsService } from './payments.service.js';
import { PaymentReconciliationJob } from './payment-reconciliation.job.js';

@Module({
  imports: [
    AuthModule,
    InventoryModule,
  ],
  controllers: [PaymentsController],
  providers: [
    PaymentsService,
    PaymentReconciliationJob,
  ],
  exports: [PaymentsService],
})
export class PaymentsModule {}