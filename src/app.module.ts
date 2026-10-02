import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import Joi from 'joi';

import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { PrismaModule } from './prisma/prisma.module.js';
import { AuthModule } from './auth/auth.module.js';
import { CategoriesModule } from './categories/categories.module.js';
import { ProductsModule } from './products/products.module.js';
import { InventoryModule } from './inventory/inventory.module.js';
import { CashSessionsModule } from './cash-sessions/cash-sessions.module.js';
import { PosSalesModule } from './pos-sales/pos-sales.module.js';
import { CartsModule } from './carts/carts.module.js';
import { AddressesModule } from './addresses/addresses.module.js';
import { OrdersModule } from './orders/orders.module.js';
import { PaymentsModule } from './payments/payments.module.js';
import { HealthModule } from './health/health.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validationSchema: Joi.object({
        DATABASE_URL: Joi.string().required(),
        JWT_SECRET: Joi.string().min(32).required(),
        PORT: Joi.number().port().default(3000),
      }),
    }),
    PrismaModule,
    AuthModule,
    CategoriesModule,
    ProductsModule,
    InventoryModule,
    CashSessionsModule,
    PosSalesModule,
    CartsModule,
    AddressesModule,
    OrdersModule,
    PaymentsModule,
    HealthModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}