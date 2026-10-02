import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service.js';
import { InventoryService } from '../inventory/inventory.service.js';

@Injectable()
export class ReservationExpiryService
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(ReservationExpiryService.name);
  private timer?: ReturnType<typeof setInterval>;
  private running = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly inventoryService: InventoryService,
  ) {}

  // Revisar las reservas vencidas cada minuto.
  onModuleInit() {
    this.timer = setInterval(() => {
      void this.releaseExpiredReservations();
    }, 60_000);
  }

  onModuleDestroy() {
    if (this.timer) {
      clearInterval(this.timer);
    }
  }

  async releaseExpiredReservations() {
    // Evitar que se superpongan dos ejecuciones locales.
    if (this.running) return;

    this.running = true;

    try {
      // Solo pedidos vencidos que NO tengan intentos de pago.
      const candidates = await this.prisma.order.findMany({
        where: {
          status: 'PENDING',
          reservationStatus: 'RESERVED',
          reservationExpiresAt: {
            lte: new Date(),
          },
          payments: {
            none: {},
          },
        },
        select: {
          id: true,
        },
        orderBy: {
          reservationExpiresAt: 'asc',
        },
        take: 50,
      });

      for (const candidate of candidates) {
        try {
          const released = await this.prisma.$transaction(
            async (tx) => {
              // Coordina esta operación con el inicio del pago.
              const locked = await tx.$queryRaw<
                Array<{ id: number }>
              >`
                SELECT "id"
                FROM "orders"
                WHERE "id" = ${candidate.id}
                FOR UPDATE
              `;

              if (locked.length === 0) return false;

              // Comprobamos nuevamente las condiciones
              // después de obtener el bloqueo.
              const order = await tx.order.findUnique({
                where: { id: candidate.id },
                include: {
                  items: true,
                  payments: {
                    select: { id: true },
                    take: 1,
                  },
                },
              });

              if (
                !order ||
                order.status !== 'PENDING' ||
                order.reservationStatus !== 'RESERVED' ||
                !order.reservationExpiresAt ||
                order.reservationExpiresAt > new Date() ||
                order.payments.length > 0
              ) {
                return false;
              }

              // Liberamos el stock siguiendo un orden consistente.
              const sortedItems = [...order.items].sort(
                (a, b) => a.productId - b.productId,
              );

              for (const item of sortedItems) {
                await this.inventoryService.releaseReservation(
                  tx,
                  item.productId,
                  item.quantity,
                );
              }

              // Cambiamos también el estado del pedido.
              await tx.order.update({
                where: { id: order.id },
                data: {
                  status: 'CANCELLED',
                  reservationStatus: 'RELEASED',
                  reservationExpiresAt: null,
                },
              });

              return true;
            },
            { timeout: 15000 },
          );

          if (released) {
            this.logger.log(
              `Reserva vencida liberada: pedido ${candidate.id}`,
            );
          }
        } catch (error) {
          this.logger.error(
            `Error liberando el pedido ${candidate.id}`,
            error instanceof Error ? error.stack : String(error),
          );
        }
      }
    } catch (error) {
      this.logger.error(
        'Error consultando reservas vencidas',
        error instanceof Error ? error.stack : String(error),
      );
    } finally {
      this.running = false;
    }
  }
}