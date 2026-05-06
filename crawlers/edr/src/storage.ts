import { PoolClient } from 'pg';
import { pool } from './db';
import { EdrRecord, EdrFounder, EdrBeneficiary, EdrRole } from './types';

// Знайти або створити особу, повернути її id
async function upsertPerson(
  client: PoolClient,
  name: string,
  rnokpp?: string,
  address?: string,
  country?: string
): Promise<number> {
  const normName = name.trim().toUpperCase();

  // Спочатку шукаємо по РНОКПП (якщо є)
  if (rnokpp) {
    const found = await client.query(
      'SELECT id FROM persons WHERE rnokpp=$1 LIMIT 1', [rnokpp]
    );
    if (found.rows[0]) {
      await client.query(
        'UPDATE persons SET full_name=$1, address=COALESCE($2,address), updated_at=NOW() WHERE id=$3',
        [normName, address ?? null, found.rows[0].id]
      );
      return found.rows[0].id;
    }
  }

  // Шукаємо по імені + адресі
  const byName = await client.query(
    'SELECT id FROM persons WHERE full_name=$1 AND (address=$2 OR address IS NULL) LIMIT 1',
    [normName, address ?? null]
  );
  if (byName.rows[0]) return byName.rows[0].id;

  // Створюємо нову
  const ins = await client.query(`
    INSERT INTO persons (full_name, rnokpp, address, country, updated_at)
    VALUES ($1,$2,$3,$4,NOW()) RETURNING id
  `, [normName, rnokpp ?? null, address ?? null, country ?? 'Україна']);
  return ins.rows[0].id;
}

// Зберегти зв'язок компанія ↔ особа (з перевіркою дублів)
async function upsertCompanyPerson(
  client: PoolClient,
  companyId: number,
  personId: number,
  role: string,
  extra: {
    sharePct?: number;
    shareAmount?: number;
    influenceType?: string;
    ownershipType?: string;
    source?: string;
  } = {}
): Promise<void> {
  const exists = await client.query(
    'SELECT id FROM company_persons WHERE company_id=$1 AND person_id=$2 AND role=$3 AND is_active=TRUE LIMIT 1',
    [companyId, personId, role]
  );
  if (exists.rows[0]) return; // вже є

  await client.query(`
    INSERT INTO company_persons
      (company_id, person_id, role, share_pct, share_amount, influence_type, ownership_type, source, is_active)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,TRUE)
  `, [
    companyId, personId, role,
    extra.sharePct ?? null,
    extra.shareAmount ?? null,
    extra.influenceType ?? null,
    extra.ownershipType ?? null,
    extra.source ?? 'edr',
  ]);
}

// Зберегти запис в історію якщо значення змінилось
async function recordHistory(
  client: PoolClient,
  companyId: number,
  field: string,
  oldVal: string | null,
  newVal: string | null,
  sourceFile?: string
): Promise<void> {
  const o = (oldVal ?? '').trim();
  const n = (newVal ?? '').trim();
  if (o === n) return;

  await client.query(`
    INSERT INTO company_history (company_id, changed_at, field_name, old_value, new_value, source_file)
    VALUES ($1, NOW(), $2, $3, $4, $5)
  `, [companyId, field, o || null, n || null, sourceFile ?? null]);
}

// ─── ГОЛОВНА ФУНКЦІЯ: зберегти компанію ──────────────────────
export async function saveCompany(record: EdrRecord): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Upsert companies
    const existing = await client.query(
      'SELECT id, name, status, address, phone, email, primary_kved FROM companies WHERE edrpou=$1 LIMIT 1',
      [record.edrpou]
    );

    let companyId: number;

    if (existing.rows[0]) {
      companyId = existing.rows[0].id;
      const old = existing.rows[0];

      // Записуємо зміни в history
      await recordHistory(client, companyId, 'name',    old.name,    record.name,    record.sourceFile);
      await recordHistory(client, companyId, 'status',  old.status,  record.status,  record.sourceFile);
      await recordHistory(client, companyId, 'address', old.address, record.address ?? null, record.sourceFile);
      await recordHistory(client, companyId, 'phone',   old.phone,   record.phone ?? null, record.sourceFile);
      await recordHistory(client, companyId, 'email',   old.email,   record.email ?? null, record.sourceFile);

      await client.query(`
        UPDATE companies SET
          name=$1, short_name=$2, legal_form=$3, status=$4,
          address=$5, region=$6, locality=$7, postal_code=$8,
          phone=$9, email=$10, website=$11,
          registration_date=$12, registration_num=$13,
          capital=$14, tax_status=$15, tax_debt=$16,
          primary_kved=$17, primary_kved_name=$18,
          source_file=$19, edr_updated_at=$20, updated_at=NOW()
        WHERE id=$21
      `, [
        record.name, record.shortName ?? null, record.legalForm ?? null, record.status,
        record.address ?? null, record.region ?? null, record.locality ?? null, record.postalCode ?? null,
        record.phone ?? null, record.email ?? null, record.website ?? null,
        record.registrationDate ?? null, record.registrationNumber ?? null,
        record.capital ?? null, record.taxStatus ?? null, record.taxDebt ?? false,
        record.activities[0]?.code ?? null, record.activities[0]?.name ?? null,
        record.sourceFile ?? null, record.updatedAt, companyId,
      ]);
    } else {
      const ins = await client.query(`
        INSERT INTO companies (
          edrpou, name, short_name, legal_form, status,
          address, region, locality, postal_code,
          phone, email, website,
          registration_date, registration_num,
          capital, tax_status, tax_debt,
          primary_kved, primary_kved_name,
          source_file, edr_updated_at, updated_at
        ) VALUES (
          $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,
          $15,$16,$17,$18,$19,$20,$21,NOW()
        ) RETURNING id
      `, [
        record.edrpou, record.name, record.shortName ?? null, record.legalForm ?? null, record.status,
        record.address ?? null, record.region ?? null, record.locality ?? null, record.postalCode ?? null,
        record.phone ?? null, record.email ?? null, record.website ?? null,
        record.registrationDate ?? null, record.registrationNumber ?? null,
        record.capital ?? null, record.taxStatus ?? null, record.taxDebt ?? false,
        record.activities[0]?.code ?? null, record.activities[0]?.name ?? null,
        record.sourceFile ?? null, record.updatedAt,
      ]);
      companyId = ins.rows[0].id;
    }

    // 2. КВЕДи — замінюємо повністю
    await client.query('DELETE FROM company_kveds WHERE company_id=$1', [companyId]);
    for (const act of record.activities) {
      await client.query(`
        INSERT INTO company_kveds (company_id, kved_code, kved_name, is_primary)
        VALUES ($1,$2,$3,$4)
      `, [companyId, act.code, act.name ?? null, act.isPrimary]);
    }

    // 3. Деактивуємо старі зв'язки з особами
    await client.query(
      "UPDATE company_persons SET is_active=FALSE WHERE company_id=$1 AND source='edr'",
      [companyId]
    );

    // 4. Засновники
    for (const f of record.founders) {
      if (!f.name?.trim()) continue;
      const pId = await upsertPerson(client, f.name, f.code, f.address, f.country);
      await upsertCompanyPerson(client, companyId, pId, 'founder', {
        sharePct: f.sharePct, shareAmount: f.share, ownershipType: f.ownershipType,
      });
    }

    // 5. Бенефіціари
    for (const b of record.beneficiaries) {
      if (!b.name?.trim()) continue;
      const pId = await upsertPerson(client, b.name, b.code, b.address, b.country);
      await upsertCompanyPerson(client, companyId, pId, 'beneficiary', {
        sharePct: b.sharePct, influenceType: b.influenceType, ownershipType: b.ownershipType,
      });
    }

    // 6. Ролі: керівник / підписант / бухгалтер
    for (const r of record.roles) {
      if (!r.name?.trim()) continue;
      const pId = await upsertPerson(client, r.name);
      const roleMap: Record<string, string> = {
        'керівник': 'director', 'підписант': 'signatory',
        'бухгалтер': 'accountant', 'ліквідатор': 'liquidator',
      };
      const role = roleMap[r.role.toLowerCase()] ?? r.role.toLowerCase();
      await upsertCompanyPerson(client, companyId, pId, role);
    }

    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}
