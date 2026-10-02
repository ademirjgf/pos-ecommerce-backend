import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module.js';
import { CartsController } from './carts.controller.js';
import { CartsService } from './carts.service.js';

@Module({
  imports: [AuthModule],
  controllers: [CartsController],
  providers: [CartsService],
  exports: [CartsService],
})
export class CartsModule {}