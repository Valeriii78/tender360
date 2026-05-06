import { Pool } from 'pg';

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

export async function initDatabase(): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query(`
      -- Заказчики
      CREATE TABLE IF NOT EXISTS buyers (
        id           SERIAL PRIMARY KEY,
        edrpou       VARCHAR(20) UNIQUE NOT NULL,
        name         TEXT,
        region       TEXT,
        locality     TEXT,
        address      TEXT,
        phone        TEXT,
        email        TEXT,
        url          TEXT,
        created_at   TIMESTAMPTZ DEFAULT NOW(),
        updated_at   TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_buyers_edrpou ON buyers(edrpou);

      -- Поставщики / участники
      CREATE TABLE IF NOT EXISTS suppliers (
        id           SERIAL PRIMARY KEY,
        edrpou       VARCHAR(20) UNIQUE NOT NULL,
        name         TEXT,
        address      TEXT,
        phone        TEXT,
        email        TEXT,
        created_at   TIMESTAMPTZ DEFAULT NOW(),
        updated_at   TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_suppliers_edrpou ON suppliers(edrpou);

      -- Тендеры
      CREATE TABLE IF NOT EXISTS tenders (
        id                       VARCHAR(64) PRIMARY KEY,
        tender_id                VARCHAR(64),
        title                    TEXT,
        description              TEXT,
        status                   VARCHAR(50),
        procurement_method_type  VARCHAR(100),
        procurement_method       VARCHAR(50),
        category                 VARCHAR(50),
        amount                   NUMERIC(20,2),
        currency                 VARCHAR(10) DEFAULT 'UAH',
        cpv_code                 VARCHAR(20),
        cpv_description          TEXT,
        buyer_id                 INT REFERENCES buyers(id),
        award_criteria           VARCHAR(100),
        date_created             TIMESTAMPTZ,
        date_modified            TIMESTAMPTZ,
        tender_period_start      TIMESTAMPTZ,
        tender_period_end        TIMESTAMPTZ,
        synced_at                TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_tenders_date_modified ON tenders(date_modified DESC);
      CREATE INDEX IF NOT EXISTS idx_tenders_status        ON tenders(status);
      CREATE INDEX IF NOT EXISTS idx_tenders_cpv_code      ON tenders(cpv_code);
      CREATE INDEX IF NOT EXISTS idx_tenders_amount        ON tenders(amount);
      CREATE INDEX IF NOT EXISTS idx_tenders_buyer_id      ON tenders(buyer_id);

      -- Предметы закупки
      CREATE TABLE IF NOT EXISTS tender_items (
        id              SERIAL PRIMARY KEY,
        tender_id       VARCHAR(64) REFERENCES tenders(id) ON DELETE CASCADE,
        description     TEXT,
        cpv_code        VARCHAR(20),
        cpv_description TEXT,
        quantity        NUMERIC(15,4),
        unit            VARCHAR(100)
      );
      CREATE INDEX IF NOT EXISTS idx_items_tender_id ON tender_items(tender_id);
      CREATE INDEX IF NOT EXISTS idx_items_cpv_code  ON tender_items(cpv_code);

      -- Ставки (все участники торгов)
      CREATE TABLE IF NOT EXISTS bids (
        id            VARCHAR(64) PRIMARY KEY,
        tender_id     VARCHAR(64) REFERENCES tenders(id) ON DELETE CASCADE,
        supplier_id   INT REFERENCES suppliers(id),
        amount        NUMERIC(20,2),
        status        VARCHAR(50),
        bid_date      TIMESTAMPTZ
      );
      CREATE INDEX IF NOT EXISTS idx_bids_tender_id   ON bids(tender_id);
      CREATE INDEX IF NOT EXISTS idx_bids_supplier_id ON bids(supplier_id);

      -- Победители
      CREATE TABLE IF NOT EXISTS awards (
        id            VARCHAR(64) PRIMARY KEY,
        tender_id     VARCHAR(64) REFERENCES tenders(id) ON DELETE CASCADE,
        supplier_id   INT REFERENCES suppliers(id),
        amount        NUMERIC(20,2),
        status        VARCHAR(50),
        award_date    TIMESTAMPTZ
      );
      CREATE INDEX IF NOT EXISTS idx_awards_tender_id   ON awards(tender_id);
      CREATE INDEX IF NOT EXISTS idx_awards_supplier_id ON awards(supplier_id);
      CREATE INDEX IF NOT EXISTS idx_awards_status      ON awards(status);

      -- Состояние краулера (offset для resume)
      CREATE TABLE IF NOT EXISTS crawler_state (
        key        VARCHAR(50) PRIMARY KEY,
        value      TEXT,
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    console.log('✅ Database schema initialized');
  } finally {
    client.release();
  }
}

export async function getCrawlerState(key: string): Promise<string | null> {
  const res = await pool.query(
    'SELECT value FROM crawler_state WHERE key = $1',
    [key]
  );
  return res.rows[0]?.value ?? null;
}

export async function setCrawlerState(key: string, value: string): Promise<void> {
  await pool.query(`
    INSERT INTO crawler_state (key, value, updated_at)
    VALUES ($1, $2, NOW())
    ON CONFLICT (key) DO UPDATE SET value = $2, updated_at = NOW()
  `, [key, value]);
}
