import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { InventoryService } from '../inventory/inventory.service.js';
import { AddPosSaleItemDto } from './dto/add-pos-sale-item.dto.js';
import { CheckoutPosSaleDto } from './dto/checkout-pos-sale.dto.js';

@Injectable()
export class PosSalesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly inventoryService: InventoryService,
  ) {}

  // 1. Abrir una venta
  async open(cashierId: number) {
    const cashSession = await this.prisma.cashSession.findFirst({
      where: {
        cashierId,
        status: 'OPEN',
      },
    });

    if (!cashSession) {
      throw new ConflictException(
        'Debes abrir una sesión de caja antes de vender',
      );
    }

    return this.prisma.posSale.create({
      data: {
        cashierId,
        cashSessionId: cashSession.id,
        status: 'OPEN',
        total: 0,
      },
      include: { items: true },
    });
  }

  // 2. Consultar una venta
  async findOne(id: number, cashierId: number) {
    const sale = await this.prisma.posSale.findFirst({
      where: {
        id,
        cashierId,
      },
      include: {
        cashSession: true,
        items: {
          include: { product: true },
        },
      },
    });

    if (!sale) {
      throw new NotFoundException('Venta no encontrada');
    }

    return sale;
  }

  // 3. Agregar productos a una venta
  async addItem(
    saleId: number,
    cashierId: number,
    dto: AddPosSaleItemDto,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const locked = await tx.$queryRaw<Array<{ id: number }>>`
        SELECT "id"
        FROM "pos_sales"
        WHERE "id" = ${saleId}
          AND "cashier_id" = ${cashierId}
        FOR UPDATE
      `;

      if (locked.length === 0) {
        throw new NotFoundException('Venta no encontrada');
      }

      const sale = await tx.posSale.findUniqueOrThrow({
        where: { id: saleId },
        include: { cashSession: true },
      });

      if (sale.status !== 'OPEN') {
        throw new ConflictException(
          'No puedes modificar una venta finalizada',
        );
      }

      if (sale.cashSession.status !== 'OPEN') {
        throw new ConflictException('La caja está cerrada');
      }

      const product = await tx.product.findUnique({
        where: { id: dto.productId },
        include: { inventory: true },
      });

      if (!product || !product.active || !product.inventory) {
        throw new NotFoundException('Producto no disponible');
      }

      const existing = await tx.posSaleItem.findUnique({
        where: {
          saleId_productId: {
            saleId,
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
        throw new ConflictException('Stock insuficiente');
      }

      return tx.posSaleItem.upsert({
        where: {
          saleId_productId: {
            saleId,
            productId: dto.productId,
          },
        },
        update: {
          quantity: { increment: dto.quantity },
          unitPrice: product.salePrice,
          unitCost: product.costPrice,
        },
        create: {
          saleId,
          productId: dto.productId,
          quantity: dto.quantity,
          unitPrice: product.salePrice,
          unitCost: product.costPrice,
        },
      });
    });
  }

  // 4. Confirmar cobro y descontar inventario
  async checkout(
    saleId: number,
    cashierId: number,
    dto: CheckoutPosSaleDto,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const locked = await tx.$queryRaw<Array<{ id: number }>>`
        SELECT "id"
        FROM "pos_sales"
        WHERE "id" = ${saleId}
          AND "cashier_id" = ${cashierId}
        FOR UPDATE
      `;

      if (locked.length === 0) {
        throw new NotFoundException('Venta no encontrada');
      }

      const sale = await tx.posSale.findUniqueOrThrow({
        where: { id: saleId },
        include: {
          items: true,
          cashSession: true,
        },
      });

      if (sale.status !== 'OPEN') {
        throw new ConflictException(
          'Esta venta ya fue procesada o cancelada',
        );
      }

      if (sale.cashSession.status !== 'OPEN') {
        throw new ConflictException(
          'La sesión de caja está cerrada',
        );
      }

      if (sale.items.length === 0) {
        throw new BadRequestException(
          'No puedes cobrar una venta sin productos',
        );
      }

      const total = sale.items.reduce(
        (sum, item) =>
          sum.plus(item.unitPrice.mul(item.quantity)),
        new Prisma.Decimal(0),
      );

      const sortedItems = [...sale.items].sort(
        (a, b) => a.productId - b.productId,
      );

      for (const item of sortedItems) {
        await this.inventoryService.deductAvailable(
          tx,
          item.productId,
          item.quantity,
        );
      }

      return tx.posSale.update({
        where: { id: saleId },
        data: {
          status: 'PAID',
          paymentMethod: dto.paymentMethod,
          total,
          paidAt: new Date(),
        },
        include: { items: true },
      });
    });
  }

  // 5. Consultar ventas pendientes del cajero
  async findOpen(cashierId: number) {
    return this.prisma.posSale.findMany({
      where: {
        cashierId,
        status: 'OPEN',
        cashSession: {
          status: 'OPEN',
        },
      },
      include: {
        items: true,
      },
      orderBy: {
        id: 'asc',
      },
    });
  }

  // 6. Cancelar una venta sin cobrar
  async cancel(saleId: number, cashierId: number) {
    return this.prisma.$transaction(async (tx) => {
      const locked = await tx.$queryRaw<Array<{ id: number }>>`
        SELECT "id"
        FROM "pos_sales"
        WHERE "id" = ${saleId}
          AND "cashier_id" = ${cashierId}
        FOR UPDATE
      `;

      if (locked.length === 0) {
        throw new NotFoundException('Venta no encontrada');
      }

      const sale = await tx.posSale.findUniqueOrThrow({
        where: { id: saleId },
      });

      if (sale.status !== 'OPEN') {
        throw new ConflictException(
          'Solamente puedes cancelar ventas abiertas',
        );
      }

      return tx.posSale.update({
        where: { id: saleId },
        data: {
          status: 'CANCELLED',
        },
      });
    });
  }
}