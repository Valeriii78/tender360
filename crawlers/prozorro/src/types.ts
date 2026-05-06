export interface TenderListItem {
  id: string;
  dateModified: string;
}

export interface TenderListResponse {
  data: TenderListItem[];
  next_page: {
    offset: string;
    path: string;
    uri: string;
  };
}

export interface ContactPoint {
  name?: string;
  telephone?: string;
  email?: string;
  url?: string;
}

export interface Address {
  countryName?: string;
  postalCode?: string;
  region?: string;
  locality?: string;
  streetAddress?: string;
}

export interface Identifier {
  scheme?: string;
  id?: string;
  legalName?: string;
  uri?: string;
}

export interface Organization {
  name?: string;
  identifier?: Identifier;
  address?: Address;
  contactPoint?: ContactPoint;
  kind?: string;
}

export interface Value {
  amount?: number;
  currency?: string;
  valueAddedTaxIncluded?: boolean;
}

export interface Item {
  id?: string;
  description?: string;
  classification?: {
    scheme?: string;
    id?: string;
    description?: string;
  };
  quantity?: number;
  unit?: {
    name?: string;
    code?: string;
  };
}

export interface Bid {
  id?: string;
  status?: string;
  tenderers?: Organization[];
  value?: Value;
  date?: string;
}

export interface Award {
  id?: string;
  status?: string;
  suppliers?: Organization[];
  value?: Value;
  date?: string;
  bid_id?: string;
}

export interface Contract {
  id?: string;
  status?: string;
  value?: Value;
  dateSigned?: string;
}

export interface Tender {
  id: string;
  tenderID?: string;
  title?: string;
  description?: string;
  status?: string;
  procurementMethodType?: string;
  procurementMethod?: string;
  mainProcurementCategory?: string;
  value?: Value;
  procuringEntity?: Organization;
  items?: Item[];
  bids?: Bid[];
  awards?: Award[];
  contracts?: Contract[];
  dateCreated?: string;
  dateModified?: string;
  tenderPeriod?: {
    startDate?: string;
    endDate?: string;
  };
  awardCriteria?: string;
}

export interface TenderResponse {
  data: Tender;
}
