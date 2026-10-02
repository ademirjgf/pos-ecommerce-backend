import {
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service.js';
import { RestockDto } from './dto/restock.dto.js';

@Injectable()
export class InventoryAdminService {
  constructor(
    private readonly prisma: PrismaService,
  ) {}

  // Consultar el inventario completo.
  async findAll() {
    const products = await this.prisma.product.findMany({
      select: {
        id: true,
        sku: true,
        name: true,
        active: true,
        costPrice: true,
        salePrice: true,
        inventory: {
          select: {
            stock: true,
            reservedStock: true,
          },
        },
      },
      orderBy: { id: 'asc' },
    });

    return products.map(({ inventory, ...product }) => ({
      ...product,
      stock: inventory?.stock ?? 0,
      reservedStock: inventory?.reservedStock ?? 0,
      availableStock:
        (inventory?.stock ?? 0) -
        (inventory?.reservedStock ?? 0),
    }));
  }

  // Registrar la llegada de nuevas unidades.
  async restock(productId: number, dto: RestockDto) {
    return this.prisma.$transaction(async (tx) => {
      // El incremento se realiza directamente en PostgreSQL.
      const updated = await tx.inventory.updateMany({
        where: { productId },
        data: {
          stock: {
            increment: dto.quantity,
          },
        },
      });

      if (updated.count !== 1) {
        throw new NotFoundException(
          'Producto o inventario no encontrado',
        );
      }

      const product = await tx.product.findUniqueOrThrow({
        where: { id: productId },
        select: {
          id: true,
          sku: true,
          name: true,
          inventory: {
            select: {
              stock: true,
              reservedStock: true,
            },
          },
        },
      });

      return {
        productId: product.id,
        sku: product.sku,
        name: product.name,
        quantityAdded: dto.quantity,
        stock: product.inventory!.stock,
        reservedStock: product.inventory!.reservedStock,
        availableStock:
          product.inventory!.stock -
          product.inventory!.reservedStock,
      };
    });
  }
}