import {
  BadGatewayException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { ConfigService } from '@nestjs/config';
import { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { InventoryService } from '../inventory/inventory.service.js';

interface MockPayCreateResponse {
  id_transaccion?: string;
  checkout_url?: string;
}

interface MockPayDetailsResponse {
  id?: string;
  amount?: number | string;
  currency?: string;
  status?: string;
  merchantPublicKey?: string;
  metadata?: {
    order_id?: string | number;
  };
}

@Injectable()
export class PaymentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly inventoryService: InventoryService,
  ) {}

  // 1. Crear la intención de pago en MockPay
  async createCheckout(userId: number, orderId: number) {
    const preparation = await this.prisma.$transaction(
      async (tx) => {
        const locked = await tx.$queryRaw<Array<{ id: number }>>`
          SELECT "id"
          FROM "orders"
          WHERE "id" = ${orderId}
          FOR UPDATE
        `;

        if (locked.length === 0) {
          throw new NotFoundException('Pedido no encontrado');
        }

        const order = await tx.order.findUniqueOrThrow({
          where: { id: orderId },
          include: { customer: true },
        });

        if (order.customer.userId !== userId) {
          throw new NotFoundException('Pedido no encontrado');
        }

        if (
          order.status !== 'PENDING' ||
          order.reservationStatus !== 'RESERVED'
        ) {
          throw new ConflictException(
            'Este pedido no está pendiente de pago',
          );
        }

        if (
          !order.reservationExpiresAt ||
          order.reservationExpiresAt <= new Date()
        ) {
          throw new ConflictException(
            'La reserva del pedido ha vencido',
          );
        }

        const existing = await tx.payment.findFirst({
          where: { orderId },
          orderBy: { id: 'desc' },
        });

        if (existing) {
          if (
            existing.status === 'PENDING' &&
            existing.providerPaymentId &&
            existing.checkoutUrl
          ) {
            return {
              payment: existing,
              amount: order.total.toNumber(),
              alreadyCreated: true,
            };
          }

          throw new ConflictException(
            'El pedido ya tiene un intento de pago que requiere conciliación',
          );
        }

        const payment = await tx.payment.create({
          data: {
            orderId,
            provider: 'MOCKPAY',
            idempotencyKey: `mockpay-order-${orderId}`,
            amount: order.total,
            currency: 'USD',
            status: 'PENDING',
          },
        });

        return {
          payment,
          amount: order.total.toNumber(),
          alreadyCreated: false,
        };
      },
    );

    if (preparation.alreadyCreated) {
      return {
        orderId,
        paymentId: preparation.payment.id,
        checkoutUrl: preparation.payment.checkoutUrl,
        status: preparation.payment.status,
        reused: true,
      };
    }

    const baseUrl = this.config
      .getOrThrow<string>('MOCKPAY_BASE_URL')
      .replace(/\/$/, '');

    const secretKey = this.config.getOrThrow<string>(
      'MOCKPAY_SECRET_KEY',
    );

       let response: Response;

    try {
      response = await fetch(`${baseUrl}/api/v1/payments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${secretKey}`,
        },
        body: JSON.stringify({
          amount: preparation.amount,
          currency: 'USD',
          metadata: {
            order_id: String(orderId),
          },
        }),
        signal: AbortSignal.timeout(90000),
      });
    } catch (error: unknown) {
      const detail =
        error instanceof Error
          ? error.message
          : String(error);

      const cause =
        error instanceof Error && error.cause instanceof Error
          ? error.cause.message
          : 'Sin detalle adicional';

      console.error('[MockPay/createCheckout]', detail, cause);

      throw new BadGatewayException(
        'No se pudo contactar con MockPay. El intento local requiere conciliacion.',
      );
    }

    if (!response.ok) {
      throw new BadGatewayException(
        `MockPay respondió HTTP ${response.status}`,
      );
    }

    let gatewayData: MockPayCreateResponse;

    try {
      gatewayData =
        (await response.json()) as MockPayCreateResponse;
    } catch {
      throw new BadGatewayException(
        'MockPay devolvió un JSON inválido',
      );
    }

    if (
      typeof gatewayData.id_transaccion !== 'string' ||
      !gatewayData.id_transaccion ||
      typeof gatewayData.checkout_url !== 'string' ||
      !gatewayData.checkout_url
    ) {
      throw new BadGatewayException(
        'MockPay devolvió datos incompletos',
      );
    }

    // Corregimos la doble barra observada en el enlace.
    const checkoutUrl =
      gatewayData.checkout_url.replace(/(?<!:)\/{2,}/g, '/');

    const saved = await this.prisma.payment.update({
      where: { id: preparation.payment.id },
      data: {
        providerPaymentId: gatewayData.id_transaccion,
        checkoutUrl,
      },
    });

    return {
      orderId,
      paymentId: saved.id,
      providerPaymentId: saved.providerPaymentId,
      checkoutUrl: saved.checkoutUrl,
      amount: saved.amount.toFixed(2),
      currency: saved.currency,
      status: saved.status,
      reused: false,
    };
  }

  // 2. Consultar a MockPay y conciliar el resultado
  async reconcile(userId: number, orderId: number) {
    const payment = await this.prisma.payment.findFirst({
      where: {
        orderId,
        order: {
          customer: {
            userId,
          },
        },
      },
      orderBy: { id: 'desc' },
    });

    if (!payment) {
      throw new NotFoundException(
        'No se encontró un pago para este pedido',
      );
    }

    // Una conciliación ya completada no se repite.
    if (payment.status !== 'PENDING') {
      return {
        orderId,
        paymentId: payment.id,
        status: payment.status,
        alreadyReconciled: true,
      };
    }

    if (!payment.providerPaymentId) {
      throw new ConflictException(
        'El intento local todavía no tiene una referencia externa. Requiere revisión.',
      );
    }

    const baseUrl = this.config
      .getOrThrow<string>('MOCKPAY_BASE_URL')
      .replace(/\/$/, '');

    let response: Response;

    try {
      response = await fetch(
        `${baseUrl}/api/v1/payments/${encodeURIComponent(
          payment.providerPaymentId,
        )}`,
        {
          method: 'GET',
          signal: AbortSignal.timeout(60000),
        },
      );
    } catch {
      throw new BadGatewayException(
        'No se pudo consultar el resultado en MockPay',
      );
    }

    if (!response.ok) {
      throw new BadGatewayException(
        `Error consultando MockPay: HTTP ${response.status}`,
      );
    }

    let gateway: MockPayDetailsResponse;

    try {
      gateway =
        (await response.json()) as MockPayDetailsResponse;
    } catch {
      throw new BadGatewayException(
        'MockPay devolvió un JSON inválido',
      );
    }

    // Validamos que la respuesta realmente corresponda
    // a nuestro pago, comercio, pedido, moneda e importe.
    let amountMatches = false;

    try {
      if (
        typeof gateway.amount === 'number' ||
        typeof gateway.amount === 'string'
      ) {
        amountMatches = new Prisma.Decimal(
          gateway.amount,
        ).equals(payment.amount);
      }
    } catch {
      amountMatches = false;
    }

    const publicKey = this.config.getOrThrow<string>(
      'MOCKPAY_PUBLIC_KEY',
    );

    if (
      gateway.id !== payment.providerPaymentId ||
      gateway.merchantPublicKey !== publicKey ||
      String(gateway.metadata?.order_id) !== String(orderId) ||
      gateway.currency !== payment.currency ||
      !amountMatches
    ) {
      throw new ConflictException(
        'Los datos de MockPay no coinciden con nuestro pago',
      );
    }

    const gatewayStatus =
      typeof gateway.status === 'string'
        ? gateway.status.trim().toUpperCase()
        : '';

    // El cliente aún no ha terminado de pagar.
    if (gatewayStatus === 'PENDING') {
      return {
        orderId,
        paymentId: payment.id,
        status: 'PENDING',
        message: 'MockPay todavía no ha confirmado el pago',
      };
    }

    let finalStatus: 'SUCCEEDED' | 'FAILED' | 'CANCELLED';

    if (
      gatewayStatus === 'SUCCEEDED' ||
      gatewayStatus === 'SUCCESS'
    ) {
      finalStatus = 'SUCCEEDED';
    } else if (
      gatewayStatus === 'FAILED' ||
      gatewayStatus === 'FAILURE'
    ) {
      finalStatus = 'FAILED';
    } else if (
      gatewayStatus === 'CANCELLED' ||
      gatewayStatus === 'CANCELED'
    ) {
      finalStatus = 'CANCELLED';
    } else {
      throw new BadGatewayException(
        `Estado no reconocido de MockPay: ${gatewayStatus}`,
      );
    }

    // Confirmamos o liberamos la reserva de forma atómica.
    return this.prisma.$transaction(
      async (tx) => {
        const locked = await tx.$queryRaw<
          Array<{ id: number }>
        >`
          SELECT "id"
          FROM "orders"
          WHERE "id" = ${orderId}
          FOR UPDATE
        `;

        if (locked.length === 0) {
          throw new NotFoundException('Pedido no encontrado');
        }

        const currentPayment =
          await tx.payment.findUniqueOrThrow({
            where: { id: payment.id },
          });

        // Evita procesar dos veces la misma confirmación.
        if (currentPayment.status !== 'PENDING') {
          return {
            orderId,
            paymentId: currentPayment.id,
            status: currentPayment.status,
            alreadyReconciled: true,
          };
        }

        const order = await tx.order.findUniqueOrThrow({
          where: { id: orderId },
          include: { items: true },
        });

        if (
          order.status !== 'PENDING' ||
          order.reservationStatus !== 'RESERVED'
        ) {
          throw new ConflictException(
            'El pedido ya no tiene una reserva activa. El pago requiere revisión manual.',
          );
        }

        const sortedItems = [...order.items].sort(
          (a, b) => a.productId - b.productId,
        );

        if (finalStatus === 'SUCCEEDED') {
          // Pago exitoso: descontamos stock físico y reserva.
          for (const item of sortedItems) {
            await this.inventoryService.confirmReservation(
              tx,
              item.productId,
              item.quantity,
            );
          }

          await tx.payment.update({
            where: { id: payment.id },
            data: {
              status: 'SUCCEEDED',
              confirmedAt: new Date(),
            },
          });

          await tx.order.update({
            where: { id: orderId },
            data: {
              status: 'PAID',
              reservationStatus: 'CONSUMED',
              reservationExpiresAt: null,
            },
          });
        } else {
          // Pago rechazado o cancelado: liberamos el stock.
          for (const item of sortedItems) {
            await this.inventoryService.releaseReservation(
              tx,
              item.productId,
              item.quantity,
            );
          }

          await tx.payment.update({
            where: { id: payment.id },
            data: {
              status: finalStatus,
            },
          });

          await tx.order.update({
            where: { id: orderId },
            data: {
              status: 'CANCELLED',
              reservationStatus: 'RELEASED',
              reservationExpiresAt: null,
            },
          });
        }

        return {
          orderId,
          paymentId: payment.id,
          paymentStatus: finalStatus,
          orderStatus:
            finalStatus === 'SUCCEEDED' ? 'PAID' : 'CANCELLED',
          reservationStatus:
            finalStatus === 'SUCCEEDED'
              ? 'CONSUMED'
              : 'RELEASED',
          alreadyReconciled: false,
        };
      },
      { timeout: 15000 },
    );
  }
}