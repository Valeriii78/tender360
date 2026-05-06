# Prozorro Crawler

Краулер для скачивания тендеров с публичного API Prozorro в PostgreSQL.

## Структура файлов

```
src/
  index.ts    — точка входа, оркестратор (full sync + incremental loop)
  api.ts      — HTTP-клиент к Prozorro API с retry-логикой
  db.ts       — подключение к PostgreSQL, схема БД, crawler_state
  storage.ts  — сохранение тендеров в БД (upsert)
  types.ts    — TypeScript типы для API-ответов
```

## Быстрый старт

### 1. Создай PostgreSQL на Railway
- Заходи на railway.app
- New Project → Add Database → PostgreSQL
- Скопируй DATABASE_URL из вкладки Variables

### 2. Установка
```bash
npm install
cp .env.example .env
# Вставь DATABASE_URL в .env
```

### 3. Запуск
```bash
npm run crawl
```

Краулер сам:
1. Создаст все таблицы при первом запуске
2. Запустит полный sync (качает ВСЁ с начала)
3. После завершения перейдёт в инкрементальный режим (каждые 5 минут)

### 4. Деплой на Railway (рядом с БД)
```bash
# В Railway создай новый Service → GitHub repo
# Добавь переменную DATABASE_URL
# Start command: npm run start
# Build command: npm run build
```

## Что сохраняется в БД

| Таблица        | Что хранит                              |
|----------------|-----------------------------------------|
| `tenders`      | Основные данные тендера, сумма, статус  |
| `buyers`       | Заказчики (ЕГРПОУ, контакты, адрес)     |
| `suppliers`    | Поставщики / участники торгов           |
| `bids`         | Все ставки участников                   |
| `awards`       | Победители                              |
| `tender_items` | Предметы закупки (CPV-коды)             |
| `crawler_state`| Прогресс краулера (offset для resume)   |

## Важные детали

- **Resume**: если краулер упал — при перезапуске продолжит с того же места
- **Upsert**: повторный запуск не дублирует данные, только обновляет
- **Rate limit**: при 429 автоматически ждёт и повторяет
- **Concurrency**: 5 параллельных запросов за деталями тендера
