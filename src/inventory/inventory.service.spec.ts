
import {
  BadRequestException,
  ConflictException,
} from '@nestjs/common';

import {
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';

import type { Prisma } from '../generated/prisma/client.js';
import { InventoryService } from './inventory.service.js';

function createTransaction(updatedRows: number) {
  const executeRaw = vi.fn().mockResolvedValue(updatedRows);

  const tx = {
    $executeRaw: executeRaw,
  } as unknown as Prisma.TransactionClient;

  return { tx, executeRaw };
}

const operations = [
  {
    method: 'deductAvailable',
    errorMessage: 'Stock disponible insuficiente',
    sqlFragments: [
      '"stock" = "stock" -',
      '("stock" - "reserved_stock") >=',
    ],
  },
  {
    method: 'reserve',
    errorMessage: 'No hay suficientes unidades para reservar',
    sqlFragments: [
      '"reserved_stock" = "reserved_stock" +',
      '("stock" - "reserved_stock") >=',
    ],
  },
  {
    method: 'confirmReservation',
    errorMessage: 'No se puede confirmar la reserva',
    sqlFragments: [
      '"stock" = "stock" -',
      '"reserved_stock" = "reserved_stock" -',
    ],
  },
  {
    method: 'releaseReservation',
    errorMessage: 'No se puede liberar la reserva',
    sqlFragments: [
      '"reserved_stock" = "reserved_stock" -',
    ],
  },
] as const;

describe('InventoryService', () => {
  let service: InventoryService;

  beforeEach(() => {
    service = new InventoryService();
  });

  for (const operation of operations) {
    describe(operation.method, () => {
      it('ejecuta la operación SQL cuando la cantidad es válida', async () => {
        const { tx, executeRaw } = createTransaction(1);

        await expect(
          service[operation.method](tx, 42, 3),
        ).resolves.toBeUndefined();

        expect(executeRaw).toHaveBeenCalledTimes(1);

        // Prisma recibe las consultas como tagged templates.
        const call = executeRaw.mock.calls[0] as unknown[];
        const template = call[0] as TemplateStringsArray;
        const sql = template.join('?');

        expect(sql).toContain('UPDATE "inventory"');

        for (const fragment of operation.sqlFragments) {
          expect(sql).toContain(fragment);
        }

        // Comprueba que se utilizaron el producto y la cantidad indicados.
        expect(call.slice(1)).toContain(42);
        expect(call.slice(1)).toContain(3);
      });

      it('rechaza la operación si no se actualizó ninguna fila', async () => {
        const { tx, executeRaw } = createTransaction(0);

        const error = await service[operation.method](
          tx,
          42,
          3,
        ).catch((caught: unknown) => caught);

        expect(error).toBeInstanceOf(ConflictException);
        expect((error as Error).message).toBe(
          operation.errorMessage,
        );

        expect(executeRaw).toHaveBeenCalledTimes(1);
      });

      it('rechaza un resultado inesperado de múltiples filas', async () => {
        const { tx } = createTransaction(2);

        await expect(
          service[operation.method](tx, 42, 3),
        ).rejects.toThrow(ConflictException);
      });

      it.each([0, -1, 1.5, NaN, Infinity])(
        'rechaza la cantidad inválida %s antes de consultar la DB',
        async (quantity) => {
          const { tx, executeRaw } = createTransaction(1);

          await expect(
            service[operation.method](tx, 42, quantity),
          ).rejects.toThrow(BadRequestException);

          // Una cantidad inválida nunca debe llegar a PostgreSQL.
          expect(executeRaw).not.toHaveBeenCalled();
        },
      );
    });
  }
});
