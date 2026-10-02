import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service.js';

@Injectable()
export class AdminOrdersService {
  constructor(
    private readonly prisma: PrismaService,
  ) {}

  // Consultar los últimos 30 pedidos.
  async findAll() {
    return this.prisma.order.findMany({
      select: {
        id: true,
        source: true,
        status: true,
        total: true,
        currency: true,
        recipientName: true,
        recipientPhone: true,
        shippingAddress: true,
        district: true,
        city: true,
        reference: true,
        createdAt: true,
        items: {
          select: {
            quantity: true,
            unitPrice: true,
            product: {
              select: {
                sku: true,
                name: true,
              },
            },
          },
        },
      },
      orderBy: {
        id: 'desc',
      },
      take: 30,
    });
  }

  // Marcar un pedido pagado como enviado.
  async markInTransit(id: number) {
    const result = await this.prisma.order.updateMany({
      where: {
        id,
        status: 'PAID',
        reservationStatus: 'CONSUMED',
      },
      data: {
        status: 'IN_TRANSIT',
      },
    });

    if (result.count !== 1) {
      await this.checkOrderExists(id);

      throw new ConflictException(
        'Solo puedes enviar pedidos pagados',
      );
    }

    return this.prisma.order.findUnique({
      where: { id },
    });
  }

  // Registrar la entrega final.
  async markDelivered(id: number) {
    const result = await this.prisma.order.updateMany({
      where: {
        id,
        status: 'IN_TRANSIT',
        reservationStatus: 'CONSUMED',
      },
      data: {
        status: 'DELIVERED',
      },
    });

    if (result.count !== 1) {
      await this.checkOrderExists(id);

      throw new ConflictException(
        'El pedido debe estar en tránsito antes de entregarse',
      );
    }

    return this.prisma.order.findUnique({
      where: { id },
    });
  }

  private async checkOrderExists(id: number) {
    const order = await this.prisma.order.findUnique({
      where: { id },
      select: { id: true },
    });

    if (!order) {
      throw new NotFoundException('Pedido no encontrado');
    }
  }
}