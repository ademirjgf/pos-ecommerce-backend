import {
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service.js';
import { CreateProductDto } from './dto/create-product.dto.js';

@Injectable()
export class ProductsService {
  constructor(
    private readonly prisma: PrismaService,
  ) {}

  // Catálogo público: productos con disponibilidad.
  async findAll() {
    const products = await this.prisma.product.findMany({
      where: {
        active: true,
      },
      select: {
        id: true,
        sku: true,
        name: true,
        description: true,
        salePrice: true,
        category: {
          select: {
            id: true,
            name: true,
          },
        },
        inventory: {
          select: {
            stock: true,
            reservedStock: true,
          },
        },
      },
      orderBy: {
        id: 'asc',
      },
    });

    return products
      .filter(
        (product) =>
          product.inventory !== null &&
          product.inventory.stock >
            product.inventory.reservedStock,
      )
      .map(({ inventory, ...product }) => ({
        ...product,
        availableStock:
          inventory!.stock - inventory!.reservedStock,
      }));
  }

  // Crear producto e inventario conjuntamente.
  async create(dto: CreateProductDto) {
    const category = await this.prisma.category.findUnique({
      where: {
        id: dto.categoryId,
      },
    });

    if (!category) {
      throw new NotFoundException(
        'La categoría indicada no existe',
      );
    }

    return this.prisma.product.create({
      data: {
        sku: dto.sku.trim().toUpperCase(),
        name: dto.name.trim(),
        description: dto.description?.trim(),
        costPrice: dto.costPrice,
        salePrice: dto.salePrice,

        category: {
          connect: {
            id: dto.categoryId,
          },
        },

        inventory: {
          create: {
            stock: dto.initialStock,
            reservedStock: 0,
          },
        },
      },
      include: {
        category: true,
        inventory: true,
      },
    });
  }
}