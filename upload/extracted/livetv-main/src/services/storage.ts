import { ApiCallLog, CreditTransaction, CustomerLine, PlanId, ServerConfig } from '../types/iptv';

const STORAGE_KEYS = {
  LINES: 'star_iptv_lines_v1',
  BALANCE: 'star_iptv_balance_centi_v1',
  TRANSACTIONS: 'star_iptv_transactions_v1',
  SERVERS: 'star_iptv_servers_v1',
  API_LOGS: 'star_iptv_api_logs_v1',
  SIMULATION_MODE: 'star_iptv_sim_mode_v1',
  CUSTOM_KEY: 'star_iptv_custom_key_v1'
};

const DEFAULT_SERVERS: ServerConfig[] = [];
const INITIAL_LINES: CustomerLine[] = [];
const INITIAL_TRANSACTIONS: CreditTransaction[] = [];

const LEGACY_DEMO_LINE_IDS = new Set([
  'line_xtr_101',
  'line_xtr_102',
  'line_ac_201',
  'line_mac_301',
  'line_xtr_103',
  'line_xtr_104'
]);
const LEGACY_DEMO_TRANSACTION_IDS = new Set([
  'ctx_init_seed_01',
  'ctx_init_seed_02',
  'ctx_init_seed_03',
  'ctx_init_seed_04'
]);
const LEGACY_DEMO_SERVER_IDS = new Set(['srv_primary_01', 'srv_us_backup']);

const hasLegacyRecords = (storageKey: string, ids: Set<string>): boolean => {
  try {
    const records: unknown = JSON.parse(localStorage.getItem(storageKey) || '[]');
    return Array.isArray(records) && records.some(
      (record) => record && typeof record.id === 'string' && ids.has(record.id)
    );
  } catch {
    return false;
  }
};

export class StorageService {
  static getLines(): CustomerLine[] {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.LINES);
      const lines: CustomerLine[] = data ? JSON.parse(data) : INITIAL_LINES;
      const cleanLines = lines.filter((line) => !LEGACY_DEMO_LINE_IDS.has(line.id));
      if (!data || cleanLines.length !== lines.length) {
        localStorage.setItem(STORAGE_KEYS.LINES, JSON.stringify(cleanLines));
      }
      if (cleanLines.length !== lines.length) {
        localStorage.setItem(STORAGE_KEYS.BALANCE, '0');
      }
      return cleanLines;
    } catch {
      return INITIAL_LINES;
    }
  }

  static saveLines(lines: CustomerLine[]): void {
    localStorage.setItem(STORAGE_KEYS.LINES, JSON.stringify(lines));
  }

  static getBalanceCenti(): number {
    try {
      if (
        hasLegacyRecords(STORAGE_KEYS.LINES, LEGACY_DEMO_LINE_IDS) ||
        hasLegacyRecords(STORAGE_KEYS.TRANSACTIONS, LEGACY_DEMO_TRANSACTION_IDS)
      ) {
        localStorage.setItem(STORAGE_KEYS.BALANCE, '0');
        return 0;
      }
      const val = localStorage.getItem(STORAGE_KEYS.BALANCE);
      if (val === null) {
        const initial = 0;
        localStorage.setItem(STORAGE_KEYS.BALANCE, String(initial));
        return initial;
      }
      return parseInt(val, 10) || 0;
    } catch {
      return 0;
    }
  }

  static setBalanceCenti(newBalanceCenti: number): void {
    localStorage.setItem(STORAGE_KEYS.BALANCE, String(newBalanceCenti));
  }

  static getTransactions(): CreditTransaction[] {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.TRANSACTIONS);
      const transactions: CreditTransaction[] = data ? JSON.parse(data) : INITIAL_TRANSACTIONS;
      const cleanTransactions = transactions.filter(
        (transaction) => !LEGACY_DEMO_TRANSACTION_IDS.has(transaction.id)
      );
      if (!data || cleanTransactions.length !== transactions.length) {
        localStorage.setItem(STORAGE_KEYS.TRANSACTIONS, JSON.stringify(cleanTransactions));
      }
      return cleanTransactions;
    } catch {
      return INITIAL_TRANSACTIONS;
    }
  }

  static addTransaction(tx: Omit<CreditTransaction, 'id' | 'createdAt'>): CreditTransaction {
    const transactions = this.getTransactions();
    const newTx: CreditTransaction = {
      ...tx,
      id: `ctx_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      createdAt: new Date().toISOString()
    };
    transactions.unshift(newTx);
    localStorage.setItem(STORAGE_KEYS.TRANSACTIONS, JSON.stringify(transactions));
    this.setBalanceCenti(tx.newBalanceCenti);
    return newTx;
  }

  static getServers(): ServerConfig[] {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.SERVERS);
      const servers: ServerConfig[] = data ? JSON.parse(data) : DEFAULT_SERVERS;
      const cleanServers = servers.filter((server) => !LEGACY_DEMO_SERVER_IDS.has(server.id));
      if (!data || cleanServers.length !== servers.length) {
        localStorage.setItem(STORAGE_KEYS.SERVERS, JSON.stringify(cleanServers));
      }
      return cleanServers;
    } catch {
      return DEFAULT_SERVERS;
    }
  }

  static saveServers(servers: ServerConfig[]): void {
    localStorage.setItem(STORAGE_KEYS.SERVERS, JSON.stringify(servers));
  }

  static getApiLogs(): ApiCallLog[] {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.API_LOGS);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  }

  static addApiLog(log: ApiCallLog): void {
    try {
      const logs = this.getApiLogs();
      logs.unshift(log);
      if (logs.length > 100) logs.pop();
      localStorage.setItem(STORAGE_KEYS.API_LOGS, JSON.stringify(logs));
    } catch (e) {
      console.error('Failed to save log', e);
    }
  }

  static clearApiLogs(): void {
    localStorage.removeItem(STORAGE_KEYS.API_LOGS);
  }

  static isSimulationMode(): boolean {
    return localStorage.getItem(STORAGE_KEYS.SIMULATION_MODE) === 'true';
  }

  static setSimulationMode(enabled: boolean): void {
    localStorage.setItem(STORAGE_KEYS.SIMULATION_MODE, String(enabled));
  }

  static clearCustomApiKey(): void {
    localStorage.removeItem(STORAGE_KEYS.CUSTOM_KEY);
  }

  // Calculate local expiration date based on plan & existing date
  static calculateExpiryDate(plan: PlanId, currentExpiryDate?: string): string {
    const now = new Date();
    let baseDate = now;

    if (currentExpiryDate) {
      const parsed = new Date(currentExpiryDate);
      if (!isNaN(parsed.getTime()) && parsed > now) {
        baseDate = parsed;
      }
    }

    if (plan === 11) {
      // 24 Hour trial
      const trialExp = new Date(now.getTime() + 24 * 60 * 60 * 1000);
      return trialExp.toISOString().split('T')[0];
    }

    const monthsToAdd = plan === 1 ? 1 : plan === 2 ? 3 : plan === 3 ? 6 : plan === 4 ? 12 : 1;
    const exp = new Date(baseDate.getTime());
    exp.setMonth(exp.getMonth() + monthsToAdd);

    return exp.toISOString().split('T')[0];
  }
}
