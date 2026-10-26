import { ApiCallLog, ProviderCreditLog, ProviderInfo } from '../types/iptv';
import { adminFetch } from './adminAuth';

export interface ProviderCallResult<T = any> {
  success: boolean;
  source: 'live_provider' | 'sandbox_simulation';
  data?: T;
  rawResponse?: string;
  error?: string;
  durationMs: number;
  cUrlPost: string;
  cUrlGet: string;
}

// Provider credentials belong in server-side secrets and must not be copied into generated commands.
export function generateCurlCommands(
  _type: string,
  _params: Record<string, any>
): { post: string; get: string } {
  const unavailable = 'Disabled: provider calls are available only through a configured server-side integration.';
  return { post: unavailable, get: unavailable };
}

// Call the proxy server
export async function executeProviderCall<T = any>(
  type: string,
  params: Record<string, any> = {},
  options: {
    simulateFallback?: boolean;
    onLog?: (log: ApiCallLog) => void;
  } = {}
): Promise<ProviderCallResult<T>> {
  const startTime = Date.now();
  const curls = generateCurlCommands(type, params);

  try {
    const response = await adminFetch('/api/provider/call', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        type,
        simulateFallback: options.simulateFallback,
        ...params
      })
    });

    const durationMs = Date.now() - startTime;
    const result = await response.json();

    const success = result.success !== false;
    const source = result.source || (options.simulateFallback ? 'sandbox_simulation' : 'live_provider');

    if (options.onLog) {
      options.onLog({
        id: `call_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        timestamp: new Date().toISOString(),
        operation: type,
        method: 'POST',
        endpoint: '/api/provider/call',
        status: success ? 'SUCCESS' : 'ERROR',
        durationMs,
        maskedPayload: { type, ...params, apikey: '••••••••' },
        response: result.data || result.rawResponse || result.error,
        source
      });
    }

    return {
      success,
      source,
      data: result.data,
      rawResponse: result.rawResponse,
      error: result.error,
      durationMs,
      cUrlPost: curls.post,
      cUrlGet: curls.get
    };
  } catch (err: any) {
    const durationMs = Date.now() - startTime;
    const errorMsg = err.message || 'Client fetch error';

    if (options.onLog) {
      options.onLog({
        id: `call_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        timestamp: new Date().toISOString(),
        operation: type,
        method: 'POST',
        endpoint: '/api/provider/call',
        status: 'NETWORK_ERROR',
        durationMs,
        maskedPayload: { type, ...params, apikey: '••••••••' },
        response: { error: errorMsg },
        source: 'live_provider'
      });
    }

    return {
      success: false,
      source: 'live_provider',
      error: errorMsg,
      durationMs,
      cUrlPost: curls.post,
      cUrlGet: curls.get
    };
  }
}

// Fetch provider account status
export async function fetchProviderInfo(simulate = false): Promise<ProviderCallResult<ProviderInfo>> {
  return executeProviderCall<ProviderInfo>('infoapi', {}, { simulateFallback: simulate });
}

// Fetch provider credit history
export async function fetchProviderCreditLogs(simulate = false): Promise<ProviderCallResult<ProviderCreditLog[]>> {
  return executeProviderCall<ProviderCreditLog[]>('credit_logs', {}, { simulateFallback: simulate });
}
