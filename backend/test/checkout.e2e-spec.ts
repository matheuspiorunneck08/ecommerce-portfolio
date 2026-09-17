import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { createTestApp, cleanDatabase, getPrisma, createAdminUser, TEST_PASSWORD } from './utils';
import { PrismaService } from '../src/prisma/prisma.service';

describe('Checkout flow (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let adminToken: string;
  let customerToken: string;

  beforeAll(async () => {
    app = await createTestApp();
    prisma = getPrisma(app);
  });

  beforeEach(async () => {
    await cleanDatabase(prisma);

    await createAdminUser(prisma, 'admin@example.com');
    const adminLogin = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'admin@example.com', password: TEST_PASSWORD });
    adminToken = adminLogin.body.accessToken;

    await request(app.getHttpServer())
      .post('/auth/register')
      .send({ name: 'Customer', email: 'customer@example.com', password: TEST_PASSWORD });
    const customerLogin = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'customer@example.com', password: TEST_PASSWORD });
    customerToken = customerLogin.body.accessToken;
  });

  afterAll(async () => {
    await app.close();
  });

  const authed = (token: string) => (method: 'get' | 'post' | 'patch' | 'delete', url: string) =>
    request(app.getHttpServer())[method](url).set('Authorization', `Bearer ${token}`);

  it('takes an order from cart to checkout and decrements stock', async () => {
    const customer = authed(customerToken);

    const product = await authed(adminToken)('post', '/products').send({
      name: 'Limited Item',
      description: 'Only two in stock',
      priceCents: 5000,
      stock: 2,
    });

    await customer('post', '/cart/items').send({ productId: product.body.id, quantity: 2 }).expect(201);

    const address = await customer('post', '/addresses').send({
      street: 'Rua das Flores',
      number: '123',
      city: 'São Paulo',
      state: 'SP',
      zipCode: '01000-000',
    });

    const order = await customer('post', '/orders').send({ addressId: address.body.id }).expect(201);
    expect(order.body.totalCents).toBe(10000);
    expect(order.body.status).toBe('PENDING');

    const updatedProduct = await prisma.product.findUnique({ where: { id: product.body.id } });
    expect(updatedProduct?.stock).toBe(0);

    const cart = await customer('get', '/cart').expect(200);
    expect(cart.body.items).toHaveLength(0);
  });

  it('rejects checkout when the cart is empty', async () => {
    const customer = authed(customerToken);

    const address = await customer('post', '/addresses').send({
      street: 'Rua das Flores',
      number: '123',
      city: 'São Paulo',
      state: 'SP',
      zipCode: '01000-000',
    });

    const res = await customer('post', '/orders').send({ addressId: address.body.id }).expect(409);
    expect(res.body.error.code).toBe('CONFLICT');
  });

  it('rejects adding more items to the cart than available stock', async () => {
    const customer = authed(customerToken);

    const product = await authed(adminToken)('post', '/products').send({
      name: 'Single Unit',
      description: 'Only one in stock',
      priceCents: 3000,
      stock: 1,
    });

    const res = await customer('post', '/cart/items')
      .send({ productId: product.body.id, quantity: 2 })
      .expect(409);

    expect(res.body.error.code).toBe('INSUFFICIENT_STOCK');
  });

  it('restores stock when an admin cancels a pending order', async () => {
    const customer = authed(customerToken);
    const admin = authed(adminToken);

    const product = await admin('post', '/products').send({
      name: 'Cancelable Item',
      description: 'Gets cancelled',
      priceCents: 2000,
      stock: 3,
    });

    await customer('post', '/cart/items').send({ productId: product.body.id, quantity: 3 });

    const address = await customer('post', '/addresses').send({
      street: 'Rua das Flores',
      number: '123',
      city: 'São Paulo',
      state: 'SP',
      zipCode: '01000-000',
    });

    const order = await customer('post', '/orders').send({ addressId: address.body.id });
    expect((await prisma.product.findUnique({ where: { id: product.body.id } }))?.stock).toBe(0);

    await admin('patch', `/orders/${order.body.id}/status`).send({ status: 'CANCELLED' }).expect(200);

    expect((await prisma.product.findUnique({ where: { id: product.body.id } }))?.stock).toBe(3);
  });

  it('blocks a customer from viewing another customer order', async () => {
    const customer = authed(customerToken);

    await request(app.getHttpServer())
      .post('/auth/register')
      .send({ name: 'Other', email: 'other@example.com', password: TEST_PASSWORD });
    const otherLogin = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'other@example.com', password: TEST_PASSWORD });
    const other = authed(otherLogin.body.accessToken);

    const product = await authed(adminToken)('post', '/products').send({
      name: 'Owned Item',
      description: 'Belongs to customer',
      priceCents: 1000,
      stock: 5,
    });

    await customer('post', '/cart/items').send({ productId: product.body.id, quantity: 1 });
    const address = await customer('post', '/addresses').send({
      street: 'Rua das Flores',
      number: '123',
      city: 'São Paulo',
      state: 'SP',
      zipCode: '01000-000',
    });
    const order = await customer('post', '/orders').send({ addressId: address.body.id });

    const res = await other('get', `/orders/${order.body.id}`).expect(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });
});
