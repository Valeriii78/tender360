// ─── ЄДР типи ────────────────────────────────────────────────

export interface EdrPerson {
  name: string;
  code?: string; // РНОКПП (якщо є)
  address?: string;
  country?: string;
}

export interface EdrFounder {
  name: string;
  code?: string;
  address?: string;
  country?: string;
  ownershipType?: string; // юр. або фіз. особа
  share?: number;         // розмір внеску (грн)
  sharePct?: number;      // % частки (якщо є)
}

export interface EdrBeneficiary {
  name: string;
  code?: string;
  address?: string;
  country?: string;
  ownershipType?: string;
  influenceType?: string; // прямий/непрямий вирішальний вплив
  sharePct?: number;
}

export interface EdrRole {
  role: string;           // керівник / підписант / бухгалтер
  name: string;
  restrictionDate?: string;
  restrictionReason?: string;
}

export interface EdrActivity {
  code: string;           // КВЕД
  name: string;
  isPrimary: boolean;
}

export interface EdrRecord {
  edrpou: string;
  name: string;
  shortName?: string;
  legalForm?: string;     // ТОВ, ПП, АТ…
  address?: string;
  region?: string;
  locality?: string;
  postalCode?: string;
  status: string;         // зареєстровано / припинено / в стані припинення
  registrationDate?: string;
  registrationNumber?: string;
  phone?: string;
  email?: string;
  website?: string;
  activities: EdrActivity[];
  founders: EdrFounder[];
  beneficiaries: EdrBeneficiary[];
  roles: EdrRole[];       // керівники, підписанти, бухгалтери
  capital?: number;       // статутний капітал (грн)
  taxStatus?: string;     // платник ПДВ / єдиний податок
  taxDebt?: boolean;
  sourceFile?: string;    // з якого дампу
  updatedAt: string;
}

// Рядок з CSV-дампу data.gov.ua (спрощений формат)
export interface EdrDumpRow {
  EDRPOU: string;
  NAME: string;
  SHORT_NAME?: string;
  ADDRESS?: string;
  KVED?: string;
  BOSS?: string;
  FOUNDERS?: string;
  STAN?: string;
  DATE_REG?: string;
  PHONE?: string;
  EMAIL?: string;
}
