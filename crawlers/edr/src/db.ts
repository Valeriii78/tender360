import { Pool } from 'pg';

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  max: 10,
  idleTimeoutMillis: 30000,
});

export async function initEdrDatabase(): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    await client.query(`
      -- ─── КОМПАНІЇ (розширена таблиця) ────────────────────────
      CREATE TABLE IF NOT EXISTS companies (
        id               SERIAL PRIMARY KEY,
        edrpou           VARCHAR(20) UNIQUE NOT NULL,
        name             TEXT NOT NULL,
        short_name       TEXT,
        legal_form       TEXT,
        status           VARCHAR(50),
        address          TEXT,
        region           TEXT,
        locality         TEXT,
        postal_code      VARCHAR(10),
        phone            TEXT,
        email            TEXT,
        website          TEXT,
        registration_date DATE,
        registration_num VARCHAR(50),
        capital          NUMERIC(20,2),
        tax_status       TEXT,
        tax_debt         BOOLEAN DEFAULT FALSE,
        primary_kved     VARCHAR(10),
        primary_kved_name TEXT,
        source_file      TEXT,
        edr_updated_at   TIMESTAMPTZ,
        created_at       TIMESTAMPTZ DEFAULT NOW(),
        updated_at       TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_companies_edrpou  ON companies(edrpou);
      CREATE INDEX IF NOT EXISTS idx_companies_name    ON companies USING gin(to_tsvector('simple', name));
      CREATE INDEX IF NOT EXISTS idx_companies_region  ON companies(region);
      CREATE INDEX IF NOT EXISTS idx_companies_status  ON companies(status);

      -- ─── ФІЗИЧНІ ОСОБИ ────────────────────────────────────────
      CREATE TABLE IF NOT EXISTS persons (
        id         SERIAL PRIMARY KEY,
        full_name  TEXT NOT NULL,
        rnokpp     VARCHAR(20),           -- податковий номер (якщо є)
        address    TEXT,
        country    VARCHAR(100) DEFAULT 'Україна',
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_persons_name   ON persons USING gin(to_tsvector('simple', full_name));
      CREATE INDEX IF NOT EXISTS idx_persons_rnokpp ON persons(rnokpp);

      -- ─── РОЛІ: засновник / керівник / бенефіціар / підписант ──
      CREATE TABLE IF NOT EXISTS company_persons (
        id            SERIAL PRIMARY KEY,
        company_id    INT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
        person_id     INT NOT NULL REFERENCES persons(id),
        role          VARCHAR(50) NOT NULL,
        -- роль: founder | beneficiary | director | accountant | signatory | liquidator
        share_amount  NUMERIC(20,2),      -- розмір внеску (грн)
        share_pct     NUMERIC(5,2),       -- % частки
        influence_type TEXT,              -- для бенефіціарів
        ownership_type TEXT,              -- юр/фіз особа
        is_active     BOOLEAN DEFAULT TRUE,
        source        VARCHAR(20) DEFAULT 'edr',
        valid_from    TIMESTAMPTZ,
        valid_to      TIMESTAMPTZ,
        created_at    TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_cp_company  ON company_persons(company_id);
      CREATE INDEX IF NOT EXISTS idx_cp_person   ON company_persons(person_id);
      CREATE INDEX IF NOT EXISTS idx_cp_role     ON company_persons(role);

      -- ─── КВЕДи ────────────────────────────────────────────────
      CREATE TABLE IF NOT EXISTS company_kveds (
        id          SERIAL PRIMARY KEY,
        company_id  INT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
        kved_code   VARCHAR(10) NOT NULL,
        kved_name   TEXT,
        is_primary  BOOLEAN DEFAULT FALSE
      );
      CREATE INDEX IF NOT EXISTS idx_kveds_company ON company_kveds(company_id);
      CREATE INDEX IF NOT EXISTS idx_kveds_code    ON company_kveds(kved_code);

      -- ─── ІСТОРІЯ ЗМІН ЄДР ────────────────────────────────────
      CREATE TABLE IF NOT EXISTS company_history (
        id           SERIAL PRIMARY KEY,
        company_id   INT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
        changed_at   TIMESTAMPTZ NOT NULL,
        field_name   VARCHAR(100) NOT NULL,
        old_value    TEXT,
        new_value    TEXT,
        source_file  TEXT
      );
      CREATE INDEX IF NOT EXISTS idx_history_company  ON company_history(company_id);
      CREATE INDEX IF NOT EXISTS idx_history_changed  ON company_history(changed_at DESC);

      -- ─── САНКЦІЇ ──────────────────────────────────────────────
      CREATE TABLE IF NOT EXISTS sanctions (
        id           SERIAL PRIMARY KEY,
        entity_type  VARCHAR(10) NOT NULL,  -- company | person
        entity_name  TEXT NOT NULL,
        edrpou       VARCHAR(20),
        reason       TEXT,
        date_added   DATE,
        date_expires DATE,
        source       VARCHAR(100),
        is_active    BOOLEAN DEFAULT TRUE,
        created_at   TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_sanctions_edrpou ON sanctions(edrpou);
      CREATE INDEX IF NOT EXISTS idx_sanctions_name   ON sanctions USING gin(to_tsvector('simple', entity_name));

      -- ─── СУДОВІ СПРАВИ ────────────────────────────────────────
      CREATE TABLE IF NOT EXISTS court_cases (
        id           SERIAL PRIMARY KEY,
        case_number  VARCHAR(100) UNIQUE,
        company_id   INT REFERENCES companies(id),
        person_id    INT REFERENCES persons(id),
        court_name   TEXT,
        category     TEXT,
        status       VARCHAR(50),
        date_opened  DATE,
        date_closed  DATE,
        description  TEXT,
        source_url   TEXT,
        created_at   TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_court_company ON court_cases(company_id);
      CREATE INDEX IF NOT EXISTS idx_court_person  ON court_cases(person_id);

      -- ─── ПУБЛІЧНІ ФІНАНСИ (spending.gov.ua) ──────────────────
      CREATE TABLE IF NOT EXISTS public_finances (
        id           SERIAL PRIMARY KEY,
        company_id   INT REFERENCES companies(id),
        edrpou       VARCHAR(20),
        period       VARCHAR(10),          -- 2023-Q1, 2024 тощо
        revenue      NUMERIC(20,2),
        assets       NUMERIC(20,2),
        employees    INT,
        profit       NUMERIC(20,2),
        created_at   TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_finances_company ON public_finances(company_id);

      -- ─── КРАУЛЕР СТАН (загальний) ─────────────────────────────
      CREATE TABLE IF NOT EXISTS crawler_state (
        key        VARCHAR(100) PRIMARY KEY,
        value      TEXT,
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    await client.query('COMMIT');
    console.log('✅ EDR Database schema initialized');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

export async function getCrawlerState(key: string): Promise<string | null> {
  const res = await pool.query('SELECT value FROM crawler_state WHERE key=$1', [key]);
  return res.rows[0]?.value ?? null;
}

export async function setCrawlerState(key: string, value: string): Promise<void> {
  await pool.query(`
    INSERT INTO crawler_state (key, value, updated_at)
    VALUES ($1,$2,NOW())
    ON CONFLICT (key) DO UPDATE SET value=$2, updated_at=NOW()
  `, [key, value]);
}
