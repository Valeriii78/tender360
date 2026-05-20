import fs from 'fs';
import path from 'path';
import { createReadStream } from 'fs';
import { createWriteStream } from 'fs';
import { EdrRecord, EdrActivity, EdrFounder, EdrRole } from './types';

const DUMP_SOURCES = [
  { name: 'edr_full', metaUrl: 'https://data.gov.ua/api/3/action/package_show?id=1c7f3815-3259-45e0-bdf1-64dca07ddc10', description: 'Повний реєстр юридичних осіб' },
  { name: 'fop_full', metaUrl: 'https://data.gov.ua/api/3/action/package_show?id=1bf8de09-1e0b-46ae-9ac7-4e1e25d1a7ce', description: 'Реєстр ФОП' },
];

async function fetchDirect(url: string): Promise<any> {
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; tender360-crawler/1.0)',
      'Accept': 'application/json',
    },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

export async function getLatestDumpUrl(metaUrl: string): Promise<string | null> {
  try {
    const json = await fetchDirect(metaUrl);
    const resources = json?.result?.resources ?? [];
    const resource = resources
      .filter((r: any) => /\.(zip|xml|csv)/i.test(r.url ?? ''))
      .sort((a: any, b: any) => new Date(b.last_modified ?? 0).getTime() - new Date(a.last_modified ?? 0).getTime())[0];
    return resource?.url ?? null;
  } catch (err: any) {
    console.error(`  ❌ Помилка: ${err.message}`);
    return null;
  }
}

async function downloadFile(url: string, dest: string): Promise<void> {
  console.log(`  ⬇️  Завантажую: ${url.slice(0, 70)}…`);
  return new Promise((resolve, reject) => {
    const file = createWriteStream(dest);
    const protocol = url.startsWith('https') ? require('https') : require('http');
    protocol.get(url, (res: any) => {
      if (res.statusCode === 302 || res.statusCode === 301) {
        file.close();
        downloadFile(res.headers.location!, dest).then(resolve).catch(reject);
        return;
      }
      res.pipe(file);
      file.on('finish', () => { file.close(); resolve(); });
    }).on('error', (err: any) => { fs.unlink(dest, () => {}); reject(err); });
  });
}

function extractTag(xml: string, tag: string): string {
  const m = xml.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i'));
  return m ? m[1].replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"').trim() : '';
}

function parseKved(kvedStr: string): EdrActivity[] {
  if (!kvedStr) return [];
  return kvedStr.split(/[,;]\s*/).map((k, i) => {
    const m = k.match(/^(\d{2}\.\d{1,2})\s+(.+)$/);
    if (!m) return null;
    return { code: m[1], name: m[2].trim(), isPrimary: i === 0 };
  }).filter(Boolean) as EdrActivity[];
}

function parseFounders(foundersStr: string): EdrFounder[] {
  if (!foundersStr) return [];
  return foundersStr.split(/[;|]\s*/).map(s => s.trim()).filter(s => s.length > 2).map(s => {
    const lines = s.split(/\n/).map(l => l.trim()).filter(Boolean);
    return { name: lines[0] ?? s, address: lines[1] };
  });
}

function parseStatus(stan: string): string {
  const s = (stan ?? '').toLowerCase();
  if (s.includes('припинен')) return 'припинено';
  if (s.includes('в стані')) return 'в стані припинення';
  if (s.includes('зареєстр')) return 'зареєстровано';
  return stan || 'невідомо';
}

function parseAddress(addr: string): { address: string; region?: string; locality?: string; postalCode?: string } {
  if (!addr) return { address: '' };
  const postalMatch = addr.match(/^(\d{5})/);
  const postalCode = postalMatch?.[1];
  const regionMatch = addr.match(/([А-ЯІЇЄ][а-яіїє]+ська|[А-ЯІЇЄ][а-яіїє]+ська|Київ|Харків)\s+(обл|область)/i);
  const localityMatch = addr.match(/м\.\s*([А-ЯІЇЄ][а-яіїє]+)/i);
  return { address: addr, postalCode, region: regionMatch?.[1], locality: localityMatch?.[1] };
}

export function parseSubjectXml(xml: string, sourceFile?: string): EdrRecord | null {
  const edrpou = extractTag(xml, 'EDRPOU').replace(/\D/g,'');
  if (!edrpou || edrpou.length < 6) return null;
  const name = extractTag(xml, 'NAME');
  if (!name) return null;
  const addrRaw = extractTag(xml, 'ADDRESS');
  const { address, region, locality, postalCode } = parseAddress(addrRaw);
  const boss = extractTag(xml, 'BOSS');
  const founders = parseFounders(extractTag(xml, 'FOUNDERS'));
  const kvedRaw = extractTag(xml, 'KVED');
  const activities = parseKved(kvedRaw);
  const stan = extractTag(xml, 'STAN');
  const phone = extractTag(xml, 'PHONE').replace(/[^\d+\s()\-]/g,'').trim();
  const email = extractTag(xml, 'EMAIL').toLowerCase().trim();
  const dateReg = extractTag(xml, 'DATE_REG') || extractTag(xml, 'DATEREGIS');
  const capital = parseFloat(extractTag(xml, 'CAPITAL').replace(/[^\d.]/g,'')) || undefined;
  const roles: EdrRole[] = [];
  if (boss) roles.push({ role: 'керівник', name: boss });
  const shortName = extractTag(xml, 'SHORT_NAME') || undefined;
  const legalFormMatch = name.match(/^(ТОВ|ПП|АТ|ПАТ|ПрАТ|ФОП|КП|ДП|ГО|БО)\s/i);
  return { edrpou, name: name.toUpperCase(), shortName, legalForm: legalFormMatch?.[1]?.toUpperCase(), address, region, locality, postalCode, status: parseStatus(stan), registrationDate: dateReg || undefined, phone: phone || undefined, email: email || undefined, activities, founders, beneficiaries: [], roles, capital, sourceFile, updatedAt: new Date().toISOString() };
}

export async function* streamParseXml(filePath: string, sourceFile: string): AsyncGenerator<EdrRecord> {
  const stream = createReadStream(filePath, { encoding: 'utf8', highWaterMark: 512 * 1024 });
  let buffer = '';
  let count = 0;
  for await (const chunk of stream) {
    buffer += chunk;
    let start: number;
    while ((start = buffer.indexOf('<SUBJECT>')) !== -1) {
      const end = buffer.indexOf('</SUBJECT>', start);
      if (end === -1) break;
      const block = buffer.slice(start, end + '</SUBJECT>'.length);
      buffer = buffer.slice(end + '</SUBJECT>'.length);
      const record = parseSubjectXml(block, sourceFile);
      if (record) { count++; yield record; }
    }
    if (buffer.length > 10 * 1024 * 1024) { buffer = ''; }
  }
  console.log(`  📊 Розпарсено: ${count} записів з ${path.basename(filePath)}`);
}

export async function extractZip(zipPath: string, destDir: string): Promise<string[]> {
  const AdmZip = (await import('adm-zip')).default;
  const zip = new AdmZip(zipPath);
  const entries = zip.getEntries().filter(e => !e.isDirectory && /\.(xml|csv)$/i.test(e.entryName));
  const files: string[] = [];
  for (const entry of entries) {
    const dest = path.join(destDir, path.basename(entry.entryName));
    zip.extractEntryTo(entry, destDir, false, true);
    files.push(dest);
    console.log(`  📦 Розпаковано: ${entry.entryName} (${(entry.header.size / 1024 / 1024).toFixed(1)} MB)`);
  }
  return files;
}

export { DUMP_SOURCES, downloadFile };
