import {
  BadRequestException,
  ConflictException,
  Injectable,
} from '@nestjs/common';

import type { Prisma } from '../generated/prisma/client.js';

@Injectable()
export class InventoryService {

  private validateQuantity(quantity: number) {
    if (!Number.isInteger(quantity) || quantity <= 0) {
      throw new BadRequestException(
        'La cantidad debe ser un entero positivo',
      );
    }
  }

  // POS: descontar stock disponible al confirmar una venta.
  async deductAvailable(
    tx: Prisma.TransactionClient,
    productId: number,
    quantity: number,
  ) {
    this.validateQuantity(quantity);

    const updated = await tx.$executeRaw`
      UPDATE "inventory"
      SET
        "stock" = "stock" - ${quantity},
        "updated_at" = NOW()
      WHERE "product_id" = ${productId}
        AND ("stock" - "reserved_stock") >= ${quantity}
    `;

    if (updated !== 1) {
      throw new ConflictException(
        'Stock disponible insuficiente',
      );
    }
  }

  // E-commerce: reservar unidades durante el checkout.
  async reserve(
    tx: Prisma.TransactionClient,
    productId: number,
    quantity: number,
  ) {
    this.validateQuantity(quantity);

    const updated = await tx.$executeRaw`
      UPDATE "inventory"
      SET
        "reserved_stock" = "reserved_stock" + ${quantity},
        "updated_at" = NOW()
      WHERE "product_id" = ${productId}
        AND ("stock" - "reserved_stock") >= ${quantity}
    `;

    if (updated !== 1) {
      throw new ConflictException(
        'No hay suficientes unidades para reservar',
      );
    }
  }

  // Pago confirmado: convertir la reserva en venta definitiva.
  async confirmReservation(
    tx: Prisma.TransactionClient,
    productId: number,
    quantity: number,
  ) {
    this.validateQuantity(quantity);

    const updated = await tx.$executeRaw`
      UPDATE "inventory"
      SET
        "stock" = "stock" - ${quantity},
        "reserved_stock" = "reserved_stock" - ${quantity},
        "updated_at" = NOW()
      WHERE "product_id" = ${productId}
        AND "reserved_stock" >= ${quantity}
    `;

    if (updated !== 1) {
      throw new ConflictException(
        'No se puede confirmar la reserva',
      );
    }
  }

  // Pago rechazado o reserva vencida: liberar las unidades.
  async releaseReservation(
    tx: Prisma.TransactionClient,
    productId: number,
    quantity: number,
  ) {
    this.validateQuantity(quantity);

    const updated = await tx.$executeRaw`
      UPDATE "inventory"
      SET
        "reserved_stock" = "reserved_stock" - ${quantity},
        "updated_at" = NOW()
      WHERE "product_id" = ${productId}
        AND "reserved_stock" >= ${quantity}
    `;

    if (updated !== 1) {
      throw new ConflictException(
        'No se puede liberar la reserva',
      );
    }
  }
}