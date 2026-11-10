import type { FastifyInstance } from 'fastify';
import { PERMISSIONS, NotFoundError, ValidationError } from '@cbt/shared';
import { requireAuth, requirePermission, sendError } from '../../../shared/auth-guards.js';
import { env } from '../../../config/env.js';
import { z } from 'zod';

export async function billingRoutes(app: FastifyInstance) {
  app.get(
    `${env.apiPrefix}/products`,
    { preHandler: [requirePermission(PERMISSIONS.BILLING_READ)] },
    async (_request, reply) => {
      const data = await app.prisma.product.findMany({
        where: { deletedAt: null, isActive: true },
        orderBy: { name: 'asc' },
      });
      return reply.send({ data });
    },
  );

  app.post(
    `${env.apiPrefix}/products`,
    { preHandler: [requirePermission(PERMISSIONS.BILLING_WRITE)] },
    async (request, reply) => {
      try {
        const body = z
          .object({
            sku: z.string().min(1),
            name: z.string().min(1),
            description: z.string().optional(),
            priceCents: z.number().int().positive(),
            currency: z.string().default('USD'),
          })
          .parse(request.body);
        const product = await app.prisma.product.create({ data: body });
        return reply.status(201).send(product);
      } catch (e) {
        return sendError(reply, e);
      }
    },
  );

  app.get(
    `${env.apiPrefix}/invoices`,
    { preHandler: [requirePermission(PERMISSIONS.BILLING_READ)] },
    async (request, reply) => {
      try {
        const user = requireAuth(request);
        const isFinance = user.permissions.includes(PERMISSIONS.BILLING_WRITE);
        const data = await app.prisma.invoice.findMany({
          where: isFinance ? {} : { userId: user.id },
          include: { lines: true, payments: true },
          orderBy: { createdAt: 'desc' },
          take: 100,
        });
        return reply.send({ data });
      } catch (e) {
        return sendError(reply, e);
      }
    },
  );

  app.post(
    `${env.apiPrefix}/invoices`,
    { preHandler: [requirePermission(PERMISSIONS.BILLING_WRITE)] },
    async (request, reply) => {
      try {
        const body = z
          .object({
            userId: z.string().uuid(),
            lines: z
              .array(
                z.object({
                  productId: z.string().uuid().optional(),
                  description: z.string(),
                  quantity: z.number().int().positive().default(1),
                  unitCents: z.number().int().nonnegative(),
                }),
              )
              .min(1),
            couponCode: z.string().optional(),
          })
          .parse(request.body);

        let discountCents = 0;
        let couponId: string | undefined;
        if (body.couponCode) {
          const coupon = await app.prisma.coupon.findUnique({ where: { code: body.couponCode } });
          if (coupon?.isActive) {
            couponId = coupon.id;
            const subtotal = body.lines.reduce((s, l) => s + l.unitCents * l.quantity, 0);
            if (coupon.percentOff) {
              discountCents = Math.round(subtotal * (Number(coupon.percentOff) / 100));
            } else if (coupon.amountOffCents) {
              discountCents = coupon.amountOffCents;
            }
          }
        }

        const subtotalCents = body.lines.reduce((s, l) => s + l.unitCents * l.quantity, 0);
        const totalCents = Math.max(0, subtotalCents - discountCents);
        const number = `INV-${Date.now()}`;

        const invoice = await app.prisma.invoice.create({
          data: {
            userId: body.userId,
            couponId,
            number,
            status: 'ISSUED',
            subtotalCents,
            discountCents,
            taxCents: 0,
            totalCents,
            issuedAt: new Date(),
            lines: {
              create: body.lines.map((l) => ({
                productId: l.productId,
                description: l.description,
                quantity: l.quantity,
                unitCents: l.unitCents,
                totalCents: l.unitCents * l.quantity,
              })),
            },
          },
          include: { lines: true },
        });
        return reply.status(201).send(invoice);
      } catch (e) {
        return sendError(reply, e);
      }
    },
  );

  app.post(`${env.apiPrefix}/payments`, async (request, reply) => {
    try {
      const user = requireAuth(request);
      const body = z
        .object({
          invoiceId: z.string().uuid(),
          provider: z.string().default('stripe'),
          providerPaymentId: z.string().optional(),
        })
        .parse(request.body);
      const invoice = await app.prisma.invoice.findUnique({ where: { id: body.invoiceId } });
      if (!invoice) throw new NotFoundError('Invoice');
      if (invoice.userId !== user.id && !user.permissions.includes(PERMISSIONS.BILLING_WRITE)) {
        throw new NotFoundError('Invoice');
      }

      const isSimulated = !body.providerPaymentId || body.providerPaymentId.startsWith('sim_');
      if (isSimulated && !env.allowSimulatedPayments) {
        throw new ValidationError(
          'Simulated payments are disabled. Provide a real providerPaymentId or configure Stripe.',
        );
      }
      if (!isSimulated && env.stripe.secretKey) {
        // Placeholder for Stripe PaymentIntent verification — require matching amount in production
        // when STRIPE_SECRET_KEY is set. Full Stripe SDK integration can replace this block.
      }

      const payment = await app.prisma.payment.create({
        data: {
          userId: invoice.userId,
          invoiceId: invoice.id,
          provider: body.provider,
          providerPaymentId: body.providerPaymentId ?? `sim_${Date.now()}`,
          amountCents: invoice.totalCents,
          currency: invoice.currency,
          status: 'SUCCEEDED',
          paidAt: new Date(),
        },
      });
      await app.prisma.invoice.update({
        where: { id: invoice.id },
        data: { status: 'PAID', paidAt: new Date() },
      });
      return reply.status(201).send(payment);
    } catch (e) {
      return sendError(reply, e);
    }
  });

  app.get(
    `${env.apiPrefix}/coupons`,
    { preHandler: [requirePermission(PERMISSIONS.BILLING_READ)] },
    async (_request, reply) => {
      const data = await app.prisma.coupon.findMany({ orderBy: { createdAt: 'desc' } });
      return reply.send({ data });
    },
  );

  app.post(
    `${env.apiPrefix}/coupons`,
    { preHandler: [requirePermission(PERMISSIONS.BILLING_WRITE)] },
    async (request, reply) => {
      try {
        const body = z
          .object({
            code: z.string().min(1),
            description: z.string().optional(),
            percentOff: z.number().min(0).max(100).optional(),
            amountOffCents: z.number().int().positive().optional(),
            currency: z.string().optional(),
            maxRedemptions: z.number().int().positive().optional(),
          })
          .parse(request.body);
        const coupon = await app.prisma.coupon.create({ data: body });
        return reply.status(201).send(coupon);
      } catch (e) {
        return sendError(reply, e);
      }
    },
  );
}
