import {
  ForbiddenException,
  Injectable,
} from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service.js';
import { CreateAddressDto } from './dto/create-address.dto.js';

@Injectable()
export class AddressesService {
  constructor(
    private readonly prisma: PrismaService,
  ) {}

  // 1. Consultar las direcciones del cliente autenticado.
  async findAll(userId: number) {
    const customer = await this.prisma.customer.findUnique({
      where: { userId },
      select: { id: true },
    });

    if (!customer) {
      throw new ForbiddenException(
        'El usuario no tiene perfil de cliente',
      );
    }

    return this.prisma.address.findMany({
      where: {
        customerId: customer.id,
      },
      orderBy: [
        { isDefault: 'desc' },
        { id: 'asc' },
      ],
    });
  }

  // 2. Registrar una nueva dirección.
  async create(userId: number, dto: CreateAddressDto) {
    return this.prisma.$transaction(async (tx) => {
      // Bloqueamos el perfil para coordinar posibles
      // solicitudes simultáneas del mismo cliente.
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

      const addressCount = await tx.address.count({
        where: { customerId },
      });

      // La primera dirección será predeterminada.
      const makeDefault =
        addressCount === 0 || dto.isDefault === true;

      // Si se establece una nueva dirección principal,
      // desmarcamos las anteriores.
      if (makeDefault) {
        await tx.address.updateMany({
          where: {
            customerId,
            isDefault: true,
          },
          data: {
            isDefault: false,
          },
        });
      }

      return tx.address.create({
        data: {
          customerId,
          recipientName: dto.recipientName.trim(),
          recipientPhone: dto.recipientPhone.trim(),
          addressLine: dto.addressLine.trim(),
          district: dto.district.trim(),
          city: dto.city.trim(),
          reference: dto.reference?.trim() || null,
          isDefault: makeDefault,
        },
      });
    });
  }
}