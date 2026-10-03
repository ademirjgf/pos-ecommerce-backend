import {
  BadRequestException,
  ConflictException,
  Injectable,
} from '@nestjs/common';

import { Prisma } from '../generated/prisma/client.js';
import { InventoryService } from '../inventory/inventory.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreateManualOrderDto } from './dto/create-manual-order.dto.js';

@Injectable()
export class ManualOrdersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly inventoryService: InventoryService,
  ) {}

  // Registrar una venta de Marketplace/manual cuyo pago fue verificado
  // FUERA de esta plataforma por el ADMIN. Nunca crear un pago MockPay ficticio.
  async createPaidExternalOrder(dto: CreateManualOrderDto) {
    if (dto.paymentConfirmed !== true) {
      throw new BadRequestException('Confirma primero el pago externo');
    }

    const productIds = dto.items.map((item) => item.productId);
    if (new Set(productIds).size !== productIds.length) {
      throw new BadRequestException('No repitas un producto en items');
    }

    const recipientName = `${dto.firstName.trim()} ${dto.lastName.trim()}`;
    if (
      !dto.firstName.trim() ||
      !dto.lastName.trim() ||
      !dto.shippingAddress.trim() ||
      !dto.district.trim() ||
      !dto.city.trim() ||
      recipientName.length > 150
    ) {
      throw new BadRequestException('Datos de entrega incompletos');
    }

    return this.prisma.$transaction(
      async (tx) => {
        const sorted = [...dto.items].sort(
          (a, b) => a.productId - b.productId,
        );

        const products = await tx.product.findMany({
          where: {
            id: { in: productIds },
            active: true,
          },
          select: {
            id: true,
            salePrice: true,
            costPrice: true,
          },
        });
        if (products.length !== sorted.length) {
          throw new ConflictException(
            'Uno o más productos no existen o están inactivos',
          );
        }

        const byId = new Map(products.map((product) => [product.id, product]));
        let total = new Prisma.Decimal(0);

        for (const item of sorted) {
          const product = byId.get(item.productId);
          if (!product) {
            throw new ConflictException('Producto no disponible');
          }
          total = total.plus(product.salePrice.mul(item.quantity));

          // Verifica disponibilidad y crea la reserva de forma atómica.
          await this.inventoryService.reserve(
            tx,
            item.productId,
            item.quantity,
          );
        }

        // El pago externo ya fue confirmado por ADMIN: consumir las reservas
        // dentro de la misma transacción. Un fallo revierte toda la operación.
        for (const item of sorted) {
          await this.inventoryService.confirmReservation(
            tx,
            item.productId,
            item.quantity,
          );
        }

        // Una venta por redes NO obliga al cliente a crear una cuenta web.
        const customer = await tx.customer.create({
          data: {
            firstName: dto.firstName.trim(),
            lastName: dto.lastName.trim(),
            phone: dto.phone.trim(),
          },
        });

        const order = await tx.order.create({
          data: {
            customerId: customer.id,
            source: dto.source,
            status: 'PAID',
            reservationStatus: 'CONSUMED',
            reservationExpiresAt: null,
            total,
            currency: 'USD',
            recipientName,
            recipientPhone: dto.phone.trim(),
            shippingAddress: dto.shippingAddress.trim(),
            district: dto.district.trim(),
            city: dto.city.trim(),
            reference: dto.reference?.trim() || null,
            items: {
              create: sorted.map((item) => {
                const product = byId.get(item.productId)!;
                return {
                  productId: item.productId,
                  quantity: item.quantity,
                  unitPrice: product.salePrice,
                  unitCost: product.costPrice,
                };
              }),
            },
          },
          include: {
            items: {
              select: {
                productId: true,
                quantity: true,
                unitPrice: true,
                unitCost: true,
              },
            },
          },
        });

        return {
          ...order,
          paymentNote: 'Pago externo verificado por el administrador; no MockPay',
          shippingCostIncluded: false,
        };
      },
      { timeout: 15000 },
    );
  }
}
