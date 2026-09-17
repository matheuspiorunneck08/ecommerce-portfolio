# Ecommerce Portfolio

E-commerce full stack pra portfólio: NestJS + Prisma + PostgreSQL no backend, React + Vite no frontend.

## Stack

- **Backend**: NestJS, Prisma ORM, PostgreSQL, JWT auth, Stripe (test mode)
- **Frontend**: React + Vite, React Router, Axios
- **Infra**: Docker Compose (postgres + backend)
- **Testes**: Jest (unit + e2e)
- **Docs**: Swagger em `/docs`

## Módulos backend

`auth` `users` `products` `categories` `addresses` `cart` `orders` `payments`

## Schema (resumo)

users → addresses, cart, orders
products ↔ categories (N:N via product_categories)
cart → cart_items → products
orders → order_items (snapshot preço/nome) → payment

## Setup local

```bash
# 1. subir postgres
docker compose up -d postgres

# 2. backend
cd backend
cp .env.example .env
npm install
npx prisma migrate dev --name init
npm run start:dev

# 3. frontend (outro terminal)
cd frontend
npm install
npm run dev
```

API disponível em `http://localhost:3000`, docs Swagger em `http://localhost:3000/docs`.
Frontend em `http://localhost:5173`.

## Roadmap

- [x] Arquitetura + schema Prisma
- [x] Env validation (startup) + error handling centralizado
- [x] Auth (JWT + refresh + guards por role)
- [x] CRUD produtos/categorias (admin)
- [x] Carrinho
- [x] Checkout + Stripe webhook
- [ ] Painel admin (frontend)
- [ ] Testes e2e
- [ ] CI (GitHub Actions)
