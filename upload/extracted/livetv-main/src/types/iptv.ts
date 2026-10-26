export type LineType = 'XTREAM' | 'ACTIVECODE' | 'MAC';

export type Role =
  | 'SUPER_ADMIN'
  | 'ADMIN'
  | 'MASTER_RESELLER'
  | 'RESELLER'
  | 'SUB_RESELLER'
  | 'SUPPORT'
  | 'ACCOUNTANT';

export type Permission =
  | 'line:create'
  | 'line:renew'
  | 'credits:read:own'
  | 'credits:read:all'
  | 'credits:adjust'
  | 'orders:reconcile'
  | 'provider:read'
  | 'audit:read'
  | 'users:manage';

export interface AuditLog {
  id: string;
  actorId: string;
  actorRole: Role;
  action: string;
  targetType: string;
  targetId: string;
  ip: string;
  timestamp: string;
  metadata?: any;
}

export type PlanId = 11 | 1 | 2 | 3 | 4;

export interface PlanDefinition {
  id: PlanId;
  name: string;
  durationLabel: string;
  durationMonths: number;
  durationHours?: number;
  baseCredits: number;
  isTrial: boolean;
  description: string;
}

export const PLANS: Record<PlanId, PlanDefinition> = {
  11: {
    id: 11,
    name: '24-Hour Free Trial',
    durationLabel: '24 Hours',
    durationMonths: 0,
    durationHours: 24,
    baseCredits: 0,
    isTrial: true,
    description: 'Instant 24-hour test line without credit consumption (subject to trial allowance).'
  },
  1: {
    id: 1,
    name: '1 Month Subscription',
    durationLabel: '1 Month',
    durationMonths: 1,
    baseCredits: 1,
    isTrial: false,
    description: 'Standard 30-day single or multi-screen access.'
  },
  2: {
    id: 2,
    name: '3 Months Subscription',
    durationLabel: '3 Months',
    durationMonths: 3,
    baseCredits: 3,
    isTrial: false,
    description: 'Quarterly subscription plan.'
  },
  3: {
    id: 3,
    name: '6 Months Subscription',
    durationLabel: '6 Months',
    durationMonths: 6,
    baseCredits: 5,
    isTrial: false,
    description: 'Bi-annual discount tier (5 credits).'
  },
  4: {
    id: 4,
    name: '12 Months Subscription',
    durationLabel: '12 Months',
    durationMonths: 12,
    baseCredits: 10,
    isTrial: false,
    description: 'Full year annual subscription tier (10 credits).'
  }
};

export interface BouquetDefinition {
  bid: string;
  name: string;
  description: string;
  category: 'Worldwide' | 'Asian' | 'Custom';
  hasAdult: boolean;
}

export const BOUQUETS: BouquetDefinition[] = [
  {
    bid: '[5,11]',
    name: 'Full Worldwide (Family / No Adult)',
    description: 'Live TV Channels + Movies + Series (Family safe)',
    category: 'Worldwide',
    hasAdult: false
  },
  {
    bid: '[4,7]',
    name: 'Full Worldwide (Includes Adult 18+)',
    description: 'Live TV Channels + Movies + Series + Adult package',
    category: 'Worldwide',
    hasAdult: true
  },
  {
    bid: '[1232,1234]',
    name: 'Mini Asian Package (Family)',
    description: 'Asian regional live channels and cinema without adult',
    category: 'Asian',
    hasAdult: false
  },
  {
    bid: '[1233,1235]',
    name: 'Mini Asian Package (Includes Adult)',
    description: 'Asian regional live channels, cinema with adult channels',
    category: 'Asian',
    hasAdult: true
  }
];

export interface CustomerLine {
  id: string;
  name: string;
  lineType: LineType;
  providerUsername: string; // Xtream username, ActiveCode numeric string, or MAC address
  providerPassword?: string; // Xtream password
  serverId: string;
  plan: PlanId;
  bid: string;
  connections: number; // 1 to 4
  status: 'ACTIVE' | 'EXPIRED' | 'TRIAL' | 'SUSPENDED';
  startDate: string;
  expiryDate: string;
  expirySource: 'LOCAL_DERIVED' | 'MANUAL';
  creditCost: number;
  addch: number;
  addvods: number;
  adults: number;
  notice: string;
  notes?: string;
  suspendedLocally: boolean;
  createdAt: string;
  lastRenewedAt?: string;
  callbackUrl?: string; // base64 encoded for ActiveCode
}

export interface CreditTransaction {
  id: string;
  type: 'LINE_CREATION' | 'RENEWAL' | 'ADMIN_ADJUSTMENT' | 'REFUND' | 'CREDIT_PURCHASE';
  amountCenti: number; // signed integer (-500 = -5.00 credits)
  previousBalanceCenti: number;
  newBalanceCenti: number;
  reference: string;
  createdAt: string;
  idempotencyKey?: string;
}

export interface ProviderInfo {
  allow_trial: string;
  used_trial: string;
  user_credit: string;
  api_username: string;
  is_monthly: string;
  monthly_max_lines: string;
  api_status: string;
  whatsapp_otp?: string;
  whatsapp_bot?: string;
  next_renewal: string;
  total_paid_lines: string;
}

export interface ProviderCreditLog {
  log_id: string;
  api_username: string;
  info: string;
  date: string;
  credits_charge: string;
  credits_left: string;
}

export interface ServerConfig {
  id: string;
  name: string;
  hostUrl: string; // e.g. http://stream.star-network.org:8080
  playerUrl?: string; // e.g. http://stream.star-network.org:8080/app.php
  isDefault: boolean;
}

export interface ApiCallLog {
  id: string;
  timestamp: string;
  operation: string;
  method: 'POST' | 'GET';
  endpoint: string;
  status: 'SUCCESS' | 'ERROR' | 'NETWORK_ERROR';
  durationMs: number;
  maskedPayload: Record<string, any>;
  response: any;
  source: 'live_provider' | 'sandbox_simulation';
}
