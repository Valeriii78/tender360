# 🇺🇦 Prozorro Analytics — Мануал запуску

## Що це

Повна аналітична платформа держзакупівель України — безкоштовний аналог Clarity Project.

```
Компоненти:
  prozorro-crawler/   — качає тендери з Prozorro API (вже готовий)
  edr-crawler/        — качає ЄДР з data.gov.ua (вже готовий)
  platform/
    backend/          — REST API (Node.js + Fastify + PostgreSQL)
    frontend/         — UI (Next.js 14)
    crawlers/
      sanctions/      — санкції РНБО та ЄС
      courts/         — судовий реєстр
```

---

## КРОК 1 — PostgreSQL на Railway

1. Зайди на **https://railway.app** → New Project → Add Database → PostgreSQL
2. Зачекай 30 секунд поки підніметься
3. Натисни на сервіс PostgreSQL → вкладка **Variables**
4. Скопіюй рядок `DATABASE_URL` — він виглядає так:
   ```
   postgresql://postgres:xxxxxxxx@monorail.proxy.rlwy.net:12345/railway
   ```
5. Збережи цей рядок — він потрібний **для всіх компонентів**

---

## КРОК 2 — Налаштування .env файлів

У кожному з чотирьох компонентів є `.env.example`. Скопіюй у `.env` і встав `DATABASE_URL`:

```bash
# Для кожного компонента:
cp .env.example .env
```

Вміст кожного `.env`:
```env
DATABASE_URL=postgresql://postgres:xxxxxxxx@monorail.proxy.rlwy.net:12345/railway
NODE_ENV=production
```

---

## КРОК 3 — Запуск Prozorro краулера (перший)

```bash
cd prozorro-crawler
npm install
npm run crawl
```

**Що відбудеться:**
- Автоматично створяться таблиці: `tenders`, `buyers`, `suppliers`, `bids`, `awards`, `tender_items`
- Почнеться повний sync з Prozorro API (~3–6 млн тендерів, займе 4–12 годин)
- Прогрес зберігається — якщо зупинити і перезапустити, продовжить з того ж місця

**Лог має виглядати так:**
```
🇺🇦 Prozorro Crawler v1.0
✅ Database schema initialized
🚀 ПОВНИЙ SYNC — починаємо...
📄 Сторінка 1 | 100 тендерів | всього: 100
📄 Сторінка 2 | 100 тендерів | всього: 200
...
```

> 💡 Можна продовжити з КРОКУ 4 поки краулер працює у фоні

---

## КРОК 4 — Запуск ЄДР краулера (паралельно)

```bash
# В НОВОМУ терміналі:
cd edr-crawler
npm install
npm run full
```

**Що відбудеться:**
- Додадуться таблиці: `companies`, `persons`, `company_persons`, `company_kveds`, `company_history`, `sanctions`, `court_cases`, `public_finances`
- Завантажить XML-дамп з data.gov.ua (~1–3 GB після розпакування)
- Розпарсить ~4.5 млн компаній та ФОП (~2–4 години)

**Лог має виглядати так:**
```
🇺🇦 ЄДР Crawler v1.0
✅ EDR Database schema initialized
🗂  Повний реєстр юридичних осіб
🔍 Знаходжу URL дампу...
✅ URL: https://data.gov.ua/dataset/...
⬇️  Завантажую...
📦 Розпаковано: edr_full.xml (1842.3 MB)
📂 Обробляю: edr_full.xml
  ✅ 10,000 збережено | 312/сек | помилок: 0
  ✅ 20,000 збережено | 318/сек | помилок: 0
...
```

---

## КРОК 5 — Краулер санкцій

```bash
cd platform/crawlers/sanctions
npm install        # (якщо є package.json)
npx tsx index.ts
```

Займає ~2 хвилини. Наповнює таблицю `sanctions`.

---

## КРОК 6 — Краулер судів

```bash
cd platform/crawlers/courts
npx tsx index.ts
```

Займає ~30–60 хвилин (перевіряє топ-500 компаній Prozorro).

---

## КРОК 7 — Запуск Backend API

```bash
cd platform/backend
npm install
```

Створи `.env`:
```env
DATABASE_URL=postgresql://...  # той самий рядок
PORT=3001
NODE_ENV=production
```

```bash
# Режим розробки:
npm run dev

# Або збірка + продакшн:
npm run build
npm start
```

**Перевірка що API працює:**
```bash
curl http://localhost:3001/health
# → {"status":"ok","ts":"2026-04-15T..."}

curl "http://localhost:3001/api/search/companies?q=весна&limit=5"
# → {"data":[...],"total":42,...}

curl "http://localhost:3001/api/company/23937436"
# → повний профіль компанії
```

---

## КРОК 8 — Запуск Frontend

```bash
cd platform/frontend
npm install
```

Створи `.env.local`:
```env
NEXT_PUBLIC_API_URL=http://localhost:3001
```

```bash
npm run dev
```

Відкрий **http://localhost:3000**

---

## КРОК 9 — Деплой на Railway + Vercel

### Backend на Railway:

1. Railway → New Project → Deploy from GitHub repo
2. Вибери папку `platform/backend`
3. Variables → додай `DATABASE_URL` (той самий), `PORT=3001`, `NODE_ENV=production`
4. Після деплою отримаєш URL типу: `https://backend-production-xxxx.up.railway.app`

### Frontend на Vercel:

1. **https://vercel.com** → New Project → Import GitHub repo
2. Root Directory → `platform/frontend`
3. Environment Variables → `NEXT_PUBLIC_API_URL=https://backend-production-xxxx.up.railway.app`
4. Deploy

### Crawlers на Railway (окремі сервіси):

Для кожного краулера (prozorro, edr) — окремий Railway сервіс:
1. New Service → GitHub → вибрати папку краулера
2. Додати `DATABASE_URL`
3. Start command: `npm start`

---

## Автоматичне оновлення даних

| Компонент | Коли оновлюється | Як налаштувати |
|---|---|---|
| Prozorro | Кожні 5 хвилин (вбудовано) | Краулер сам перемикається після full sync |
| ЄДР | Щодня о 02:00 | `EDR_MODE=watch npm start` |
| Санкції | Щотижня | Cron job або Railway Schedule |
| Суди | Щотижня | Те саме |

**Railway Schedule** (для sanctions та courts):
1. Сервіс → Settings → Cron Schedule
2. Встанови: `0 2 * * 0` (щонеділі о 02:00)

---

## Тестування після запуску

```bash
# 1. Перевірити кількість записів в БД:
psql $DATABASE_URL -c "
  SELECT 'tenders' as table, COUNT(*) FROM tenders
  UNION ALL SELECT 'companies', COUNT(*) FROM companies
  UNION ALL SELECT 'persons', COUNT(*) FROM persons
  UNION ALL SELECT 'sanctions', COUNT(*) FROM sanctions;
"

# 2. Тест пошуку компанії:
curl "http://localhost:3001/api/company/23937436" | python3 -m json.tool

# 3. Тест тендерів:
curl "http://localhost:3001/api/company/23937436/prozorro/participant?limit=5"

# 4. Тест пошуку:
curl "http://localhost:3001/api/search/companies?q=весна+ділогія"

# 5. Тест експорту:
curl "http://localhost:3001/api/export/csv?edrpou=23937436&role=supplier" -o test.csv

# 6. Тест санкцій:
curl "http://localhost:3001/api/company/23937436" | python3 -c "import sys,json; d=json.load(sys.stdin); print('sanctions:', len(d['sanctions']))"
```

---

## Можливі проблеми та рішення

**❌ `ECONNREFUSED` при підключенні до БД**
- Перевір `DATABASE_URL` — має бути без пробілів
- Якщо Railway — перевір чи сервіс запущений

**❌ Краулер зупинився на середині**
- Просто перезапусти — продовжить з того ж місця (offset зберігається в `crawler_state`)

**❌ `npm install` падає з помилкою**
- Потрібен Node.js >= 18: `node -v`
- Оновити: `nvm install 20 && nvm use 20`

**❌ XML парсинг дуже повільний**
- Нормально — 300–500 записів/сек. 4.5 млн записів = ~3 години
- Можна прискорити підвищивши `BATCH_SIZE` в `edr-crawler/src/index.ts`

**❌ Frontend не бачить API**
- Перевір `NEXT_PUBLIC_API_URL` в `.env.local`
- Перевір що backend запущений на порті 3001

---

## Структура URL на готовому сайті

```
/                           — Головна + пошук
/search/companies?q=...     — Пошук компаній
/search/tenders?q=...       — Пошук тендерів
/search/persons?q=...       — Пошук осіб
/company/23937436           — Профіль компанії
/person/42                  — Профіль особи
/tender/UA-2026-03-04-...   — Деталі тендера
/analytics                  — Аналітичний дашборд

API:
GET /api/search/companies?q=...
GET /api/company/:edrpou
GET /api/company/:edrpou/prozorro/participant
GET /api/company/:edrpou/graph
GET /api/export/xlsx?edrpou=...&role=supplier
GET /api/export/csv?edrpou=...&role=supplier
GET /api/export/pdf?edrpou=...&role=supplier
```

---

## Контрольний список ✅

- [ ] PostgreSQL на Railway — отримав `DATABASE_URL`
- [ ] Prozorro краулер — запущено, перші дані є
- [ ] ЄДР краулер — запущено, перші компанії є
- [ ] Backend API — відповідає на `/health`
- [ ] Frontend — відкривається на `localhost:3000`
- [ ] Пошук — знаходить компанію по ЄДРПОУ
- [ ] Профіль компанії — показує дані
- [ ] Експорт — завантажується XLS/CSV/PDF
- [ ] Тема — перемикається темна/світла

---

*Prozorro Analytics — безкоштовно для всіх*
