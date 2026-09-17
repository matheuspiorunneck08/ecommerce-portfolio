import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { createTestApp, cleanDatabase, getPrisma, createAdminUser, TEST_PASSWORD } from './utils';
import { PrismaService } from '../src/prisma/prisma.service';

describe('Products (e2e)', () => {
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

  it('lets an admin create a product', async () => {
    const res = await request(app.getHttpServer())
      .post('/products')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Mechanical Keyboard', description: 'Hot-swappable switches', priceCents: 45000, stock: 10 })
      .expect(201);

    expect(res.body.slug).toBe('mechanical-keyboard');
  });

  it('blocks a customer from creating a product', async () => {
    const res = await request(app.getHttpServer())
      .post('/products')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({ name: 'Mouse', description: 'Wireless mouse', priceCents: 15000, stock: 5 })
      .expect(403);

    expect(res.body.error.code).toBe('FORBIDDEN');
  });

  it('blocks an unauthenticated request from creating a product', async () => {
    await request(app.getHttpServer())
      .post('/products')
      .send({ name: 'Mouse', description: 'Wireless mouse', priceCents: 15000, stock: 5 })
      .expect(401);
  });

  it('lists only active products publicly', async () => {
    await request(app.getHttpServer())
      .post('/products')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Visible Product', description: 'Shown in catalog', priceCents: 1000, stock: 5 });

    await request(app.getHttpServer())
      .post('/products')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'Hidden Product',
        description: 'Not shown in catalog',
        priceCents: 1000,
        stock: 5,
        active: false,
      });

    const res = await request(app.getHttpServer()).get('/products').expect(200);
    const names = res.body.data.map((p: { name: string }) => p.name);

    expect(names).toContain('Visible Product');
    expect(names).not.toContain('Hidden Product');
  });

  it('rejects a duplicate product name with 409', async () => {
    const payload = { name: 'Same Name', description: 'First one in stock', priceCents: 1000, stock: 5 };
    await request(app.getHttpServer())
      .post('/products')
      .set('Authorization', `Bearer ${adminToken}`)
      .send(payload)
      .expect(201);

    await request(app.getHttpServer())
      .post('/products')
      .set('Authorization', `Bearer ${adminToken}`)
      .send(payload)
      .expect(409);
  });
});
