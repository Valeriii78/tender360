import { PoolClient } from 'pg';
import { pool } from './db';
import { Tender, Organization } from './types';

// Сохранить организацию (buyer или supplier) и вернуть её DB id
async function upsertOrganization(
  client: PoolClient,
  org: Organization,
  table: 'buyers' | 'suppliers'
): Promise<number | null> {
  const edrpou = org.identifier?.id;
  if (!edrpou) return null;

  const name    = org.name ?? org.identifier?.legalName ?? null;
  const address = [
    org.address?.streetAddress,
    org.address?.locality,
    org.address?.region,
    org.address?.postalCode,
  ].filter(Boolean).join(', ') || null;
  const phone = org.contactPoint?.telephone ?? null;
  const email = org.contactPoint?.email ?? null;
  const region  = org.address?.region ?? null;
  const locality = org.address?.locality ?? null;

  if (table === 'buyers') {
    const url = org.identifier?.uri ?? null;
    const res = await client.query(`
      INSERT INTO buyers (edrpou, name, region, locality, address, phone, email, url, updated_at)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,NOW())
      ON CONFLICT (edrpou) DO UPDATE SET
        name     = COALESCE(EXCLUDED.name, buyers.name),
        region   = COALESCE(EXCLUDED.region, buyers.region),
        locality = COALESCE(EXCLUDED.locality, buyers.locality),
        address  = COALESCE(EXCLUDED.address, buyers.address),
        phone    = COALESCE(EXCLUDED.phone, buyers.phone),
        email    = COALESCE(EXCLUDED.email, buyers.email),
        url      = COALESCE(EXCLUDED.url, buyers.url),
        updated_at = NOW()
      RETURNING id
    `, [edrpou, name, region, locality, address, phone, email, url]);
    return res.rows[0]?.id ?? null;
  } else {
    const res = await client.query(`
      INSERT INTO suppliers (edrpou, name, address, phone, email, updated_at)
      VALUES ($1,$2,$3,$4,$5,NOW())
      ON CONFLICT (edrpou) DO UPDATE SET
        name    = COALESCE(EXCLUDED.name, suppliers.name),
        address = COALESCE(EXCLUDED.address, suppliers.address),
        phone   = COALESCE(EXCLUDED.phone, suppliers.phone),
        email   = COALESCE(EXCLUDED.email, suppliers.email),
        updated_at = NOW()
      RETURNING id
    `, [edrpou, name, address, phone, email]);
    return res.rows[0]?.id ?? null;
  }
}

// Сохранить полный тендер в БД (upsert)
export async function saveTender(tender: Tender): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Заказчик
    let buyerId: number | null = null;
    if (tender.procuringEntity) {
      buyerId = await upsertOrganization(client, tender.procuringEntity, 'buyers');
    }

    // 2. Первый CPV-код из items
    const firstItem = tender.items?.[0];
    const cpvCode   = firstItem?.classification?.id ?? null;
    const cpvDesc   = firstItem?.classification?.description ?? null;

    // 3. Тендер
    await client.query(`
      INSERT INTO tenders (
        id, tender_id, title, description, status,
        procurement_method_type, procurement_method, category,
        amount, currency, cpv_code, cpv_description,
        buyer_id, award_criteria,
        date_created, date_modified,
        tender_period_start, tender_period_end,
        synced_at
      ) VALUES (
        $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,
        $15,$16,$17,$18,NOW()
      )
      ON CONFLICT (id) DO UPDATE SET
        title                  = EXCLUDED.title,
        status                 = EXCLUDED.status,
        amount                 = EXCLUDED.amount,
        cpv_code               = EXCLUDED.cpv_code,
        cpv_description        = EXCLUDED.cpv_description,
        buyer_id               = EXCLUDED.buyer_id,
        date_modified          = EXCLUDED.date_modified,
        tender_period_start    = EXCLUDED.tender_period_start,
        tender_period_end      = EXCLUDED.tender_period_end,
        synced_at              = NOW()
    `, [
      tender.id,
      tender.tenderID ?? null,
      tender.title ?? null,
      tender.description ?? null,
      tender.status ?? null,
      tender.procurementMethodType ?? null,
      tender.procurementMethod ?? null,
      tender.mainProcurementCategory ?? null,
      tender.value?.amount ?? null,
      tender.value?.currency ?? 'UAH',
      cpvCode,
      cpvDesc,
      buyerId,
      tender.awardCriteria ?? null,
      tender.dateCreated ?? null,
      tender.dateModified ?? null,
      tender.tenderPeriod?.startDate ?? null,
      tender.tenderPeriod?.endDate ?? null,
    ]);

    // 4. Items — удаляем старые, вставляем новые
    await client.query('DELETE FROM tender_items WHERE tender_id = $1', [tender.id]);
    for (const item of tender.items ?? []) {
      await client.query(`
        INSERT INTO tender_items (tender_id, description, cpv_code, cpv_description, quantity, unit)
        VALUES ($1,$2,$3,$4,$5,$6)
      `, [
        tender.id,
        item.description ?? null,
        item.classification?.id ?? null,
        item.classification?.description ?? null,
        item.quantity ?? null,
        item.unit?.name ?? null,
      ]);
    }

    // 5. Bids
    await client.query('DELETE FROM bids WHERE tender_id = $1', [tender.id]);
    for (const bid of tender.bids ?? []) {
      if (!bid.id) continue;
      const tenderer = bid.tenderers?.[0];
      let supplierId: number | null = null;
      if (tenderer) {
        supplierId = await upsertOrganization(client, tenderer, 'suppliers');
      }
      await client.query(`
        INSERT INTO bids (id, tender_id, supplier_id, amount, status, bid_date)
        VALUES ($1,$2,$3,$4,$5,$6)
        ON CONFLICT (id) DO NOTHING
      `, [bid.id, tender.id, supplierId, bid.value?.amount ?? null, bid.status ?? null, bid.date ?? null]);
    }

    // 6. Awards
    await client.query('DELETE FROM awards WHERE tender_id = $1', [tender.id]);
    for (const award of tender.awards ?? []) {
      if (!award.id) continue;
      const supplier = award.suppliers?.[0];
      let supplierId: number | null = null;
      if (supplier) {
        supplierId = await upsertOrganization(client, supplier, 'suppliers');
      }
      await client.query(`
        INSERT INTO awards (id, tender_id, supplier_id, amount, status, award_date)
        VALUES ($1,$2,$3,$4,$5,$6)
        ON CONFLICT (id) DO NOTHING
      `, [award.id, tender.id, supplierId, award.value?.amount ?? null, award.status ?? null, award.date ?? null]);
    }

    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}
