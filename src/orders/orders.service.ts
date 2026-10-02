import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { InventoryService } from '../inventory/inventory.service.js';
import { CheckoutOrderDto } from './dto/checkout-order.dto.js';

@Injectable()
export class OrdersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly inventoryService: InventoryService,
  ) {}

  // 1. Convertir el carrito en pedido y reservar inventario.
  async checkout(userId: number, dto: CheckoutOrderDto) {
    return this.prisma.$transaction(
      async (tx) => {
        // Bloqueamos al cliente para coordinar cambios
        // simultáneos en su carrito y checkout.
        const customers = await tx.$queryRaw<
          Array<{ id: number }>
        >`
          SELECT "id"
          FROM "customers"
          WHERE "user_id" = ${userId}
          FOR UPDATE
        `;

        if (customers.length === 0) {
          throw new ForbiddenException(
            'El usuario no tiene perfil de cliente',
          );
        }

        const customerId = customers[0].id;

        // Verificamos que la dirección pertenezca al cliente.
        const address = await tx.address.findFirst({
          where: {
            id: dto.addressId,
            customerId,
          },
        });

        if (!address) {
          throw new NotFoundException(
            'Dirección de entrega no encontrada',
          );
        }

        // Obtenemos el carrito activo y sus productos.
        const cart = await tx.cart.findFirst({
          where: {
            customerId,
            status: 'ACTIVE',
          },
          include: {
            items: {
              include: {
                product: true,
              },
            },
          },
        });

        if (!cart || cart.items.length === 0) {
          throw new ConflictException(
            'No tienes productos pendientes en el carrito',
          );
        }

        // Ordenamos los productos para mantener un orden
        // consistente de actualización de inventario.
        const items = [...cart.items].sort(
          (a, b) => a.productId - b.productId,
        );

        // Verificamos que los artículos sigan activos.
        for (const item of items) {
          if (!item.product.active) {
            throw new ConflictException(
              `El producto ${item.product.name} ya no está disponible`,
            );
          }
        }

        // Calculamos el total usando precios del servidor.
        const total = items.reduce(
          (sum, item) =>
            sum.plus(
              item.product.salePrice.mul(item.quantity),
            ),
          new Prisma.Decimal(0),
        );

        // Reservamos cada producto de forma atómica.
        // Si uno falla, se revierte toda la transacción.
        for (const item of items) {
          await this.inventoryService.reserve(
            tx,
            item.productId,
            item.quantity,
          );
        }

        // La reserva tendrá una duración inicial de 30 minutos.
        const reservationExpiresAt = new Date(
          Date.now() + 30 * 60 * 1000,
        );

        // Creamos el pedido y guardamos una copia de
        // los precios y la dirección de entrega.
        const order = await tx.order.create({
          data: {
            customerId,
            source: 'WEB',
            status: 'PENDING',
            total,
            currency: 'USD',

            recipientName: address.recipientName,
            recipientPhone: address.recipientPhone,
            shippingAddress: address.addressLine,
            district: address.district,
            city: address.city,
            reference: address.reference,

            reservationStatus: 'RESERVED',
            reservationExpiresAt,

            items: {
              create: items.map((item) => ({
                productId: item.productId,
                quantity: item.quantity,
                unitPrice: item.product.salePrice,
                unitCost: item.product.costPrice,
              })),
            },
          },
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
            reservationStatus: true,
            reservationExpiresAt: true,
            createdAt: true,
            items: {
              select: {
                productId: true,
                quantity: true,
                unitPrice: true,
              },
            },
          },
        });

        // El carrito ya no debe volver a procesarse.
        await tx.cart.update({
          where: { id: cart.id },
          data: {
            status: 'CHECKED_OUT',
          },
        });

        return order;
      },
      { timeout: 15000 },
    );
  }

  // 2. Consultar únicamente los pedidos propios.
  async findAll(userId: number) {
    return this.prisma.order.findMany({
      where: {
        customer: {
          userId,
        },
      },
      select: {
        id: true,
        source: true,
        status: true,
        total: true,
        currency: true,
        recipientName: true,
        shippingAddress: true,
        district: true,
        city: true,
        reservationStatus: true,
        reservationExpiresAt: true,
        createdAt: true,
        items: {
          select: {
            productId: true,
            quantity: true,
            unitPrice: true,
          },
        },
      },
      orderBy: {
        id: 'desc',
      },
    });
  }
}