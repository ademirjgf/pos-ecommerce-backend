import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module.js';
import { CashSessionsController } from './cash-sessions.controller.js';
import { CashSessionsService } from './cash-sessions.service.js';

@Module({
  imports: [AuthModule],
  controllers: [CashSessionsController],
  providers: [CashSessionsService],
  exports: [CashSessionsService],
})
export class CashSessionsModule {}