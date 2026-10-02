import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { OpenCashSessionDto } from './dto/open-cash-session.dto.js';
import { CloseCashSessionDto } from './dto/close-cash-session.dto.js';

@Injectable()
export class CashSessionsService {
  constructor(
    private readonly prisma: PrismaService,
  ) {}

  // 1. Abrir caja
  async open(cashierId: number, dto: OpenCashSessionDto) {
    const existing = await this.prisma.cashSession.findFirst({
      where: {
        cashierId,
        status: 'OPEN',
      },
    });

    if (existing) {
      throw new ConflictException(
        'Ya tienes una sesión de caja abierta',
      );
    }

    return this.prisma.cashSession.create({
      data: {
        cashierId,
        openingAmount: dto.openingAmount,
        status: 'OPEN',
      },
    });
  }

  // 2. Consultar caja actual
  async findCurrent(cashierId: number) {
    const session = await this.prisma.cashSession.findFirst({
      where: {
        cashierId,
        status: 'OPEN',
      },
    });

    if (!session) {
      throw new NotFoundException(
        'No tienes ninguna sesión de caja abierta',
      );
    }

    return session;
  }

  // 3. Cerrar caja y realizar el arqueo
  async close(cashierId: number, dto: CloseCashSessionDto) {
    return this.prisma.$transaction(async (tx) => {
      // Impide que dos solicitudes cierren la misma caja.
      const locked = await tx.$queryRaw<Array<{ id: number }>>`
        SELECT "id"
        FROM "cash_sessions"
        WHERE "cashier_id" = ${cashierId}
          AND "status" = 'OPEN'
        FOR UPDATE
      `;

      if (locked.length === 0) {
        throw new NotFoundException(
          'No tienes ninguna sesión de caja abierta',
        );
      }

      const session = await tx.cashSession.findUniqueOrThrow({
        where: { id: locked[0].id },
      });

      // No cerramos una caja con ventas sin resolver.
      const pendingSales = await tx.posSale.count({
        where: {
          cashSessionId: session.id,
          status: 'OPEN',
        },
      });

      if (pendingSales > 0) {
        throw new ConflictException(
          `Debes cobrar o cancelar ${pendingSales} venta(s) pendiente(s)`,
        );
      }

      // Solamente sumamos las ventas pagadas en efectivo.
      const cashSales = await tx.posSale.aggregate({
        where: {
          cashSessionId: session.id,
          status: 'PAID',
          paymentMethod: 'CASH',
        },
        _sum: {
          total: true,
        },
      });

      const totalCashSales =
        cashSales._sum.total ?? new Prisma.Decimal(0);

      const expectedAmount =
        session.openingAmount.plus(totalCashSales);

      const countedAmount =
        new Prisma.Decimal(dto.countedAmount);

      const difference =
        countedAmount.minus(expectedAmount);

      const closed = await tx.cashSession.update({
        where: { id: session.id },
        data: {
          status: 'CLOSED',
          closedAt: new Date(),
          expectedAmount,
          countedAmount,
        },
      });

      return {
        ...closed,
        totalCashSales: totalCashSales.toFixed(2),
        difference: difference.toFixed(2),
      };
    });
  }
}