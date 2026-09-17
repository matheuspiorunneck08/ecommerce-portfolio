import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { createTestApp, cleanDatabase, getPrisma } from './utils';
import { PrismaService } from '../src/prisma/prisma.service';

describe('Auth (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    app = await createTestApp();
    prisma = getPrisma(app);
  });

  beforeEach(async () => {
    await cleanDatabase(prisma);
  });

  afterAll(async () => {
    await app.close();
  });

  it('registers a user and returns tokens without leaking the password hash', async () => {
    const res = await request(app.getHttpServer())
      .post('/auth/register')
      .send({ name: 'Jane Doe', email: 'jane@example.com', password: 'Password123' })
      .expect(201);

    expect(res.body.accessToken).toBeDefined();
    expect(res.body.refreshToken).toBeDefined();
    expect(res.body.user.email).toBe('jane@example.com');
    expect(res.body.user.passwordHash).toBeUndefined();
  });

  it('rejects a duplicate email with 409', async () => {
    const payload = { name: 'Jane', email: 'dupe@example.com', password: 'Password123' };
    await request(app.getHttpServer()).post('/auth/register').send(payload).expect(201);

    const res = await request(app.getHttpServer()).post('/auth/register').send(payload).expect(409);
    expect(res.body.error.code).toBe('CONFLICT');
  });

  it('rejects an invalid payload with 400', async () => {
    await request(app.getHttpServer())
      .post('/auth/register')
      .send({ name: 'J', email: 'not-an-email', password: '123' })
      .expect(400);
  });

  it('logs in with correct credentials', async () => {
    await request(app.getHttpServer())
      .post('/auth/register')
      .send({ name: 'Jane', email: 'login@example.com', password: 'Password123' });

    const res = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'login@example.com', password: 'Password123' })
      .expect(200);

    expect(res.body.accessToken).toBeDefined();
  });

  it('rejects wrong password without revealing whether the email exists', async () => {
    await request(app.getHttpServer())
      .post('/auth/register')
      .send({ name: 'Jane', email: 'wrongpass@example.com', password: 'Password123' });

    const wrongPassword = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'wrongpass@example.com', password: 'WrongPassword1' })
      .expect(401);

    const unknownEmail = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'nobody@example.com', password: 'WrongPassword1' })
      .expect(401);

    expect(wrongPassword.body.error.message).toBe(unknownEmail.body.error.message);
  });

  it('rejects protected routes without a token', async () => {
    await request(app.getHttpServer()).get('/cart').expect(401);
  });
});
