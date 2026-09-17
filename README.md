# Ecommerce Portfolio

[![CI](https://github.com/matheuspiorunneck08/ecommerce-portfolio/actions/workflows/ci.yml/badge.svg)](https://github.com/matheuspiorunneck08/ecommerce-portfolio/actions/workflows/ci.yml)

API REST de e-commerce pra portfólio: NestJS + Prisma + PostgreSQL. Foco em backend — auth, transações, tratamento de erro, integração de pagamento.

## Stack

- **NestJS** + **Prisma ORM** + **PostgreSQL**
- **Auth**: JWT (access + refresh), bcrypt, guards por role
- **Pagamento**: Stripe (test mode) — checkout session + webhook
- **Infra**: Docker Compose
- **Docs**: Swagger em `/docs`

## Módulos

`auth` `users` `products` `categories` `addresses` `cart` `orders` `payments`

## Schema (resumo)

users → addresses, cart, orders
products ↔ categories (N:N via product_categories)
cart → cart_items → products
orders → order_items (snapshot preço/nome) → payment

## Decisões técnicas

- Erros centralizados num único filter (`AppError` + mapeamento de erros do Prisma) — nenhum service faz try/catch próprio
- Transições de status de pedido validadas numa única fonte (`canTransition`), compartilhada entre `orders` e o webhook do Stripe — evita estado inconsistente entre os dois fluxos
- Decremento de estoque atômico (`updateMany` com guard `stock >= quantity`) — fecha race condition em checkouts concorrentes
- Webhook idempotente — ignora eventos atrasados/duplicados que não representam transição válida
- Env validado no boot com Zod — app não sobe com config inválida
- Rate limit de auth desativado só em `NODE_ENV=test` (`skipIf` no Throttler) — suíte e2e roda serial contra um DB compartilhado e faz vários logins legítimos em sequência; produção mantém o limite real

## Setup local

```bash
docker compose up -d postgres

cd backend
cp .env.example .env
npm install
npx prisma migrate deploy
npm run start:dev
```

API em `http://localhost:3000`, docs Swagger em `http://localhost:3000/docs`.

### Testes e2e

Rodam contra o banco real (limpa as tabelas entre specs) — precisa do postgres em pé e `.env` configurado.

```bash
npm run test:e2e
```

Cobre auth (registro, login, mensagem genérica de credencial inválida), guards de role em `products`, e o fluxo completo de checkout — inclui o cenário de estoque concorrente e cancelamento de pedido.

### Testando via Postman

Collection + environment em `docs/`:

1. Importe `docs/ecommerce-portfolio.postman_collection.json` e `docs/local.postman_environment.json`
2. Rode `Auth → Register` — token de customer é salvo automaticamente na variável de coleção
3. Pra rotas admin (`Products (Admin)`, `Categories (Admin)`, `Update Order Status`): promova o usuário registrado pra `ADMIN` direto no banco (`npx prisma studio`, ou `UPDATE users SET role = 'ADMIN' WHERE email = '...'`) — não existe endpoint de auto-promoção, é intencional — depois rode `Auth → Login as Admin`
4. Siga as pastas em ordem: Products → Categories → Addresses → Cart → Orders → Payments

## Roadmap

- [x] Arquitetura + schema Prisma
- [x] Env validation (startup) + error handling centralizado
- [x] Auth (JWT + refresh + guards por role)
- [x] CRUD produtos/categorias (admin)
- [x] Carrinho
- [x] Checkout + Stripe webhook
- [x] Testes e2e
- [x] CI (GitHub Actions)
- [x] ESLint config
- [x] Collection Postman

## Autor

**Matheus Piorunneck**
[GitHub](https://github.com/matheuspiorunneck08) · [LinkedIn](https://www.linkedin.com/in/matheus-piorunneck-8255243b8)
