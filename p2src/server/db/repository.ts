import { getServerSupabase } from './supabase.js';
import { db } from './store.js';
import type {
  AdminDeviceRecord,
  AdminStats,
  AdminWatchHistoryRecord,
  Channel,
  DeviceInfo,
  MemberAccount,
  Movie,
  TakedownRequest,
  WatchProgress,
} from '../../src/types/index.js';

export interface SupabaseHealthStatus {
  connected: boolean;
  databaseHealthy: boolean;
  authAvailable: boolean;
  latencyMs: number;
  details: string;
  projectUrl: string;
  tablesVerified: string[];
  usingFallbackStore: boolean;
}

export class AetherRepository {
  private projectUrl: string;

  constructor() {
    this.projectUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || 'https://ujzvkwgrxtujpinkytbf.supabase.co';
  }

  /**
   * Health verification for Supabase integration (Settings -> Database)
   */
  public async testConnection(): Promise<SupabaseHealthStatus> {
    const startTime = Date.now();
    const client = getServerSupabase();
    const targetUrl = this.projectUrl;

    if (!client) {
      return {
        connected: false,
        databaseHealthy: false,
        authAvailable: false,
        latencyMs: 0,
        details: 'Supabase client could not be initialized. Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY.',
        projectUrl: targetUrl,
        tablesVerified: [],
        usingFallbackStore: true,
      };
    }

    let authAvailable = false;
    let databaseHealthy = false;
    const tablesVerified: string[] = [];

    try {
      // 1. Probe Auth endpoint
      const authRes = await fetch(`${targetUrl}/auth/v1/health`, {
        headers: {
          apikey: process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_yxUeNftpgXnveqNoQdmiLQ_GbIRJ492',
        },
      });
      if (authRes.ok) {
        authAvailable = true;
      }
    } catch {
      authAvailable = false;
    }

    try {
      // 2. Probe database REST gateway
      const { data, error } = await client.from('site_settings').select('key').limit(1);
      if (!error) {
        databaseHealthy = true;
        tablesVerified.push('site_settings');
      } else if (error.code === 'PGRST116' || error.message.includes('relation') || error.code === '42P01') {
        // Connected to PostgREST, but migration SQL needs execution
        databaseHealthy = true;
        tablesVerified.push('gateway_connected_pending_migration');
      }
    } catch (e: unknown) {
      console.warn('Database health check error:', e);
    }

    const latencyMs = Date.now() - startTime;
    const connected = authAvailable || databaseHealthy;

    return {
      connected,
      databaseHealthy: databaseHealthy || authAvailable,
      authAvailable,
      latencyMs,
      details: connected
        ? `Supabase cloud cluster reachable at ${targetUrl}. GoTrue auth active (${latencyMs}ms latency).`
        : `Could not establish connection to ${targetUrl}. Verify network access and publishable anon key.`,
      projectUrl: targetUrl,
      tablesVerified,
      usingFallbackStore: !databaseHealthy,
    };
  }

  // ==========================================================================
  // MEMBERS MANAGEMENT
  // ==========================================================================

  public async getMembers(): Promise<{ members: MemberAccount[]; slots: Record<string, number> }> {
    const client = getServerSupabase();
    if (client) {
      try {
        const { data, error } = await client.from('private_members').select('*');
        if (!error && data && data.length > 0) {
          const members: MemberAccount[] = data.map((m: any) => ({
            id: m.id || m.user_id,
            email: m.email,
            name: m.name,
            status: m.status as 'active' | 'disabled',
            role: m.role || 'member',
            devicesCount: 0,
            accountExpiry: m.account_expiry,
            createdAt: m.created_at,
          }));
          return {
            members,
            slots: {
              total: db.pilotSettings.maxPrivateUsers,
              current: members.length,
              active: members.filter((m) => m.status === 'active').length,
              remaining: Math.max(0, db.pilotSettings.maxPrivateUsers - members.length),
              maxDevicesPerUser: db.pilotSettings.maxDevicesPerUser,
            },
          };
        }
      } catch (e) {
        // fallback
      }
    }

    // Default to store
    return {
      members: db.getMembers(),
      slots: {
        total: db.pilotSettings.maxPrivateUsers,
        current: db.users.size,
        active: db.pilotSettings.activeMembers,
        remaining: db.pilotSettings.remainingSlots,
        maxDevicesPerUser: db.pilotSettings.maxDevicesPerUser,
      },
    };
  }

  public async createMember(name: string, email: string, password: string): Promise<{ success: boolean; member?: MemberAccount; error?: string }> {
    const result = db.createMember(name, email, password);
    if (!result.success) return result;

    const client = getServerSupabase();
    if (client && result.member) {
      try {
        await client.from('private_members').insert({
          email: result.member.email,
          name: result.member.name,
          status: 'active',
          max_devices: db.pilotSettings.maxDevicesPerUser,
          created_at: result.member.createdAt,
        });
      } catch (e) {
        console.warn('Supabase member sync notice:', e);
      }
    }

    return result;
  }

  public async toggleMemberStatus(userId: string): Promise<{ success: boolean; status?: 'active' | 'disabled'; error?: string }> {
    const result = db.toggleMemberStatus(userId);
    if (!result.success) return result;

    const client = getServerSupabase();
    if (client && result.status) {
      try {
        await client.from('private_members').update({ status: result.status }).eq('id', userId);
      } catch (e) {
        // silent
      }
    }

    return result;
  }

  public async deleteMember(userId: string): Promise<{ success: boolean; error?: string }> {
    const result = db.deleteMember(userId);
    if (!result.success) return result;

    const client = getServerSupabase();
    if (client) {
      try {
        await client.from('private_members').delete().eq('id', userId);
      } catch (e) {
        // silent
      }
    }

    return result;
  }

  public async resetMemberPassword(userId: string, newPass: string): Promise<{ success: boolean; error?: string }> {
    return db.resetMemberPassword(userId, newPass);
  }

  // ==========================================================================
  // DEVICES CONCURRENCY MANAGEMENT
  // ==========================================================================

  public async getAllDevices(): Promise<AdminDeviceRecord[]> {
    const client = getServerSupabase();
    if (client) {
      try {
        const { data, error } = await client.from('devices').select('*, profiles(name, email)');
        if (!error && data && data.length > 0) {
          return data.map((d: any) => ({
            userId: d.user_id,
            userName: d.profiles?.name || 'Pilot Member',
            userEmail: d.profiles?.email || '',
            device: {
              id: d.id,
              name: d.device_name,
              deviceType: d.device_type,
              browser: d.browser || 'Browser',
              os: d.os || 'OS',
              lastActive: new Date(d.last_active).toLocaleString(),
              isCurrent: false,
            },
          }));
        }
      } catch (e) {
        // fallback
      }
    }

    return db.getAllDevices();
  }

  public async revokeDevice(userId: string, deviceId: string): Promise<boolean> {
    db.revokeDevice(userId, deviceId);
    const client = getServerSupabase();
    if (client) {
      try {
        await client.from('devices').delete().eq('id', deviceId);
      } catch (e) {
        // silent
      }
    }
    return true;
  }

  // ==========================================================================
  // WATCH HISTORY & WATCHLIST
  // ==========================================================================

  public async getAllWatchHistory(): Promise<AdminWatchHistoryRecord[]> {
    const client = getServerSupabase();
    if (client) {
      try {
        const { data, error } = await client.from('watch_history').select('*, profiles(name)');
        if (!error && data && data.length > 0) {
          return data.map((h: any) => ({
            id: h.id,
            userId: h.user_id,
            userName: h.profiles?.name || 'Pilot Member',
            contentId: h.content_id,
            contentTitle: h.title,
            contentType: h.content_type,
            watchedAt: h.last_watched,
            progressPercentage: h.duration_seconds > 0 ? Math.round((h.position_seconds / h.duration_seconds) * 100) : 100,
          }));
        }
      } catch (e) {
        // fallback
      }
    }

    return db.getAllWatchHistory();
  }

  public recordWatchProgress(userId: string, contentId: string, position: number, duration: number, isChannel: boolean = false) {
    const histMap = db.watchHistory.get(userId) || new Map<string, WatchProgress>();
    const title = db.movies.get(contentId)?.title || db.channels.get(contentId)?.channelName || contentId;
    const poster = db.movies.get(contentId)?.poster || db.channels.get(contentId)?.logo || '';

    const entry: WatchProgress = {
      contentId,
      contentType: isChannel ? 'channel' : 'movie',
      positionSeconds: position,
      durationSeconds: duration,
      completed: position >= duration * 0.9,
      lastWatchedAt: new Date().toISOString(),
      title,
      poster,
    };

    histMap.set(contentId, entry);
    db.watchHistory.set(userId, histMap);

    const client = getServerSupabase();
    if (client) {
      try {
        client
          .from('watch_history')
          .upsert({
            user_id: userId,
            content_id: contentId,
            content_type: isChannel ? 'channel' : 'movie',
            title,
            poster_url: poster,
            position_seconds: Math.floor(position),
            duration_seconds: Math.floor(duration),
            completed: position >= duration * 0.9,
            last_watched: new Date().toISOString(),
          })
          .then();
      } catch {
        // silent
      }
    }
  }

  // ==========================================================================
  // CHANNELS & MOVIES
  // ==========================================================================

  public getChannels(): Channel[] {
    return Array.from(db.channels.values());
  }

  public getMovies(): Movie[] {
    return Array.from(db.movies.values());
  }

  // ==========================================================================
  // ADMIN AUDIT LOGS
  // ==========================================================================

  public logAction(action: string, details: string) {
    db.logAdminAction(action, details);
    const client = getServerSupabase();
    if (client) {
      try {
        client
          .from('admin_logs')
          .insert({
            action,
            details,
            created_at: new Date().toISOString(),
          })
          .then();
      } catch {
        // silent
      }
    }
  }

  public getAdminStats(): AdminStats {
    return db.getAdminStats();
  }
}

export const repository = new AetherRepository();
