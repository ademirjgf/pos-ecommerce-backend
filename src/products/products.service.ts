
import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '../generated/prisma/client.js';

import { PrismaService } from '../prisma/prisma.service.js';
import { CreateProductDto } from './dto/create-product.dto.js';
import { UpdateProductDto } from './dto/update-product.dto.js';

@Injectable()
export class ProductsService {
  constructor(
    private readonly prisma: PrismaService,
  ) {}

  // Catálogo público: solamente productos disponibles.
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

  // Actualizar producto sin modificar su inventario.
  async update(id: number, dto: UpdateProductDto) {
    const producto = await this.prisma.product.findUnique({
      where: { id },
    });

    if (!producto) {
      throw new NotFoundException('Producto no encontrado');
    }

    if (dto.categoryId !== undefined) {
      const categoria = await this.prisma.category.findUnique({
        where: { id: dto.categoryId },
      });

      if (!categoria) {
        throw new NotFoundException('Categoría no encontrada');
      }
    }

    const datos: Prisma.ProductUpdateInput = {};

    if (dto.sku !== undefined) {
      datos.sku = dto.sku.trim().toUpperCase();
    }

    if (dto.name !== undefined) {
      datos.name = dto.name.trim();
    }

    if (dto.description !== undefined) {
      datos.description = dto.description.trim();
    }

    if (dto.costPrice !== undefined) {
      datos.costPrice = dto.costPrice;
    }

    if (dto.salePrice !== undefined) {
      datos.salePrice = dto.salePrice;
    }

    if (dto.categoryId !== undefined) {
      datos.category = {
        connect: { id: dto.categoryId },
      };
    }

    try {
      return await this.prisma.product.update({
        where: { id },
        data: datos,
        include: {
          category: true,
          inventory: true,
        },
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException(
          'El SKU ya está registrado',
        );
      }

      throw error;
    }
  }
}
