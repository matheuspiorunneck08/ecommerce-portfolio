# Ecommerce Portfolio

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

## Setup local

```bash
docker compose up -d postgres

cd backend
cp .env.example .env
npm install
npx prisma migrate dev --name init
npm run start:dev
```

API em `http://localhost:3000`, docs Swagger em `http://localhost:3000/docs`.

## Roadmap

- [x] Arquitetura + schema Prisma
- [x] Env validation (startup) + error handling centralizado
- [x] Auth (JWT + refresh + guards por role)
- [x] CRUD produtos/categorias (admin)
- [x] Carrinho
- [x] Checkout + Stripe webhook
- [ ] Testes e2e
- [ ] CI (GitHub Actions)
- [ ] Collection Postman/Insomnia
