import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { AddCartItemDto } from './dto/add-cart-item.dto.js';

@Injectable()
export class CartsService {
  constructor(
    private readonly prisma: PrismaService,
  ) {}

  // 1. Consultar el carrito del cliente autenticado
  async findCurrent(userId: number) {
    const customer = await this.prisma.customer.findUnique({
      where: { userId },
      select: { id: true },
    });

    if (!customer) {
      throw new ForbiddenException(
        'El usuario no tiene perfil de cliente',
      );
    }

    const cart = await this.prisma.cart.findFirst({
      where: {
        customerId: customer.id,
        status: 'ACTIVE',
      },
      include: {
        items: {
          include: {
            product: {
              include: {
                inventory: true,
              },
            },
          },
        },
      },
    });

    const items = cart?.items.map((item) => {
      const availableStock = Math.max(
        0,
        (item.product.inventory?.stock ?? 0) -
          (item.product.inventory?.reservedStock ?? 0),
      );

      return {
        productId: item.productId,
        sku: item.product.sku,
        name: item.product.name,
        quantity: item.quantity,
        unitPrice: item.product.salePrice.toFixed(2),
        subtotal: item.product.salePrice
          .mul(item.quantity)
          .toFixed(2),
        availableStock,
        active: item.product.active,
      };
    }) ?? [];

    const total = items.reduce(
      (sum, item) => sum.plus(item.subtotal),
      new Prisma.Decimal(0),
    );

    return {
      cartId: cart?.id ?? null,
      status: 'ACTIVE',
      currency: 'USD',
      items,
      total: total.toFixed(2),
    };
  }

  // 2. Agregar un producto al carrito
  async addItem(userId: number, dto: AddCartItemDto) {
    await this.prisma.$transaction(async (tx) => {
      // Bloqueamos el perfil del cliente para coordinar
      // modificaciones simultáneas de su carrito.
      const customers = await tx.$queryRaw<Array<{ id: number }>>`
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

      let cart = await tx.cart.findFirst({
        where: {
          customerId,
          status: 'ACTIVE',
        },
      });

      // Si es su primera compra, creamos el carrito.
      if (!cart) {
        cart = await tx.cart.create({
          data: {
            customerId,
            status: 'ACTIVE',
          },
        });
      }

      const product = await tx.product.findUnique({
        where: { id: dto.productId },
        include: { inventory: true },
      });

      if (!product || !product.active || !product.inventory) {
        throw new NotFoundException(
          'Producto no disponible',
        );
      }

      const existing = await tx.cartItem.findUnique({
        where: {
          cartId_productId: {
            cartId: cart.id,
            productId: dto.productId,
          },
        },
      });

      const newQuantity =
        (existing?.quantity ?? 0) + dto.quantity;

      const available =
        product.inventory.stock -
        product.inventory.reservedStock;

      if (newQuantity > available) {
        throw new ConflictException(
          'La cantidad solicitada supera el stock disponible',
        );
      }

      await tx.cartItem.upsert({
        where: {
          cartId_productId: {
            cartId: cart.id,
            productId: dto.productId,
          },
        },
        update: {
          quantity: {
            increment: dto.quantity,
          },
        },
        create: {
          cartId: cart.id,
          productId: dto.productId,
          quantity: dto.quantity,
        },
      });
    });

    return this.findCurrent(userId);
  }

  // 3. Eliminar un producto del carrito
  async removeItem(userId: number, productId: number) {
    await this.prisma.$transaction(async (tx) => {
      const customers = await tx.$queryRaw<Array<{ id: number }>>`
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

      const cart = await tx.cart.findFirst({
        where: {
          customerId: customers[0].id,
          status: 'ACTIVE',
        },
      });

      if (!cart) {
        throw new NotFoundException('Carrito no encontrado');
      }

      const deleted = await tx.cartItem.deleteMany({
        where: {
          cartId: cart.id,
          productId,
        },
      });

      if (deleted.count === 0) {
        throw new NotFoundException(
          'El producto no está en el carrito',
        );
      }
    });

    return this.findCurrent(userId);
  }
}