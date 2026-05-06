# Tender360 — Аналітика держзакупівель України

Безкоштовний аналог Clarity Project на базі Prozorro API + ЄДР.

## Стек

- **Backend**: Node.js 20 + Fastify + PostgreSQL (`/backend`)
- **Frontend**: Next.js 14 + React 18 (`/frontend`)
- **Crawlers**: Prozorro API + ЄДР XML (`/crawlers/prozorro`, `/crawlers/edr`)
- **DB**: PostgreSQL (Railway)

---

## Деплой за 15 хвилин

### Крок 1 — PostgreSQL на Railway

1. [railway.app](https://railway.app) → **New Project** → **Add Database** → **PostgreSQL**
2. Зачекай ~30 секунд
3. Натисни на сервіс → вкладка **Variables** → скопіюй `DATABASE_URL`

```
postgresql://postgres:XXXX@monorail.proxy.rlwy.net:PORT/railway
```

---

### Крок 2 — Backend на Railway

1. У тому самому проекті: **+ New** → **GitHub Repo**
2. Вибери репо `tender360`, Root Directory: **`backend`**
3. **Variables** → додай:
   ```
   DATABASE_URL=<той самий рядок>
   PORT=3001
   NODE_ENV=production
   ```
4. Railway автоматично збере (`npm run build`) та запустить (`npm start`)
5. Після деплою скопіюй URL: `https://backend-xxxx.up.railway.app`
6. Перевірка: `https://backend-xxxx.up.railway.app/health` → `{"status":"ok"}`

---

### Крок 3 — Frontend на Vercel

1. [vercel.com](https://vercel.com) → **New Project** → Import `tender360`
2. Root Directory: **`frontend`**
3. Environment Variables:
   ```
   NEXT_PUBLIC_API_URL=https://backend-xxxx.up.railway.app
   ```
4. **Deploy**
5. Отримаєш URL: `https://tender360-xxxx.vercel.app`

---

### Крок 4 — Запуск Prozorro краулера

1. Railway → той самий проект → **+ New** → **GitHub Repo**
2. Root Directory: **`crawlers/prozorro`**
3. Variables: `DATABASE_URL=<той самий>`
4. Start command: `npm run build && npm start`

Краулер сам запуститься і почне завантажувати тендери (~4-12 годин для повного sync).

---

### Крок 5 — Запуск ЄДР краулера

1. Railway → **+ New** → **GitHub Repo**
2. Root Directory: **`crawlers/edr`**
3. Variables: `DATABASE_URL=<той самий>`, `EDR_MODE=full`
4. Start command: `npm run build && npm start`

---

## API Endpoints

```
GET /health
GET /api/search/companies?q=назва&limit=20&offset=0
GET /api/search/tenders?q=назва&status=complete
GET /api/search/persons?q=прізвище
GET /api/company/:edrpou
GET /api/company/:edrpou/prozorro/participant
GET /api/company/:edrpou/graph
GET /api/person/:id
GET /api/tenders?q=...&status=...&dateFrom=...&dateTo=...
GET /api/analytics/summary
GET /api/export/xlsx?edrpou=...&role=supplier
GET /api/export/csv?edrpou=...&role=supplier
GET /api/export/pdf?edrpou=...&role=supplier
```

---

## Локальний запуск

```bash
# Backend
cd backend
cp .env.example .env   # вставити DATABASE_URL
npm install
npm run dev            # http://localhost:3001

# Frontend
cd frontend
cp .env.local.example .env.local
npm install
npm run dev            # http://localhost:3000
```
