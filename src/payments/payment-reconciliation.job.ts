import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service.js';
import { PaymentsService } from './payments.service.js';

@Injectable()
export class PaymentReconciliationJob
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(
    PaymentReconciliationJob.name,
  );

  private timer?: ReturnType<typeof setInterval>;
  private running = false;
  private lastCheckedId = 0;

  constructor(
    private readonly prisma: PrismaService,
    private readonly paymentsService: PaymentsService,
  ) {}

  // Revisamos los pagos cada minuto.
  onModuleInit() {
    this.timer = setInterval(() => {
      void this.checkPendingPayments();
    }, 60_000);
  }

  onModuleDestroy() {
    if (this.timer) {
      clearInterval(this.timer);
    }
  }

  async checkPendingPayments() {
    if (this.running) return;

    this.running = true;

    try {
      // Procesamos lotes pequeños y avanzamos progresivamente
      // para no consultar siempre las mismas transacciones.
      const query = {
        status: 'PENDING' as const,
        provider: 'MOCKPAY' as const,
        providerPaymentId: {
          not: null,
        },
      };

      let payments = await this.prisma.payment.findMany({
        where: {
          ...query,
          id: { gt: this.lastCheckedId },
        },
        select: {
          id: true,
          orderId: true,
          order: {
            select: {
              customer: {
                select: {
                  userId: true,
                },
              },
            },
          },
        },
        orderBy: { id: 'asc' },
        take: 10,
      });

      // Al terminar el recorrido, volvemos al inicio.
      if (payments.length === 0) {
        this.lastCheckedId = 0;

        payments = await this.prisma.payment.findMany({
          where: query,
          select: {
            id: true,
            orderId: true,
            order: {
              select: {
                customer: {
                  select: {
                    userId: true,
                  },
                },
              },
            },
          },
          orderBy: { id: 'asc' },
          take: 10,
        });
      }

      for (const payment of payments) {
        this.lastCheckedId = payment.id;

        const userId = payment.order.customer.userId;

        if (userId == null) {
          this.logger.warn(
            `Pago ${payment.id} sin usuario vinculado`,
          );
          continue;
        }

        try {
          // Reutilizamos la conciliación que ya probamos.
          const result = await this.paymentsService.reconcile(
            userId,
            payment.orderId,
          );

          if (
            'paymentStatus' in result &&
            result.paymentStatus
          ) {
            this.logger.log(
              `Pedido ${payment.orderId}: ${result.paymentStatus}`,
            );
          }
        } catch (error) {
          this.logger.error(
            `Error conciliando pago ${payment.id}`,
            error instanceof Error ? error.message : String(error),
          );
        }
      }
    } catch (error) {
      this.logger.error(
        'Error revisando pagos pendientes',
        error instanceof Error ? error.message : String(error),
      );
    } finally {
      this.running = false;
    }
  }
}