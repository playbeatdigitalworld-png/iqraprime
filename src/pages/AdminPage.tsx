import React, { useState, useEffect } from 'react';
import {
  Users,
  Radio,
  Film,
  Clapperboard,
  Layers,
  ShieldAlert,
  Server,
  Activity,
  CheckCircle2,
  AlertTriangle,
  Settings,
  Plus,
  RefreshCw,
  Lock,
  Eye,
  EyeOff,
  UserCheck,
  UserX,
  Trash2,
  KeyRound,
  Download,
  ListFilter,
  CheckSquare,
  Square,
  Smartphone,
  Info,
  History,
  Clock,
  Laptop,
  Tv,
  SlidersHorizontal,
  Menu,
  X,
  Bell,
  Search,
  LayoutDashboard,
  ScrollText,
  TrendingUp,
  ShieldCheck,
  Zap,
} from 'lucide-react';
import { api } from '../services/api.js';
import { AdminCreatorHub } from './admin/AdminCreatorHub.js';
import { useToast } from '../context/ToastContext.js';
import { useAuth } from '../context/AuthContext.js';
import type {
  AdminDeviceRecord,
  AdminStats,
  AdminWatchHistoryRecord,
  CatalogStatsInfo,
  Channel,
  IPTVLiveCategory,
  M3UChannel,
  MemberAccount,
  MemberIptvLineMasked,
  Movie,
  StarIPTVLog,
  TakedownRequest,
} from '../types/index.js';

interface AdminPageProps {
  onNavigate: (tab: string) => void;
}

export const AdminPage: React.FC<AdminPageProps> = ({ onNavigate }) => {
  const { showToast } = useToast();
  const { user: adminUser } = useAuth();
  const [activeTab, setActiveTab] = useState<
    'overview' | 'members' | 'iptv' | 'm3u' | 'epg' | 'devices' | 'history' | 'settings' | 'cinema' | 'logs' | 'creatorhub'
  >('overview');

  // Live Categories from Xtream / Star IPTV
  const [iptvCategories, setIptvCategories] = useState<IPTVLiveCategory[]>([]);
  const [isLoadingCategories, setIsLoadingCategories] = useState(false);
  const [importingCatId, setImportingCatId] = useState<string | null>(null);

  const [stats, setStats] = useState<AdminStats | null>(null);
  const [channels, setChannels] = useState<Channel[]>([]);
  const [movies, setMovies] = useState<Movie[]>([]);
  const [takedowns, setTakedowns] = useState<TakedownRequest[]>([]);
  const [adminLogs, setAdminLogs] = useState<Array<{ id: string; timestamp: string; action: string; details: string }>>([]);

  // Member Management State
  const [members, setMembers] = useState<MemberAccount[]>([]);
  const [slots, setSlots] = useState<{ total: number; current: number; active: number; remaining: number; maxDevicesPerUser: number }>({
    total: 5,
    current: 3,
    active: 3,
    remaining: 2,
    maxDevicesPerUser: 2,
  });
  const [showAddMember, setShowAddMember] = useState(false);
  const [newMemberName, setNewMemberName] = useState('');
  const [newMemberEmail, setNewMemberEmail] = useState('');
  const [newMemberPassword, setNewMemberPassword] = useState('');
  const [resetPasswordMember, setResetPasswordMember] = useState<MemberAccount | null>(null);
  const [newResetPassword, setNewResetPassword] = useState('');

  // Per-member Star IPTV line state (credentials stay server-side)
  const [iptvLineMap, setIptvLineMap] = useState<Record<string, MemberIptvLineMasked>>({});
  const [lineModalMember, setLineModalMember] = useState<MemberAccount | null>(null);
  const [lineForm, setLineForm] = useState<{ serverUrl: string; username: string; password: string; m3uUrl: string; epgUrl: string; providerName: string; status: 'active' | 'disabled' }>({
    serverUrl: '', username: '', password: '', m3uUrl: '', epgUrl: '', providerName: '', status: 'active',
  });
  const [lineSaving, setLineSaving] = useState(false);
  const [lineProbeResult, setLineProbeResult] = useState<{ ok: boolean; message: string; expiresAt?: string; maxConnections?: number } | null>(null);
  const [showLinePassword, setShowLinePassword] = useState(false);

  // Device & Watch History Admin State
  const [devicesList, setDevicesList] = useState<AdminDeviceRecord[]>([]);
  const [watchHistoryList, setWatchHistoryList] = useState<AdminWatchHistoryRecord[]>([]);

  // Pilot Global Settings State
  const [maxPrivateUsers, setMaxPrivateUsers] = useState<number>(5);
  const [maxDevicesPerUser, setMaxDevicesPerUser] = useState<number>(2);
  const [privateMode, setPrivateMode] = useState<boolean>(true);

  // Star IPTV Config Form State
  const [providerName, setProviderName] = useState('Star IPTV Authorized Reseller');
  const [serverUrl, setServerUrl] = useState('');
  const [iptvUsername, setIptvUsername] = useState('');
  const [iptvPassword, setIptvPassword] = useState('');
  const [m3uUrl, setM3uUrl] = useState('');
  const [epgUrl, setEpgUrl] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [iptvLogs, setIptvLogs] = useState<StarIPTVLog[]>([]);

  // Test states
  const [isTestingServer, setIsTestingServer] = useState(false);
  const [isTestingM3u, setIsTestingM3u] = useState(false);
  const [isTestingEpg, setIsTestingEpg] = useState(false);
  const [testResult, setTestResult] = useState<{ status: string; statusCode?: number; latencyMs?: number; message: string; timestamp: string } | null>(null);
  const [m3uTestResult, setM3uTestResult] = useState<{ status: string; valid: boolean; channelCount?: number; latencyMs?: number; message: string } | null>(null);
  const [epgTestResult, setEpgTestResult] = useState<{ status: string; valid: boolean; latencyMs?: number; message: string } | null>(null);

  // M3U Channel Importer State
  const [m3uChannels, setM3uChannels] = useState<M3UChannel[]>([]);
  const [isImportingM3u, setIsImportingM3u] = useState(false);
  const [m3uSearch, setM3uSearch] = useState('');
  const [m3uSelectedGroup, setM3uSelectedGroup] = useState('All');

  // New Channel Modal
  const [showAddChannel, setShowAddChannel] = useState(false);
  const [newChanName, setNewChanName] = useState('');
  const [newChanStream, setNewChanStream] = useState('');
  const [newChanCategory, setNewChanCategory] = useState<'News' | 'Sports' | 'Science & Tech' | 'Culture'>('News');
  const [newChanSource, setNewChanSource] = useState('Official Public Stream');
  const [newChanRights, setNewChanRights] = useState<'PUBLIC_BROADCAST' | 'FREE_TO_AIR' | 'PUBLIC_DOMAIN'>('PUBLIC_BROADCAST');

  const loadAllAdminData = async () => {
    try {
      const [statsRes, chRes, movRes, tkRes, iptvRes, memRes, pilotRes, m3uRes, devRes, histRes, linesRes] = await Promise.all([
        api.getAdminStats(),
        api.getAdminChannels(),
        api.getAdminMovies(),
        api.getTakedowns(),
        api.getStarIPTVConfig(),
        api.getMembers().catch(() => ({ members: [], slots: { total: 5, current: 3, active: 3, remaining: 2, maxDevicesPerUser: 2 } })),
        api.getPilotSettings().catch(() => ({ settings: { privateMode: true, commercialMode: false, publicRegistration: false, paymentsEnabled: false, maxPrivateUsers: 5, maxDevicesPerUser: 2, currentMembers: 3, activeMembers: 3, remainingSlots: 2 } })),
        api.getM3UChannels().catch(() => ({ channels: [], total: 0 })),
        api.getAdminDevices().catch(() => ({ devices: [], total: 0 })),
        api.getAdminWatchHistory().catch(() => ({ history: [], total: 0 })),
        api.getAllIptvLines().catch(() => ({ lines: [] })),
      ]);

      setStats(statsRes.stats);
      setAdminLogs(statsRes.logs);
      setChannels(chRes);
      setMovies(movRes);
      setTakedowns(tkRes);

      // Star IPTV Vault config
      setProviderName(iptvRes.config.providerName || 'Star IPTV Authorized Reseller');
      setServerUrl(iptvRes.config.serverUrl || '');
      setIptvUsername(iptvRes.config.username || '');
      if ((iptvRes.config as any).m3uUrl) setM3uUrl((iptvRes.config as any).m3uUrl);
      if ((iptvRes.config as any).epgUrl) setEpgUrl((iptvRes.config as any).epgUrl);
      setIptvLogs(iptvRes.logs || []);

      // Members & Slots
      setMembers(memRes.members || []);
      setSlots(memRes.slots);

      // Per-member Star IPTV lines (masked summaries only)
      const lineMap: Record<string, MemberIptvLineMasked> = {};
      (linesRes.lines || []).forEach((l) => { lineMap[l.userId] = l; });
      setIptvLineMap(lineMap);

      // Pilot settings
      setMaxPrivateUsers(pilotRes.settings.maxPrivateUsers);
      setMaxDevicesPerUser(pilotRes.settings.maxDevicesPerUser);
      setPrivateMode(pilotRes.settings.privateMode);

      // M3U Channels, Devices & History
      setM3uChannels(m3uRes.channels || []);
      setDevicesList(devRes.devices || []);
      setWatchHistoryList(histRes.history || []);

      // Fetch live categories in background
      api.getIPTVCategories()
        .then((catRes) => setIptvCategories(catRes.categories || []))
        .catch(() => {});
    } catch {
      showToast('Loaded administrative state', 'info');
    }
  };

  const handleRevokeDevice = async (userId: string, deviceId: string) => {
    if (!confirm('Revoke this device from the private pilot member account?')) return;
    try {
      await api.revokeAdminDevice(userId, deviceId);
      setDevicesList((prev) => prev.filter((d) => !(d.userId === userId && d.device.id === deviceId)));
      showToast('Device revoked successfully', 'info');
    } catch {
      showToast('Failed to revoke device', 'error');
    }
  };

  useEffect(() => {
    loadAllAdminData();
  }, []);

  // Per-member Star IPTV line handlers
  const openLineModal = async (member: MemberAccount) => {
    setLineModalMember(member);
    setLineProbeResult(null);
    setLineForm({ serverUrl: '', username: '', password: '', m3uUrl: '', epgUrl: '', providerName: '', status: 'active' });
    try {
      const res = await api.getMemberIptvLine(member.id);
      if (res.line?.assigned) {
        setLineForm((f) => ({
          ...f,
          serverUrl: res.line.serverHost ? `http://${res.line.serverHost}` : '',
          providerName: res.line.providerName || '',
          status: res.line.status || 'active',
        }));
        setLineProbeResult({
          ok: true,
          message: `Assigned line ${res.line.usernameMasked} — status ${res.line.status || 'active'}${res.line.expiresAt ? `, expires ${String(res.line.expiresAt).slice(0, 10)}` : ''}${res.line.maxConnections ? `, max connections ${res.line.maxConnections}` : ''}`,
        });
      }
    } catch {
      // modal stays in blank state
    }
  };

  const handleAssignLine = async () => {
    if (!lineModalMember) return;
    if (!lineForm.serverUrl || !lineForm.username || !lineForm.password) {
      showToast('Server URL, line username, and line password are required.', 'error');
      return;
    }
    setLineSaving(true);
    try {
      const res = await api.assignMemberIptvLine(lineModalMember.id, {
        serverUrl: lineForm.serverUrl.trim(),
        username: lineForm.username.trim(),
        password: lineForm.password,
        m3uUrl: lineForm.m3uUrl.trim() || undefined,
        epgUrl: lineForm.epgUrl.trim() || undefined,
        providerName: lineForm.providerName.trim() || undefined,
        status: lineForm.status,
      });
      setLineProbeResult({
        ok: true,
        message: res.probe?.message || 'Line saved.',
        expiresAt: res.probe?.expiresAt,
        maxConnections: res.probe?.maxConnections,
      });
      setIptvLineMap((prev) => ({ ...prev, [lineModalMember.id]: res.line }));
      setLineForm((f) => ({ ...f, password: '' })); // clear secret from react state
      showToast(res.message, 'success');
    } catch (err: any) {
      setLineProbeResult({ ok: false, message: err.message || 'Failed to assign Star IPTV line' });
      showToast(err.message || 'Failed to assign Star IPTV line', 'error');
    } finally {
      setLineSaving(false);
    }
  };

  const handleClearLine = async () => {
    if (!lineModalMember) return;
    if (!confirm('Unassign the Star IPTV line from this member?')) return;
    try {
      await api.clearMemberIptvLine(lineModalMember.id);
      setIptvLineMap((prev) => {
        const next = { ...prev };
        delete next[lineModalMember.id];
        return next;
      });
      showToast('Star IPTV line unassigned', 'info');
      setLineModalMember(null);
    } catch (err: any) {
      showToast(err.message || 'Failed to unassign line', 'error');
    }
  };

  // Star IPTV Handlers
  const handleSaveIPTVConfig = async () => {
    try {
      await api.updateStarIPTVConfig({
        providerName,
        serverUrl,
        username: iptvUsername,
        password: iptvPassword || undefined,
        m3uUrl: m3uUrl || undefined,
        epgUrl: epgUrl || undefined,
      });
      showToast('Star IPTV credentials secured in backend memory', 'success');
      setIptvPassword(''); // Clear plain password from react state after saving
      const conf = await api.getStarIPTVConfig();
      setIptvLogs(conf.logs);
    } catch {
      showToast('Failed to save Star IPTV configuration', 'error');
    }
  };

  const handleTestConnection = async () => {
    setIsTestingServer(true);
    setTestResult(null);
    try {
      const res = await api.testStarIPTVConnection();
      setTestResult(res);
      if (res.status === 'Connected') {
        showToast('Server connection test successful', 'success');
      } else {
        showToast(`Server test: ${res.status}`, 'info');
      }
      const conf = await api.getStarIPTVConfig();
      setIptvLogs(conf.logs);
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : 'Server test failed', 'error');
    } finally {
      setIsTestingServer(false);
    }
  };

  const handleTestM3U = async () => {
    setIsTestingM3u(true);
    setM3uTestResult(null);
    try {
      const res = await api.testM3U(m3uUrl || undefined);
      setM3uTestResult(res);
      if (res.valid) {
        showToast(`M3U playlist verified! (${res.channelCount} channels found)`, 'success');
      } else {
        showToast(res.message, 'error');
      }
      const conf = await api.getStarIPTVConfig();
      setIptvLogs(conf.logs);
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : 'M3U test failed', 'error');
    } finally {
      setIsTestingM3u(false);
    }
  };

  const handleTestEPG = async () => {
    setIsTestingEpg(true);
    setEpgTestResult(null);
    try {
      const res = await api.testEPG(epgUrl || undefined);
      setEpgTestResult(res);
      if (res.valid) {
        showToast('EPG XMLTV feed verified!', 'success');
      } else {
        showToast(res.message, 'error');
      }
      const conf = await api.getStarIPTVConfig();
      setIptvLogs(conf.logs);
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : 'EPG test failed', 'error');
    } finally {
      setIsTestingEpg(false);
    }
  };

  const handleImportM3U = async () => {
    setIsImportingM3u(true);
    try {
      const res = await api.importM3U(m3uUrl || undefined);
      if (res.success) {
        setM3uChannels(res.channels);
        showToast(`Imported ${res.count} channels from M3U playlist!`, 'success');
      } else {
        showToast(res.message, 'error');
      }
      const conf = await api.getStarIPTVConfig();
      setIptvLogs(conf.logs);
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : 'M3U import failed', 'error');
    } finally {
      setIsImportingM3u(false);
    }
  };

  const handleImportCategory = async (categoryId: string) => {
    setImportingCatId(categoryId);
    try {
      const res = await api.importIPTVCategory(categoryId);
      if (res.success) {
        showToast(`Imported ${res.count} HLS streams from "${res.categoryName}"!`, 'success');
        const m3uRes = await api.getM3UChannels();
        setM3uChannels(m3uRes.channels || []);
        const chRes = await api.getAdminChannels();
        setChannels(chRes);
      } else {
        showToast('Failed to import category streams', 'error');
      }
    } catch (e: unknown) {
      showToast(e instanceof Error ? e.message : 'Category import error', 'error');
    } finally {
      setImportingCatId(null);
    }
  };

  const handleRefreshCategories = async () => {
    setIsLoadingCategories(true);
    try {
      const res = await api.getIPTVCategories();
      setIptvCategories(res.categories || []);
      showToast(`Refreshed ${res.total} live categories from Star IPTV`, 'info');
    } catch {
      showToast('Failed to refresh categories', 'error');
    } finally {
      setIsLoadingCategories(false);
    }
  };

  const handleToggleM3UChannel = async (id: string, currentEnabled: boolean) => {
    try {
      await api.toggleM3UChannel(id, !currentEnabled);
      setM3uChannels(m3uChannels.map((c) => (c.id === id ? { ...c, enabled: !currentEnabled } : c)));
      showToast(`Channel ${!currentEnabled ? 'enabled for pilot members' : 'disabled'}`, 'info');
    } catch {
      showToast('Failed to toggle channel', 'error');
    }
  };

  const handleBulkToggleM3U = async (enabled: boolean) => {
    try {
      await api.bulkToggleM3UChannels(enabled, m3uSelectedGroup);
      setM3uChannels(
        m3uChannels.map((c) => {
          if (m3uSelectedGroup === 'All' || c.group === m3uSelectedGroup) {
            return { ...c, enabled };
          }
          return c;
        })
      );
      showToast(`Bulk updated channels to ${enabled ? 'Enabled' : 'Disabled'}`, 'success');
    } catch {
      showToast('Bulk update failed', 'error');
    }
  };

  // Member Management Handlers
  const handleAddMember = async () => {
    if (!newMemberName || !newMemberEmail || !newMemberPassword) {
      showToast('Please provide Name, Email, and Temporary Password', 'error');
      return;
    }

    if (members.length >= slots.total) {
      showToast(`Private pilot member limit reached (${slots.total}/${slots.total}). Upgrade or adjust MAX_PRIVATE_USERS setting.`, 'error');
      return;
    }

    try {
      const res = await api.createMember(newMemberName, newMemberEmail, newMemberPassword);
      setMembers([...members, res.member]);
      setSlots((prev) => ({
        ...prev,
        current: prev.current + 1,
        active: prev.active + 1,
        remaining: Math.max(0, prev.total - (prev.current + 1)),
      }));
      setShowAddMember(false);
      setNewMemberName('');
      setNewMemberEmail('');
      setNewMemberPassword('');
      showToast(`Added private member ${res.member.name}`, 'success');
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : 'Failed to add member', 'error');
    }
  };

  const handleToggleMember = async (id: string) => {
    try {
      const res = await api.toggleMember(id);
      setMembers(members.map((m) => (m.id === id ? { ...m, status: res.status } : m)));
      showToast(`Member status updated to ${res.status}`, 'info');
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : 'Toggle failed', 'error');
    }
  };

  const handleDeleteMember = async (id: string) => {
    if (!confirm('Are you sure you want to remove this member from the private pilot?')) return;
    try {
      await api.deleteMember(id);
      setMembers(members.filter((m) => m.id !== id));
      setSlots((prev) => ({
        ...prev,
        current: Math.max(0, prev.current - 1),
        active: Math.max(0, prev.active - 1),
        remaining: Math.min(prev.total, prev.remaining + 1),
      }));
      showToast('Member removed from private pilot', 'info');
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : 'Delete failed', 'error');
    }
  };

  const handleResetPassword = async () => {
    if (!resetPasswordMember || !newResetPassword) return;
    try {
      await api.resetMemberPassword(resetPasswordMember.id, newResetPassword);
      showToast(`Password reset for ${resetPasswordMember.name}`, 'success');
      setResetPasswordMember(null);
      setNewResetPassword('');
    } catch {
      showToast('Password reset failed', 'error');
    }
  };

  const handleSavePilotSettings = async () => {
    try {
      const res = await api.updatePilotSettings({
        maxPrivateUsers: Number(maxPrivateUsers),
        maxDevicesPerUser: Number(maxDevicesPerUser),
        privateMode,
      });
      setSlots((prev) => ({
        ...prev,
        total: res.settings.maxPrivateUsers,
        remaining: Math.max(0, res.settings.maxPrivateUsers - prev.current),
        maxDevicesPerUser: res.settings.maxDevicesPerUser,
      }));
      showToast('Pilot limits and settings updated', 'success');
    } catch {
      showToast('Failed to update pilot settings', 'error');
    }
  };

  // Content Toggles
  const handleToggleChannel = async (id: string, currentEnabled: boolean) => {
    try {
      await api.toggleChannel(id, !currentEnabled);
      setChannels(channels.map((c) => (c.id === id ? { ...c, enabled: !currentEnabled } : c)));
      showToast(`Channel ${!currentEnabled ? 'Enabled' : 'Disabled'}`, 'info');
    } catch {
      showToast('Toggle failed', 'error');
    }
  };

  const handleToggleMovie = async (id: string, currentEnabled: boolean) => {
    try {
      await api.toggleMovie(id, !currentEnabled);
      setMovies(movies.map((m) => (m.id === id ? { ...m, enabled: !currentEnabled } : m)));
      showToast(`Movie ${!currentEnabled ? 'Enabled' : 'Disabled'}`, 'info');
    } catch {
      showToast('Toggle failed', 'error');
    }
  };

  const handleProcessTakedown = async (id: string, action: 'DISABLE_AND_ACCEPT' | 'REJECT' | 'UNDER_REVIEW') => {
    try {
      await api.processTakedown(id, action);
      showToast(`Takedown processed: ${action}`, 'success');
      loadAllAdminData();
    } catch {
      showToast('Failed to process takedown', 'error');
    }
  };

  const handleAddChannel = async () => {
    if (!newChanName || !newChanStream) {
      showToast('Please provide channel name and stream URL', 'error');
      return;
    }
    const newId = `ch-${Date.now().toString(36)}`;
    const newChannel: Channel = {
      id: newId,
      channelName: newChanName,
      logo: 'https://images.unsplash.com/photo-1594909122845-11baa439b7bf?w=120&auto=format&fit=crop&q=80',
      country: 'Global',
      language: 'English',
      category: newChanCategory,
      streamUrl: newChanStream,
      sourceUrl: newChanStream,
      sourceName: newChanSource,
      rightsStatus: newChanRights,
      commercialUse: false,
      attributionRequired: false,
      lastVerified: new Date().toISOString(),
      enabled: true,
    };

    try {
      await fetch('/api/admin/channels/add', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newChannel),
      });
      setChannels([newChannel, ...channels]);
      setShowAddChannel(false);
      showToast(`Added verified channel ${newChanName}`, 'success');
    } catch {
      showToast('Failed to add channel', 'error');
    }
  };

  // Group list for M3U filter
  const m3uGroups = ['All', ...Array.from(new Set(m3uChannels.map((c) => c.group || 'General')))];
  const filteredM3UChannels = m3uChannels.filter((c) => {
    const matchesGroup = m3uSelectedGroup === 'All' || c.group === m3uSelectedGroup;
    const matchesSearch = !m3uSearch || c.name.toLowerCase().includes(m3uSearch.toLowerCase());
    return matchesGroup && matchesSearch;
  });


  // ---- Admin shell state (new premium console) ----
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [headerSearch, setHeaderSearch] = useState('');
  const [health, setHealth] = useState<{ status: string; uptimeSeconds: number } | null>(null);
  const [providerStats, setProviderStats] = useState<CatalogStatsInfo | null>(null);
  const [chartRange, setChartRange] = useState<7 | 30 | 90>(7);

  useEffect(() => {
    fetch('/api/health')
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error('health'))))
      .then((d) => setHealth({ status: d.status, uptimeSeconds: d.uptimeSeconds || 0 }))
      .catch(() => setHealth(null));
    api.getCatalogStats()
      .then((d) => setProviderStats(d.stats))
      .catch(() => setProviderStats(null));
  }, []);

  const activeLines = Object.values(iptvLineMap).filter((l) => l.assigned && l.status === 'active').length;
  const pendingTakedowns = takedowns.filter((t) => t.status === 'PENDING' || t.status === 'UNDER_REVIEW').length;

  const fmtUptime = (s: number) => {
    if (!s) return '—';
    if (s < 3600) return `${Math.round(s / 60)}m`;
    if (s < 86400) return `${(s / 3600).toFixed(1)}h`;
    return `${(s / 86400).toFixed(1)}d`;
  };

  // Real activity series from the audit-grade watch history (no fabricated data)
  const chartSeries = (() => {
    const days = chartRange;
    const buckets = new Map<string, { sessions: number; members: Set<string> }>();
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date();
      d.setHours(0, 0, 0, 0);
      d.setDate(d.getDate() - i);
      buckets.set(d.toISOString().slice(0, 10), { sessions: 0, members: new Set() });
    }
    watchHistoryList.forEach((rec) => {
      const key = new Date(rec.watchedAt).toISOString().slice(0, 10);
      const b = buckets.get(key);
      if (b) {
        b.sessions += 1;
        b.members.add(rec.userName);
      }
    });
    const entries = Array.from(buckets.entries());
    const maxSessions = Math.max(1, ...entries.map(([, v]) => v.sessions));
    return {
      labels: entries.map(([k]) => k.slice(5)),
      sessions: entries.map(([, v]) => v.sessions),
      members: entries.map(([, v]) => v.members.size),
      maxSessions,
      totalSessions: entries.reduce((a, [, v]) => a + v.sessions, 0),
    };
  })();

  const chartPath = (values: number[], max: number, w: number, h: number) => {
    if (!values.length) return '';
    const stepX = w / Math.max(1, values.length - 1);
    return values
      .map((v, i) => `${i === 0 ? 'M' : 'L'}${(i * stepX).toFixed(1)},${(h - (v / max) * h).toFixed(1)}`)
      .join(' ');
  };

  const membersFiltered = members.filter((m) => {
    if (!headerSearch.trim()) return true;
    const q = headerSearch.toLowerCase();
    return m.name.toLowerCase().includes(q) || m.email.toLowerCase().includes(q);
  });

  const NAV_MAIN = [
    { id: 'overview', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'members', label: 'Members', icon: Users },
    { id: 'iptv', label: 'IPTV Lines', icon: Server },
    { id: 'm3u', label: 'M3U Management', icon: ListFilter },
    { id: 'epg', label: 'EPG', icon: Clock },
    { id: 'devices', label: 'Devices', icon: Smartphone },
    { id: 'history', label: 'Analytics', icon: TrendingUp },
    { id: 'settings', label: 'Settings', icon: Settings },
  ];
  const NAV_SYSTEM = [
    { id: 'creatorhub', label: 'Creator Hub', icon: Clapperboard },
    { id: 'cinema', label: 'Content & Takedowns', icon: Film },
    { id: 'logs', label: 'Logs', icon: ScrollText },
  ];

  const sidebar = (
    <div className="h-full flex flex-col sp-admin-sidebar" style={{ width: '240px' }}>
      {/* Brand */}
      <div className="px-5 pt-5 pb-4">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#E5093A] to-[#B90732] flex items-center justify-center shadow-[0_8px_24px_rgba(229,9,58,0.35)]">
            <span className="text-white font-extrabold text-sm">S</span>
          </div>
          <div className="leading-tight">
            <p className="text-white font-extrabold text-[15px] tracking-tight">Stream<span className="text-[#FF2E55]">Play</span></p>
            <p className="text-[8.5px] font-bold tracking-[0.24em] text-[#8993A3] uppercase">Private Entertainment</p>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 space-y-1 overflow-y-auto py-2">
        {NAV_MAIN.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => { setActiveTab(item.id as typeof activeTab); setSidebarOpen(false); }}
              className={`sp-admin-nav-item ${isActive ? 'is-active' : ''}`}
            >
              <Icon />
              <span className="truncate">{item.label}</span>
            </button>
          );
        })}
        <p className="px-3 pt-4 pb-1.5 text-[9px] font-bold tracking-[0.22em] text-[#5F6978] uppercase">Library</p>
        {([
          { label: 'Live TV', tab: 'live-tv', icon: Radio },
          { label: 'Movies', tab: 'movies', icon: Film },
          { label: 'Series', tab: 'movies-series', icon: Layers },
        ]).map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.tab}
              onClick={() => { setSidebarOpen(false); onNavigate(item.tab); }}
              className="sp-admin-nav-item"
              title={`Open ${item.label} in the member app`}
            >
              <Icon />
              <span className="flex-1 truncate">{item.label}</span>
              <span className="text-[#5F6978] text-[10px]">↗</span>
            </button>
          );
        })}
        <p className="px-3 pt-4 pb-1.5 text-[9px] font-bold tracking-[0.22em] text-[#5F6978] uppercase">System</p>
        {NAV_SYSTEM.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => { setActiveTab(item.id as typeof activeTab); setSidebarOpen(false); }}
              className={`sp-admin-nav-item ${isActive ? 'is-active' : ''}`}
            >
              <Icon />
              <span className="flex-1 truncate">{item.label}</span>
              {item.id === 'cinema' && pendingTakedowns > 0 && (
                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-[#F2B84B]/15 text-[#F2B84B] border border-[#F2B84B]/25">{pendingTakedowns}</span>
              )}
            </button>
          );
        })}
      </nav>

      {/* Footer card */}
      <div className="p-4">
        <div className="p-3.5 rounded-2xl bg-gradient-to-br from-[#E5093A]/12 to-transparent border border-[#E5093A]/20 text-center">
          <ShieldCheck className="w-5 h-5 text-[#FF2E55] mx-auto mb-1.5" />
          <p className="text-[11px] font-bold text-white">StreamPlay Admin</p>
          <p className="text-[9.5px] text-[#8993A3] mt-0.5 leading-snug">Manage your private streaming platform with total control.</p>
          <span className="inline-flex items-center gap-1 mt-2 px-2 py-0.5 rounded-full bg-[#E5093A]/15 border border-[#E5093A]/25 text-[9px] font-bold text-[#FF2E55]">
            <Lock className="w-2.5 h-2.5" /> Secure &amp; Private
          </span>
        </div>
        <div className="flex items-center justify-between mt-3 px-1 text-[9.5px] text-[#5F6978]">
          <span>Version 1.0.0</span>
          <span className="flex items-center gap-1 text-[#19C77A]"><span className="w-1.5 h-1.5 rounded-full bg-[#19C77A] animate-pulse" /> System Online</span>
        </div>
      </div>
    </div>
  );

  return (
    <div className="sp-admin-shell flex min-h-screen">
      {/* Desktop sidebar */}
      <aside className="hidden lg:block sticky top-0 h-screen shrink-0">{sidebar}</aside>

      {/* Mobile drawer */}
      {sidebarOpen && <div className="fixed inset-0 z-50 bg-black/70 lg:hidden" onClick={() => setSidebarOpen(false)} />}
      <aside className={`sp-admin-sidebar-mobile lg:hidden ${sidebarOpen ? 'is-open' : ''}`} style={{ background: '#07101A' }}>
        {sidebar}
      </aside>

      {/* Main column */}
      <div className="flex-1 min-w-0 flex flex-col">
        {/* Header */}
        <header className="sticky top-0 z-40 bg-[#04070B]/85 backdrop-blur-xl border-b border-white/[0.06]">
          <div className="px-4 sm:px-6 py-3 flex items-center gap-3">
            <button className="lg:hidden p-2 rounded-lg text-[#C6CBD4] hover:bg-white/5" onClick={() => setSidebarOpen(true)} aria-label="Open menu">
              <Menu className="w-5 h-5" />
            </button>
            <div className="sp-admin-search flex items-center flex-1 max-w-md px-3">
              <Search className="w-3.5 h-3.5 text-[#5F6978] shrink-0" />
              <input
                value={headerSearch}
                onChange={(e) => setHeaderSearch(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && headerSearch.trim()) setActiveTab('members'); }}
                placeholder="Search members, lines, channels..."
                className="bg-transparent border-none outline-none text-xs text-white placeholder-[#5F6978] px-2.5 py-2.5 w-full"
              />
            </div>
            <div className="flex-1" />
            <button
              onClick={() => setActiveTab('cinema')}
              className="relative p-2.5 rounded-full text-[#C6CBD4] hover:text-white hover:bg-white/[0.06] transition-colors"
              title={`${pendingTakedowns} pending takedown review`}
            >
              <Bell className="w-[18px] h-[18px]" />
              {pendingTakedowns > 0 && (
                <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 rounded-full bg-[#E5093A] text-white text-[9px] font-bold flex items-center justify-center">{pendingTakedowns}</span>
              )}
            </button>
            <div className="flex items-center gap-2.5 pl-1">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#E5093A] to-[#C20A42] flex items-center justify-center text-[11px] font-extrabold text-white">{(adminUser?.name || 'A')[0].toUpperCase()}</div>
              <div className="hidden sm:block leading-tight text-right">
                <p className="text-xs font-bold text-white max-w-[140px] truncate">{adminUser?.name || 'Admin'}</p>
                <p className="text-[10px] text-[#8993A3]">Director · Administrator</p>
              </div>
            </div>
            <button onClick={loadAllAdminData} className="sp-admin-secondary !min-h-[38px] !px-3" title="Refresh all metrics">
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
            <button onClick={() => onNavigate('home')} className="sp-admin-secondary !min-h-[38px] !px-3 !text-[11px]" title="Exit console">
              <X className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Exit Console</span>
            </button>
          </div>
        </header>

        <main className="admin-content flex-1 px-4 sm:px-6 py-6 space-y-6">
          {/* ===== Welcome banner ===== */}
          <div className="sp-admin-banner p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#E5093A] to-[#B90732] flex items-center justify-center shadow-[0_10px_30px_rgba(229,9,58,0.3)] hidden sm:flex">
                <Zap className="w-6 h-6 text-white" fill="currentColor" />
              </div>
              <div>
                <h2 className="text-xl font-extrabold text-white tracking-tight">Welcome back, {(adminUser?.name || 'Admin').split('(')[0].trim()}</h2>
                <p className="text-xs text-[#8993A3] mt-0.5">Here's what's happening with your StreamPlay platform today.</p>
              </div>
            </div>
            <div className="text-left sm:text-right">
              <p className="text-xs font-semibold text-[#C6CBD4]">{new Date().toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })} · {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
              <span className="inline-flex items-center gap-1.5 mt-1.5 px-2.5 py-1 rounded-full bg-[#19C77A]/12 border border-[#19C77A]/25 text-[10px] font-bold text-[#5FE0A8]">
                <span className="w-1.5 h-1.5 rounded-full bg-[#19C77A] animate-pulse" />
                {health?.status === 'healthy' ? 'System Online' : 'System Status Unknown'}
              </span>
            </div>
          </div>

          {/* ===== KPI grid ===== */}
          <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
            {[
              {
                label: 'Total Members', value: `${slots.current}`,
                sub: `${slots.remaining} slot${slots.remaining !== 1 ? 's' : ''} free`, trend: `of ${slots.total} max`,
                icon: <Users className="w-5 h-5 text-[#8FC3FF]" />, tint: 'rgba(86,168,255,0.12)', ring: 'rgba(86,168,255,0.28)',
              },
              {
                label: 'Active IPTV Lines', value: `${activeLines}`,
                sub: 'Assigned & verified', trend: `${iptvLineMap ? Object.values(iptvLineMap).filter((l) => l.assigned).length : 0} total`,
                icon: <Server className="w-5 h-5 text-[#FF2E55]" />, tint: 'rgba(229,9,58,0.12)', ring: 'rgba(229,9,58,0.28)',
              },
              {
                label: 'Total Channels', value: providerStats ? providerStats.live.familySafe.toLocaleString() : '—',
                sub: 'Live from provider', trend: providerStats ? `${providerStats.live.categories} categories` : 'measuring…',
                icon: <Radio className="w-5 h-5 text-[#9D8FFF]" />, tint: 'rgba(106,92,255,0.12)', ring: 'rgba(106,92,255,0.28)',
              },
              {
                label: 'System Uptime', value: health ? fmtUptime(health.uptimeSeconds) : '—',
                sub: 'This server instance', trend: health?.status === 'healthy' ? 'Healthy' : 'Checking…',
                icon: <Activity className="w-5 h-5 text-[#5FE0A8]" />, tint: 'rgba(25,199,122,0.12)', ring: 'rgba(25,199,122,0.28)',
              },
            ].map((kpi) => (
              <div key={kpi.label} className="sp-admin-card p-5">
                <div className="flex items-start justify-between">
                  <div className="sp-admin-kpi-icon" style={{ background: kpi.tint, border: `1px solid ${kpi.ring}` }}>{kpi.icon}</div>
                </div>
                <p className="text-[26px] font-extrabold text-white mt-3 tracking-tight leading-none tabular-nums">{kpi.value}</p>
                <p className="text-xs font-semibold text-[#C6CBD4] mt-1.5">{kpi.label}</p>
                <p className="text-[10px] text-[#5F6978] mt-0.5">{kpi.trend} · {kpi.sub}</p>
              </div>
            ))}
          </div>

          {/* ================================================== */}
          {/* TAB 1: DASHBOARD (overview)                        */}
          {/* ================================================== */}
          {activeTab === 'overview' && (
            <div className="space-y-6">
              {/* Chart + content stats */}
              <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
                {/* Platform overview chart (real sessions from watch history) */}
                <div className="xl:col-span-2 sp-admin-card p-5">
                  <div className="flex items-center justify-between flex-wrap gap-3">
                    <div>
                      <h3 className="text-sm font-bold text-white">Platform Overview</h3>
                      <p className="text-[10px] text-[#5F6978] mt-0.5">
                        Stream sessions &amp; active members — real telemetry ({chartSeries.totalSessions} sessions in range)
                      </p>
                    </div>
                    <div className="flex items-center gap-1 p-1 rounded-lg bg-[#0B121D] border border-white/[0.07]">
                      {([7, 30, 90] as const).map((r) => (
                        <button
                          key={r}
                          onClick={() => setChartRange(r)}
                          className={`px-3 py-1.5 rounded-md text-[10px] font-bold transition-colors ${
                            chartRange === r ? 'bg-[#E5093A] text-white' : 'text-[#8993A3] hover:text-white'
                          }`}
                        >
                          {r}D
                        </button>
                      ))}
                    </div>
                  </div>

                  {chartSeries.totalSessions === 0 ? (
                    <div className="sp-admin-empty mt-4">
                      <TrendingUp className="w-8 h-8 mx-auto mb-2 text-[#5F6978]" />
                      <p className="text-xs font-semibold text-[#C6CBD4]">No streaming sessions recorded in this range</p>
                      <p className="text-[10px] text-[#5F6978] mt-1">Session data appears here the moment members start watching.</p>
                    </div>
                  ) : (
                    <div className="mt-4">
                      <div className="flex items-center gap-4 text-[10px] text-[#8993A3] mb-2">
                        <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full" style={{ background: 'var(--sp-chart-1)' }} /> Stream Sessions</span>
                        <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full" style={{ background: 'var(--sp-chart-3)' }} /> Active Members</span>
                      </div>
                      <svg viewBox="0 0 600 180" className="w-full h-44" preserveAspectRatio="none" role="img" aria-label="Sessions chart">
                        <defs>
                          <linearGradient id="spChartFill" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#E5093A" stopOpacity="0.28" />
                            <stop offset="100%" stopColor="#E5093A" stopOpacity="0" />
                          </linearGradient>
                        </defs>
                        {[0.25, 0.5, 0.75].map((f) => (
                          <line key={f} x1="0" x2="600" y1={180 * f} y2={180 * f} stroke="rgba(255,255,255,0.05)" strokeWidth="1" />
                        ))}
                        <path d={`${chartPath(chartSeries.sessions, chartSeries.maxSessions, 600, 170)} L600,180 L0,180 Z`} fill="url(#spChartFill)" />
                        <path d={chartPath(chartSeries.sessions, chartSeries.maxSessions, 600, 170)} fill="none" stroke="#E5093A" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
                        <path d={chartPath(chartSeries.members, Math.max(1, ...chartSeries.members), 600, 170)} fill="none" stroke="#6A5CFF" strokeWidth="2" strokeDasharray="1 0" strokeLinejoin="round" strokeLinecap="round" />
                        {chartSeries.sessions.map((v, i) => {
                          const stepX = 600 / Math.max(1, chartSeries.sessions.length - 1);
                          return (
                            <circle key={i} cx={i * stepX} cy={170 - (v / chartSeries.maxSessions) * 170} r="3" fill="#E5093A">
                              <title>{`${chartSeries.labels[i]} — ${v} session(s), ${chartSeries.members[i]} active member(s)`}</title>
                            </circle>
                          );
                        })}
                      </svg>
                      <div className="flex justify-between text-[9px] text-[#5F6978] mt-1.5">
                        <span>{chartSeries.labels[0]}</span>
                        <span>{chartSeries.labels[Math.floor(chartSeries.labels.length / 2)]}</span>
                        <span>{chartSeries.labels[chartSeries.labels.length - 1]}</span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Content stats (real provider catalog totals) */}
                <div className="sp-admin-card p-5">
                  <h3 className="text-sm font-bold text-white">Content Stats</h3>
                  <p className="text-[10px] text-[#5F6978] mt-0.5 mb-3">Verified from the provider catalog</p>
                  <div className="space-y-2.5">
                    {[
                      { label: 'Live TV Channels', value: providerStats ? providerStats.live.familySafe.toLocaleString() : '—', icon: <Radio className="w-4 h-4 text-[#FF2E55]" />, note: providerStats ? `${providerStats.live.categories} cats` : '…' },
                      { label: 'Movies', value: providerStats ? providerStats.vod.familySafe.toLocaleString() : '—', icon: <Film className="w-4 h-4 text-[#9D8FFF]" />, note: providerStats ? `${providerStats.vod.categories} cats` : '…' },
                      { label: 'Series', value: providerStats ? providerStats.series.familySafe.toLocaleString() : '—', icon: <Tv className="w-4 h-4 text-[#8FC3FF]" />, note: providerStats ? `${providerStats.series.categories} cats` : '…' },
                      { label: 'Episodes', value: providerStats?.episodes ? (providerStats.episodesMethod === 'sampled' ? `≈${Math.round(providerStats.episodes / 1000)}K` : providerStats.episodes.toLocaleString()) : '—', icon: <ListFilter className="w-4 h-4 text-[#5FE0A8]" />, note: providerStats?.episodesMethod === 'sampled' ? 'sampled estimate' : 'episode library' },
                    ].map((row) => (
                      <div key={row.label} className="flex items-center justify-between p-3 rounded-xl bg-[#0B121D]/70 border border-white/[0.05]">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-lg bg-white/[0.04] border border-white/[0.06] flex items-center justify-center">{row.icon}</div>
                          <span className="text-xs font-medium text-[#C6CBD4]">{row.label}</span>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-extrabold text-white tabular-nums">{row.value}</p>
                          <p className="text-[9px] text-[#5F6978]">{row.note}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Members table + quick actions / activity */}
              <div className="grid grid-cols-1 xl:grid-cols-3 gap-5 items-start">
                {/* Members (premium table) */}
                <div className="xl:col-span-2 sp-admin-card p-5">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h3 className="text-sm font-bold text-white">Members</h3>
                      <p className="text-[10px] text-[#5F6978] mt-0.5">Household accounts authorized on this pilot</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button onClick={() => setActiveTab('members')} className="sp-admin-secondary !min-h-[36px] !px-3 !text-[11px]">Open Manager</button>
                      <button
                        onClick={() => { if (members.length >= slots.total) { showToast(`Member limit reached (${slots.total}/${slots.total}).`, 'error'); } else { setShowAddMember(true); } }}
                        className="sp-admin-primary !min-h-[36px] !px-3 !text-[11px]"
                      >
                        <Plus className="w-3.5 h-3.5" /> Add New Member
                      </button>
                    </div>
                  </div>
                  {membersFiltered.length === 0 ? (
                    <div className="sp-admin-empty">
                      <Users className="w-8 h-8 mx-auto mb-2 text-[#5F6978]" />
                      <p className="text-xs font-semibold text-[#C6CBD4]">{headerSearch ? `No members match "${headerSearch}"` : 'No members yet'}</p>
                      <button onClick={() => setShowAddMember(true)} className="sp-admin-primary !min-h-[36px] mt-3">Add your first member</button>
                    </div>
                  ) : (
                    <div className="sp-admin-table-wrap !shadow-none">
                      <table className="sp-admin-table">
                        <thead>
                          <tr>
                            <th>Name</th>
                            <th>Username</th>
                            <th>Status</th>
                            <th>Assigned Line</th>
                            <th className="text-right">Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {membersFiltered.map((member) => (
                            <tr key={member.id}>
                              <td>
                                <div className="flex items-center gap-2.5">
                                  <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-[#1B2740] to-[#121A28] border border-white/[0.08] flex items-center justify-center font-bold text-white text-[11px]">{member.name[0]}</div>
                                  <span className="font-semibold text-white">{member.name}</span>
                                </div>
                              </td>
                              <td className="font-mono text-[10.5px] text-[#8993A3]">{member.email}</td>
                              <td>
                                <span className={`sp-admin-badge ${member.status === 'active' ? 'sp-admin-badge-success' : 'sp-admin-badge-danger'}`}>{member.status}</span>
                              </td>
                              <td>
                                {iptvLineMap[member.id]?.assigned ? (
                                  <span className="sp-admin-badge sp-admin-badge-info"><Tv className="w-3 h-3" />{iptvLineMap[member.id].usernameMasked}</span>
                                ) : (
                                  <span className="text-[10px] italic text-[#5F6978]">Not assigned</span>
                                )}
                              </td>
                              <td>
                                <div className="flex items-center justify-end gap-1">
                                  <button onClick={() => openLineModal(member)} className="p-1.5 rounded-lg bg-white/[0.04] hover:bg-[#E5093A]/15 text-[#8993A3] hover:text-[#FF2E55] border border-white/[0.06] transition-colors" title="Assign IPTV Line"><Tv className="w-3.5 h-3.5" /></button>
                                  <button onClick={() => { setResetPasswordMember(member); setNewResetPassword(''); }} className="p-1.5 rounded-lg bg-white/[0.04] hover:bg-white/[0.09] text-[#8993A3] hover:text-white border border-white/[0.06] transition-colors" title="Reset password"><KeyRound className="w-3.5 h-3.5" /></button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

                {/* Right column: quick actions + activity */}
                <div className="space-y-5">
                  <div className="sp-admin-card p-5">
                    <h3 className="text-sm font-bold text-white mb-3.5">Quick Actions</h3>
                    <div className="space-y-2">
                      <button
                        onClick={() => { if (members.length >= slots.total) { showToast(`Member limit reached (${slots.total}/${slots.total}).`, 'error'); } else { setShowAddMember(true); } }}
                        className="sp-admin-primary w-full"
                      >
                        <Plus className="w-4 h-4" /> Add New Member
                      </button>
                      <button onClick={() => setActiveTab('members')} className="sp-admin-quick-action"><Tv className="w-4 h-4 text-[#FF2E55]" /> Assign IPTV Line</button>
                      <button onClick={() => setActiveTab('m3u')} className="sp-admin-quick-action"><Download className="w-4 h-4 text-[#9D8FFF]" /> Import M3U</button>
                      <button onClick={() => setActiveTab('epg')} className="sp-admin-quick-action"><Clock className="w-4 h-4 text-[#F2B84B]" /> Update EPG</button>
                      <button onClick={() => setActiveTab('logs')} className="sp-admin-quick-action"><ScrollText className="w-4 h-4 text-[#8FC3FF]" /> View Logs</button>
                    </div>
                  </div>

                  <div className="sp-admin-card p-5">
                    <div className="flex items-center justify-between mb-3.5">
                      <h3 className="text-sm font-bold text-white">Recent Activity</h3>
                      <button onClick={() => setActiveTab('logs')} className="text-[10px] font-bold text-[#FF2E55] hover:underline">View All →</button>
                    </div>
                    {adminLogs.length === 0 ? (
                      <div className="sp-admin-empty !p-6"><ScrollText className="w-6 h-6 mx-auto mb-2 text-[#5F6978]" /><p className="text-[11px]">No activity yet</p></div>
                    ) : (
                      <div className="space-y-1">
                        {adminLogs.slice(0, 7).map((log) => {
                          const level = /ERROR|FAIL/i.test(log.action) ? 'danger' : /TAKEDOWN|DISABLE/i.test(log.action) ? 'warning' : /MEMBER|REGISTER|LOGIN/i.test(log.action) ? 'info' : 'success';
                          const iconColor = level === 'danger' ? 'text-[#FF4D67]' : level === 'warning' ? 'text-[#F2B84B]' : level === 'info' ? 'text-[#56A8FF]' : 'text-[#19C77A]';
                          return (
                            <div key={log.id} className="flex items-start gap-2.5 p-2.5 rounded-xl hover:bg-white/[0.035] transition-colors">
                              <div className={`w-7 h-7 rounded-lg bg-white/[0.04] border border-white/[0.06] flex items-center justify-center shrink-0`}>
                                <CheckCircle2 className={`w-3.5 h-3.5 ${iconColor}`} />
                              </div>
                              <div className="min-w-0 flex-1">
                                <p className="text-[11px] font-semibold text-white truncate">{log.action.replaceAll('_', ' ').toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase())}</p>
                                <p className="text-[10px] text-[#8993A3] truncate">{log.details}</p>
                              </div>
                              <span className="text-[9px] text-[#5F6978] whitespace-nowrap">{new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ================================================== */}
          {/* TAB 2: MEMBERS                                     */}
          {/* ================================================== */}
          {activeTab === 'members' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
                <div className="sp-admin-card p-5 space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#8993A3]">Private Access Slots</span>
                    <span className="sp-admin-badge sp-admin-badge-info">Target 3–5</span>
                  </div>
                  <div>
                    <div className="flex items-baseline justify-between mb-2">
                      <span className="text-2xl font-extrabold text-white">{slots.current} / {slots.total}</span>
                      <span className="text-[11px] font-semibold text-[#5FE0A8]">{slots.remaining} remaining</span>
                    </div>
                    <div className="w-full h-2 rounded-full bg-white/[0.06] overflow-hidden">
                      <div className="h-full bg-gradient-to-r from-[#19C77A] to-[#E5093A] transition-all" style={{ width: `${Math.min(100, (slots.current / slots.total) * 100)}%` }} />
                    </div>
                  </div>
                  <p className="text-[10.5px] text-[#8993A3] leading-relaxed">Accounts are strictly controlled by the Administrator. Only listed members can access live streams and playback.</p>
                </div>

                <div className="lg:col-span-2 sp-admin-card p-5 space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#8993A3]">Pilot Policy &amp; Limits</span>
                    <button onClick={handleSavePilotSettings} className="sp-admin-primary !min-h-[38px] !px-4 !text-[11px]">Save Limit Settings</button>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div>
                      <label className="text-[10.5px] font-semibold text-[#8993A3] block mb-1.5">MAX_PRIVATE_USERS</label>
                      <select value={maxPrivateUsers} onChange={(e) => setMaxPrivateUsers(Number(e.target.value))} className="sp-admin-select">
                        <option value={3}>3 Members (Strict Family)</option>
                        <option value={5}>5 Members (Default Pilot)</option>
                        <option value={10}>10 Members (Extended)</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-[10.5px] font-semibold text-[#8993A3] block mb-1.5">MAX_DEVICES_PER_USER</label>
                      <select value={maxDevicesPerUser} onChange={(e) => setMaxDevicesPerUser(Number(e.target.value))} className="sp-admin-select">
                        <option value={1}>1 Device</option>
                        <option value={2}>2 Devices (Recommended)</option>
                        <option value={3}>3 Devices</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-[10.5px] font-semibold text-[#8993A3] block mb-1.5">PRIVATE_MODE</label>
                      <button onClick={() => setPrivateMode(!privateMode)} className={`w-full min-h-[42px] rounded-xl font-semibold border text-xs transition-colors ${privateMode ? 'bg-[#19C77A]/10 border-[#19C77A]/30 text-[#5FE0A8]' : 'bg-[#FF4D67]/10 border-[#FF4D67]/30 text-[#FF8DA0]'}`}>
                        {privateMode ? 'PRIVATE_MODE = TRUE' : 'COMMERCIAL PUBLIC'}
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              <div className="sp-admin-card p-5">
                <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
                  <div>
                    <h3 className="text-sm font-bold text-white">Household Member Accounts ({members.length})</h3>
                    <p className="text-[10px] text-[#5F6978] mt-0.5">Private members authorized to stream live television, cinema, and Star IPTV line feeds.</p>
                  </div>
                  <button
                    onClick={() => { if (members.length >= slots.total) { showToast(`Private pilot member limit reached (${slots.total}/${slots.total}).`, 'error'); } else { setShowAddMember(true); } }}
                    className="sp-admin-primary !min-h-[40px]"
                  >
                    <Plus className="w-4 h-4" /> Add Pilot Member
                  </button>
                </div>

                {members.length >= slots.total && (
                  <div className="mb-4 p-3 rounded-xl bg-[#F2B84B]/10 border border-[#F2B84B]/25 text-[#F6CD85] text-xs flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-[#F2B84B] shrink-0" />
                    Member limit reached ({slots.total}/{slots.total}). Adjust MAX_PRIVATE_USERS to allocate more slots.
                  </div>
                )}

                {members.length === 0 ? (
                  <div className="sp-admin-empty">
                    <Users className="w-9 h-9 mx-auto mb-2 text-[#5F6978]" />
                    <p className="text-xs font-semibold text-[#C6CBD4]">No members yet</p>
                    <p className="text-[10px] text-[#5F6978] mt-1">Invite your first household member to activate the pilot.</p>
                  </div>
                ) : (
                  <div className="sp-admin-table-wrap !shadow-none">
                    <table className="sp-admin-table">
                      <thead>
                        <tr>
                          <th>Name</th>
                          <th>Username</th>
                          <th>Role</th>
                          <th>Status</th>
                          <th>Assigned Line</th>
                          <th>Devices</th>
                          <th className="text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {members.map((member) => (
                          <tr key={member.id}>
                            <td>
                              <div className="flex items-center gap-2.5">
                                <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-[#1B2740] to-[#121A28] border border-white/[0.08] flex items-center justify-center font-bold text-white text-[11px]">{member.name[0]}</div>
                                <span className="font-semibold text-white">{member.name}</span>
                              </div>
                            </td>
                            <td className="font-mono text-[10.5px] text-[#8993A3]">{member.email}</td>
                            <td><span className="sp-admin-badge sp-admin-badge-muted">{member.role === 'admin' ? 'Director' : 'Member'}</span></td>
                            <td><span className={`sp-admin-badge ${member.status === 'active' ? 'sp-admin-badge-success' : 'sp-admin-badge-danger'}`}>{member.status}</span></td>
                            <td>
                              {iptvLineMap[member.id]?.assigned ? (
                                <div className="space-y-0.5">
                                  <span className="sp-admin-badge sp-admin-badge-info"><Tv className="w-3 h-3" />{iptvLineMap[member.id].usernameMasked}</span>
                                  <div className="text-[9.5px] text-[#5F6978]">
                                    {iptvLineMap[member.id].status === 'active' ? 'Active' : 'Disabled'}
                                    {iptvLineMap[member.id].expiresAt ? ` · exp ${String(iptvLineMap[member.id].expiresAt).slice(0, 10)}` : ''}
                                    {iptvLineMap[member.id].maxConnections ? ` · ${iptvLineMap[member.id].maxConnections} conn` : ''}
                                  </div>
                                </div>
                              ) : (
                                <span className="text-[10px] italic text-[#5F6978]">Not assigned</span>
                              )}
                            </td>
                            <td className="font-mono text-[10.5px]">{member.devicesCount || 0} / {slots.maxDevicesPerUser}</td>
                            <td>
                              <div className="flex items-center justify-end gap-1.5">
                                {member.role !== 'admin' && (
                                  <>
                                    <button onClick={() => openLineModal(member)} className="p-1.5 rounded-lg bg-[#56A8FF]/10 hover:bg-[#56A8FF]/20 text-[#8FC3FF] border border-[#56A8FF]/20 transition-colors" title="Assign Star IPTV Line"><Tv className="w-3.5 h-3.5" /></button>
                                    <button onClick={() => handleToggleMember(member.id)} className={`p-1.5 rounded-lg border transition-colors ${member.status === 'active' ? 'bg-[#FF4D67]/10 border-[#FF4D67]/20 text-[#FF8DA0] hover:bg-[#FF4D67]/20' : 'bg-[#19C77A]/10 border-[#19C77A]/20 text-[#5FE0A8] hover:bg-[#19C77A]/20'}`} title={member.status === 'active' ? 'Suspend' : 'Activate'}>{member.status === 'active' ? <UserX className="w-3.5 h-3.5" /> : <UserCheck className="w-3.5 h-3.5" />}</button>
                                    <button onClick={() => { setResetPasswordMember(member); setNewResetPassword(''); }} className="p-1.5 rounded-lg bg-white/[0.04] hover:bg-white/[0.09] text-[#8993A3] hover:text-white border border-white/[0.06] transition-colors" title="Reset password"><KeyRound className="w-3.5 h-3.5" /></button>
                                    <button onClick={() => handleDeleteMember(member.id)} className="p-1.5 rounded-lg bg-[#FF4D67]/10 hover:bg-[#FF4D67]/20 text-[#FF8DA0] border border-[#FF4D67]/20 transition-colors" title="Delete member"><Trash2 className="w-3.5 h-3.5" /></button>
                                  </>
                                )}
                                {member.role === 'admin' && <span className="text-[10px] italic text-[#5F6978]">Primary Director</span>}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Add Member Modal */}
              {showAddMember && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
                  <div className="w-full max-w-md rounded-2xl bg-[#0D1520] border border-white/[0.08] p-6 shadow-[0_22px_55px_rgba(0,0,0,0.38)] space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-bold text-white">Add Private Pilot Member</h3>
                      <span className="sp-admin-badge sp-admin-badge-success">Slot {slots.current + 1} of {slots.total}</span>
                    </div>
                    <div className="space-y-3">
                      <div>
                        <label className="text-[10.5px] font-semibold text-[#8993A3] block mb-1.5">Full Name</label>
                        <input type="text" value={newMemberName} onChange={(e) => setNewMemberName(e.target.value)} placeholder="e.g. Tariq Vance" className="sp-admin-input" />
                      </div>
                      <div>
                        <label className="text-[10.5px] font-semibold text-[#8993A3] block mb-1.5">Email Address</label>
                        <input type="email" value={newMemberEmail} onChange={(e) => setNewMemberEmail(e.target.value)} placeholder="tariq@aetherstream.tv" className="sp-admin-input" />
                      </div>
                      <div>
                        <label className="text-[10.5px] font-semibold text-[#8993A3] block mb-1.5">Temporary Password</label>
                        <input type="password" value={newMemberPassword} onChange={(e) => setNewMemberPassword(e.target.value)} placeholder="Secure temporary password" className="sp-admin-input" />
                      </div>
                    </div>
                    <div className="flex items-center justify-end gap-2 pt-1">
                      <button onClick={() => setShowAddMember(false)} className="sp-admin-secondary !min-h-[38px]">Cancel</button>
                      <button onClick={handleAddMember} className="sp-admin-primary">Create Member</button>
                    </div>
                  </div>
                </div>
              )}

              {/* Reset Password Modal */}
              {resetPasswordMember && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
                  <div className="w-full max-w-sm rounded-2xl bg-[#0D1520] border border-white/[0.08] p-6 shadow-[0_22px_55px_rgba(0,0,0,0.38)] space-y-4">
                    <h3 className="text-sm font-bold text-white">Reset Password — {resetPasswordMember.name}</h3>
                    <div>
                      <label className="text-[10.5px] font-semibold text-[#8993A3] block mb-1.5">New Temporary Password</label>
                      <input type="password" value={newResetPassword} onChange={(e) => setNewResetPassword(e.target.value)} placeholder="Enter new password" className="sp-admin-input" />
                    </div>
                    <div className="flex items-center justify-end gap-2">
                      <button onClick={() => setResetPasswordMember(null)} className="sp-admin-secondary !min-h-[38px]">Cancel</button>
                      <button onClick={handleResetPassword} className="sp-admin-primary">Save New Password</button>
                    </div>
                  </div>
                </div>
              )}

              {/* Assign IPTV Line drawer/modal */}
              {lineModalMember && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
                  <div className="w-full max-w-md rounded-2xl bg-[#0D1520] border border-white/[0.08] p-6 shadow-[0_22px_55px_rgba(0,0,0,0.38)] space-y-4 max-h-[90vh] overflow-y-auto">
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-bold text-white flex items-center gap-2"><Tv className="w-4 h-4 text-[#FF2E55]" /> Assign IPTV Line — {lineModalMember.name}</h3>
                      <span className="sp-admin-badge sp-admin-badge-crimson">Server-side vault</span>
                    </div>
                    <p className="text-[10.5px] text-[#8993A3] leading-relaxed">
                      The line is probed against the provider (expiry / connection limit / status) and stored ONLY in the server-side vault — the member's browser never receives these credentials, and Live TV / catalog playback will use only this line.
                    </p>
                    <div className="space-y-3">
                      <div>
                        <label className="text-[10.5px] font-semibold text-[#8993A3] block mb-1.5">Provider Server URL *</label>
                        <input type="text" value={lineForm.serverUrl} onChange={(e) => setLineForm({ ...lineForm, serverUrl: e.target.value })} placeholder="http://provider.host:8080" className="sp-admin-input font-mono !text-[11px]" />
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="text-[10.5px] font-semibold text-[#8993A3] block mb-1.5">Line Username *</label>
                          <input type="text" value={lineForm.username} onChange={(e) => setLineForm({ ...lineForm, username: e.target.value })} placeholder="line username" autoComplete="off" className="sp-admin-input font-mono !text-[11px]" />
                        </div>
                        <div>
                          <label className="text-[10.5px] font-semibold text-[#8993A3] block mb-1.5">Line Password *</label>
                          <div className="relative">
                            <input type={showLinePassword ? 'text' : 'password'} value={lineForm.password} onChange={(e) => setLineForm({ ...lineForm, password: e.target.value })} placeholder="line password" autoComplete="new-password" className="sp-admin-input font-mono !text-[11px] !pr-9" />
                            <button type="button" onClick={() => setShowLinePassword(!showLinePassword)} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#5F6978] hover:text-white">{showLinePassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}</button>
                          </div>
                        </div>
                      </div>
                      <div>
                        <label className="text-[10.5px] font-semibold text-[#8993A3] block mb-1.5">M3U URL (optional — derived automatically)</label>
                        <input type="text" value={lineForm.m3uUrl} onChange={(e) => setLineForm({ ...lineForm, m3uUrl: e.target.value })} placeholder="get.php?username=…&type=m3u_plus" className="sp-admin-input font-mono !text-[11px]" />
                      </div>
                      <div>
                        <label className="text-[10.5px] font-semibold text-[#8993A3] block mb-1.5">EPG URL (optional — derived automatically)</label>
                        <input type="text" value={lineForm.epgUrl} onChange={(e) => setLineForm({ ...lineForm, epgUrl: e.target.value })} placeholder="xmltv.php?username=…" className="sp-admin-input font-mono !text-[11px]" />
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="text-[10.5px] font-semibold text-[#8993A3] block mb-1.5">Line Label (optional)</label>
                          <input type="text" value={lineForm.providerName} onChange={(e) => setLineForm({ ...lineForm, providerName: e.target.value })} placeholder="Family Full-Catalog Line" className="sp-admin-input" />
                        </div>
                        <div>
                          <label className="text-[10.5px] font-semibold text-[#8993A3] block mb-1.5">Status</label>
                          <select value={lineForm.status} onChange={(e) => setLineForm({ ...lineForm, status: e.target.value as 'active' | 'disabled' })} className="sp-admin-select">
                            <option value="active">Active</option>
                            <option value="disabled">Disabled</option>
                          </select>
                        </div>
                      </div>
                    </div>
                    {lineProbeResult && (
                      <div className={`p-3 rounded-xl text-[11px] border ${lineProbeResult.ok ? 'bg-[#19C77A]/10 border-[#19C77A]/30 text-[#5FE0A8]' : 'bg-[#FF4D67]/10 border-[#FF4D67]/30 text-[#FF8DA0]'}`}>
                        <span className="font-semibold">{lineProbeResult.ok ? 'Probe result: ' : 'Probe failed: '}</span>
                        {lineProbeResult.message}
                      </div>
                    )}
                    <div className="flex items-center justify-between gap-2 pt-1">
                      {iptvLineMap[lineModalMember.id]?.assigned ? (
                        <button onClick={handleClearLine} className="text-[11px] font-semibold text-[#FF8DA0] hover:text-[#FF4D67] px-3 py-2 rounded-lg border border-[#FF4D67]/25 hover:bg-[#FF4D67]/10 transition-colors">Unassign Line</button>
                      ) : <span />}
                      <div className="flex items-center gap-2">
                        <button onClick={() => setLineModalMember(null)} className="sp-admin-secondary !min-h-[38px]">Close</button>
                        <button onClick={handleAssignLine} disabled={lineSaving} className="sp-admin-primary !min-h-[38px]">{lineSaving ? 'Verifying…' : 'Verify & Assign'}</button>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ================================================== */}
          {/* TAB 3: IPTV LINES (vault)                          */}
          {/* ================================================== */}
          {activeTab === 'iptv' && (
            <div className="space-y-6">
              <div className="sp-admin-card p-5 sm:p-7 space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/[0.06] pb-4">
                  <div>
                    <h3 className="text-sm font-bold text-white">Star IPTV Reseller Integration Vault</h3>
                    <p className="text-[10.5px] text-[#8993A3] mt-0.5">Sensitive parameters are stored securely server-side. Passwords and M3U tokens are never exposed in client JavaScript.</p>
                  </div>
                  <span className="sp-admin-badge sp-admin-badge-success shrink-0"><Lock className="w-3 h-3" /> Secure Server Storage</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-[10.5px] font-semibold text-[#8993A3] block mb-1.5">Provider Name</label>
                    <input type="text" value={providerName} onChange={(e) => setProviderName(e.target.value)} placeholder="Star IPTV Authorized Reseller" className="sp-admin-input" />
                  </div>
                  <div>
                    <label className="text-[10.5px] font-semibold text-[#8993A3] block mb-1.5">Server URL / Portal Host</label>
                    <input type="text" value={serverUrl} onChange={(e) => setServerUrl(e.target.value)} placeholder="http://provider.host:8080" className="sp-admin-input" />
                  </div>
                  <div>
                    <label className="text-[10.5px] font-semibold text-[#8993A3] block mb-1.5">Username</label>
                    <input type="text" value={iptvUsername} onChange={(e) => setIptvUsername(e.target.value)} placeholder="reseller username" className="sp-admin-input font-mono !text-[11px]" />
                  </div>
                  <div>
                    <label className="text-[10.5px] font-semibold text-[#8993A3] block mb-1.5">Password</label>
                    <div className="relative">
                      <input type={showPassword ? 'text' : 'password'} value={iptvPassword} onChange={(e) => setIptvPassword(e.target.value)} placeholder="Enter Star IPTV secret password..." className="sp-admin-input !pr-9 font-mono !text-[11px]" />
                      <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#5F6978] hover:text-white">{showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}</button>
                    </div>
                  </div>
                  <div className="sm:col-span-2">
                    <label className="text-[10.5px] font-semibold text-[#8993A3] block mb-1.5">M3U URL (Playlist Link)</label>
                    <input type="text" value={m3uUrl} onChange={(e) => setM3uUrl(e.target.value)} placeholder="http://provider.host:8080/get.php?username=...&type=m3u_plus" className="sp-admin-input font-mono !text-[11px]" />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="text-[10.5px] font-semibold text-[#8993A3] block mb-1.5">EPG URL (XMLTV Electronic Program Guide)</label>
                    <input type="text" value={epgUrl} onChange={(e) => setEpgUrl(e.target.value)} placeholder="http://provider.host:8080/xmltv.php?username=..." className="sp-admin-input font-mono !text-[11px]" />
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  <button onClick={handleSaveIPTVConfig} className="sp-admin-primary">Save Configuration</button>
                  <button onClick={handleTestConnection} disabled={isTestingServer} className="sp-admin-secondary">{isTestingServer ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Activity className="w-3.5 h-3.5" />} {isTestingServer ? 'Testing Server...' : 'Test Connection'}</button>
                  <button onClick={handleTestM3U} disabled={isTestingM3u} className="sp-admin-secondary">{isTestingM3u ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <ListFilter className="w-3.5 h-3.5" />} {isTestingM3u ? 'Verifying M3U...' : 'Test M3U'}</button>
                  <button onClick={handleTestEPG} disabled={isTestingEpg} className="sp-admin-secondary">{isTestingEpg ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Radio className="w-3.5 h-3.5" />} {isTestingEpg ? 'Checking EPG...' : 'Test EPG'}</button>
                </div>

                <div className="space-y-2">
                  {testResult && (
                    <div className="p-3 rounded-xl bg-[#56A8FF]/10 border border-[#56A8FF]/25 text-[#8FC3FF] text-xs flex items-center justify-between">
                      <span><strong>Connection Test:</strong> {testResult.status} — {testResult.message}</span>
                      {testResult.latencyMs ? <span className="font-mono text-[10px]">({testResult.latencyMs}ms)</span> : null}
                    </div>
                  )}
                  {m3uTestResult && (
                    <div className={`p-3 rounded-xl border text-xs flex items-center justify-between ${m3uTestResult.valid ? 'bg-[#19C77A]/10 border-[#19C77A]/25 text-[#5FE0A8]' : 'bg-[#FF4D67]/10 border-[#FF4D67]/25 text-[#FF8DA0]'}`}>
                      <span><strong>M3U Test:</strong> {m3uTestResult.message}</span>
                      {m3uTestResult.channelCount !== undefined ? <span className="font-mono text-[10px]">{m3uTestResult.channelCount} streams</span> : null}
                    </div>
                  )}
                  {epgTestResult && (
                    <div className={`p-3 rounded-xl border text-xs flex items-center justify-between ${epgTestResult.valid ? 'bg-[#19C77A]/10 border-[#19C77A]/25 text-[#5FE0A8]' : 'bg-[#FF4D67]/10 border-[#FF4D67]/25 text-[#FF8DA0]'}`}>
                      <span><strong>EPG Test:</strong> {epgTestResult.message}</span>
                      {epgTestResult.latencyMs ? <span className="font-mono text-[10px]">({epgTestResult.latencyMs}ms)</span> : null}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ================================================== */}
          {/* TAB 4: M3U MANAGEMENT                              */}
          {/* ================================================== */}
          {activeTab === 'm3u' && (
            <div className="space-y-6">
              {/* Category → HLS ingestion */}
              <div className="sp-admin-card p-5 sm:p-7 space-y-5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/[0.06] pb-4">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="sp-admin-kicker">M3U Category → HLS Pipeline</span>
                      <span className="sp-admin-badge sp-admin-badge-success">Live HLS .m3u8</span>
                    </div>
                    <h3 className="text-sm font-bold text-white mt-1">Live Category Ingestion &amp; Selection Matrix</h3>
                    <p className="text-[10.5px] text-[#8993A3] mt-0.5">Browse provider categories with live stream counts. Import any category with automatic HLS conversion.</p>
                  </div>
                  <button onClick={handleRefreshCategories} disabled={isLoadingCategories} className="sp-admin-secondary shrink-0">
                    <RefreshCw className={`w-3.5 h-3.5 ${isLoadingCategories ? 'animate-spin' : ''}`} />
                    {isLoadingCategories ? 'Loading...' : 'Refresh Categories'}
                  </button>
                </div>

                {iptvCategories.length > 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 max-h-80 overflow-y-auto pr-1">
                    {iptvCategories.map((cat) => {
                      const isImporting = importingCatId === cat.category_id;
                      const alreadyImported = m3uChannels.filter((c) => c.group === cat.category_name).length;
                      return (
                        <div key={cat.category_id} className="p-3.5 rounded-xl bg-[#0B121D]/80 border border-white/[0.06] hover:border-[#E5093A]/30 transition-all flex items-center justify-between gap-3">
                          <div className="min-w-0 flex-1">
                            <span className="font-bold text-white text-xs truncate block">{cat.category_name}</span>
                            <div className="flex items-center gap-2 mt-1 text-[10px] text-[#8993A3]">
                              <span className="font-mono text-[#8FC3FF]">{cat.stream_count || 0} streams</span>
                              <span>•</span>
                              <span className="text-[#5FE0A8]">HLS .m3u8</span>
                              {alreadyImported > 0 && (<><span>•</span><span className="text-[#9D8FFF]">{alreadyImported} loaded</span></>)}
                            </div>
                          </div>
                          <button onClick={() => handleImportCategory(cat.category_id)} disabled={isImporting} className="px-3 py-1.5 rounded-lg bg-[#E5093A]/15 hover:bg-[#E5093A]/25 text-[#FF2E55] border border-[#E5093A]/30 text-[10.5px] font-semibold shrink-0 transition-colors disabled:opacity-50 flex items-center gap-1.5">
                            {isImporting ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Download className="w-3 h-3" />}
                            {isImporting ? 'Importing…' : 'Import'}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="sp-admin-empty">
                    <ListFilter className="w-8 h-8 mx-auto mb-2 text-[#5F6978]" />
                    <p className="text-xs font-semibold text-[#C6CBD4]">Categories are loading from Star IPTV server</p>
                    <p className="text-[10px] text-[#5F6978] mt-1">Click "Refresh Categories" or verify the Star IPTV vault credentials.</p>
                  </div>
                )}
              </div>

              {/* M3U importer & publishing */}
              <div className="sp-admin-card p-5 sm:p-7 space-y-5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/[0.06] pb-4">
                  <div>
                    <h3 className="text-sm font-bold text-white">M3U Channel Importer &amp; Publishing Workflow</h3>
                    <p className="text-[10.5px] text-[#8993A3] mt-0.5">Fetch playlist → parse metadata → review & toggle → only enabled channels appear to members.</p>
                  </div>
                  <button onClick={handleImportM3U} disabled={isImportingM3u} className="sp-admin-primary shrink-0">
                    <Download className="w-4 h-4" />
                    {isImportingM3u ? 'Parsing Playlist…' : 'Fetch & Import M3U'}
                  </button>
                </div>

                {m3uChannels.length > 0 && (
                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-2 flex-wrap">
                      <input type="text" value={m3uSearch} onChange={(e) => setM3uSearch(e.target.value)} placeholder="Search parsed channels..." className="sp-admin-input !w-56" />
                      <select value={m3uSelectedGroup} onChange={(e) => setM3uSelectedGroup(e.target.value)} className="sp-admin-select !w-auto">
                        {m3uGroups.map((g) => <option key={g} value={g}>{g}</option>)}
                      </select>
                    </div>
                    <div className="flex items-center gap-2">
                      <button onClick={() => handleBulkToggleM3U(true)} className="sp-admin-secondary !min-h-[36px] !text-[11px] !text-[#5FE0A8]"><CheckSquare className="w-3.5 h-3.5" /> Enable Group ({filteredM3UChannels.length})</button>
                      <button onClick={() => handleBulkToggleM3U(false)} className="sp-admin-secondary !min-h-[36px] !text-[11px] !text-[#FF8DA0]"><Square className="w-3.5 h-3.5" /> Disable Group</button>
                    </div>
                  </div>
                )}

                {m3uChannels.length > 0 ? (
                  <div className="sp-admin-table-wrap max-h-96 overflow-y-auto !shadow-none">
                    <table className="sp-admin-table">
                      <thead className="sticky top-0 z-10">
                        <tr>
                          <th>#</th>
                          <th>Channel</th>
                          <th>Group</th>
                          <th>TVG ID</th>
                          <th>Stream</th>
                          <th className="text-right">Visibility</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredM3UChannels.slice(0, 100).map((chan) => (
                          <tr key={chan.id}>
                            <td className="font-mono text-[10px] text-[#5F6978]">{chan.order}</td>
                            <td>
                              <div className="flex items-center gap-2">
                                <img src={chan.logo} alt="" className="w-5 h-5 object-contain" onError={(e) => ((e.target as HTMLElement).style.display = 'none')} />
                                <span className="font-semibold text-white truncate max-w-[200px]">{chan.name}</span>
                              </div>
                            </td>
                            <td>{chan.group}</td>
                            <td className="font-mono text-[10px] text-[#8FC3FF]">{chan.tvgId || '—'}</td>
                            <td className="font-mono text-[10px] text-[#5F6978] truncate max-w-[150px]">{chan.streamUrl.replace(/(password=)[^&]+/i, '$1••••••')}</td>
                            <td className="text-right">
                              <button onClick={() => handleToggleM3UChannel(chan.id, chan.enabled)} className={`sp-admin-badge ${chan.enabled ? 'sp-admin-badge-success' : 'sp-admin-badge-muted'}`}>{chan.enabled ? 'Enabled' : 'Disabled'}</button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="sp-admin-empty">
                    <Download className="w-8 h-8 mx-auto mb-2 text-[#5F6978]" />
                    <p className="text-xs font-semibold text-[#C6CBD4]">No M3U playlist imported yet</p>
                    <p className="text-[10px] text-[#5F6978] mt-1">Enter an M3U URL in the vault tab and click "Fetch &amp; Import M3U".</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ================================================== */}
          {/* TAB 5: EPG                                         */}
          {/* ================================================== */}
          {activeTab === 'epg' && (
            <div className="space-y-6">
              <div className="sp-admin-card p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <span className="sp-admin-kicker" style={{ color: 'var(--sp-warning)' }}>XMLTV Electronic Program Guide Engine</span>
                  <h3 className="text-sm font-bold text-white mt-0.5">Live Broadcast Timelines &amp; Schedules</h3>
                  <p className="text-[10.5px] text-[#8993A3] mt-1 max-w-xl">EPG data is cached locally to minimize provider latency and ensure instant channel flipping without API rate-limiting.</p>
                </div>
                <button onClick={handleTestEPG} disabled={isTestingEpg} className="sp-admin-primary shrink-0">
                  <RefreshCw className={`w-4 h-4 ${isTestingEpg ? 'animate-spin' : ''}`} />
                  {isTestingEpg ? 'Syncing…' : 'Sync & Refresh EPG'}
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {[...channels.filter((c) => c.enabled), ...m3uChannels.filter((c) => c.enabled).slice(0, 10)].map((c) => {
                  const chanName = 'channelName' in c ? c.channelName : c.name;
                  const chanLogo = c.logo;
                  const progCurrent = 'epgProgram' in c && c.epgProgram ? c.epgProgram.current : 'Live Stream Continuous Feed';
                  const progNext = 'epgProgram' in c && c.epgProgram ? c.epgProgram.next : 'Upcoming Lineup Scheduled';
                  const startTime = 'epgProgram' in c && c.epgProgram ? c.epgProgram.startTime : 'Now';
                  const endTime = 'epgProgram' in c && c.epgProgram ? c.epgProgram.endTime : 'Later';
                  return (
                    <div key={c.id} className="sp-admin-card p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2.5">
                          <img src={chanLogo} alt="" className="w-6 h-6 object-contain" onError={(e) => ((e.target as HTMLElement).style.display = 'none')} />
                          <span className="font-bold text-white text-sm">{chanName}</span>
                        </div>
                        <span className="sp-admin-badge sp-admin-badge-success">LIVE</span>
                      </div>
                      <div className="p-3 rounded-lg bg-[#0B121D]/80 border border-white/[0.05] space-y-1.5">
                        <div className="flex items-center justify-between text-[10.5px]">
                          <span className="text-[#8993A3]">Now Playing:</span>
                          <span className="font-mono text-[#5F6978] text-[10px]">{startTime} – {endTime}</span>
                        </div>
                        <p className="text-xs font-semibold text-white">{progCurrent}</p>
                        <div className="w-full bg-white/[0.08] h-1.5 rounded-full overflow-hidden mt-1"><div className="bg-[#E5093A] h-full w-2/3" /></div>
                      </div>
                      <div className="flex items-center justify-between text-[10.5px]">
                        <span className="text-[#5F6978]">Up Next:</span>
                        <span className="text-xs text-[#C6CBD4] font-medium truncate max-w-[220px]">{progNext}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ================================================== */}
          {/* TAB 6: DEVICES                                     */}
          {/* ================================================== */}
          {activeTab === 'devices' && (
            <div className="space-y-6">
              <div className="sp-admin-card p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <span className="sp-admin-kicker" style={{ color: 'var(--sp-info)' }}>Household Concurrency Enforcement</span>
                  <h3 className="text-sm font-bold text-white mt-0.5">Active Member Devices &amp; Revocation</h3>
                  <p className="text-[10.5px] text-[#8993A3] mt-1 max-w-xl">Current limit: <strong className="text-[#C6CBD4]">{slots.maxDevicesPerUser} concurrent devices</strong> per approved member account. Administrators can instantly revoke rogue or stale sessions.</p>
                </div>
                <span className="sp-admin-badge sp-admin-badge-muted shrink-0">Total Tracked: {devicesList.length} Devices</span>
              </div>

              {devicesList.length === 0 ? (
                <div className="sp-admin-empty">
                  <Smartphone className="w-9 h-9 mx-auto mb-2 text-[#5F6978]" />
                  <p className="text-xs font-semibold text-[#C6CBD4]">No devices seen yet</p>
                  <p className="text-[10px] text-[#5F6978] mt-1">Devices register automatically the first time a member signs in.</p>
                </div>
              ) : (
                <div className="sp-admin-table-wrap">
                  <table className="sp-admin-table">
                    <thead>
                      <tr><th>Member</th><th>Device</th><th>Type</th><th>OS &amp; Browser</th><th>Last Active</th><th>State</th><th className="text-right">Action</th></tr>
                    </thead>
                    <tbody>
                      {devicesList.map((item) => (
                        <tr key={`${item.userId}-${item.device.id}`}>
                          <td>
                            <div className="font-semibold text-white">{item.userName}</div>
                            <div className="text-[9.5px] text-[#5F6978] font-mono">{item.userEmail}</div>
                          </td>
                          <td>
                            <div className="flex items-center gap-2 text-white font-medium">
                              {item.device.deviceType === 'desktop' ? <Laptop className="w-4 h-4 text-[#8FC3FF]" /> : item.device.deviceType === 'smart_tv' ? <Tv className="w-4 h-4 text-[#9D8FFF]" /> : <Smartphone className="w-4 h-4 text-[#5FE0A8]" />}
                              <span>{item.device.name}</span>
                            </div>
                          </td>
                          <td className="capitalize">{item.device.deviceType}</td>
                          <td className="text-[10.5px] text-[#8993A3]">{item.device.os} · {item.device.browser}</td>
                          <td className="font-mono text-[10.5px]">{item.device.lastActive}</td>
                          <td>{item.device.isCurrent ? <span className="sp-admin-badge sp-admin-badge-success">Current</span> : <span className="sp-admin-badge sp-admin-badge-muted">Authorized</span>}</td>
                          <td className="text-right">
                            <button onClick={() => handleRevokeDevice(item.userId, item.device.id)} className="px-3 py-1.5 rounded-lg bg-[#FF4D67]/10 hover:bg-[#FF4D67]/20 text-[#FF8DA0] border border-[#FF4D67]/20 text-[11px] font-semibold transition-colors">Revoke</button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* ================================================== */}
          {/* TAB 7: ANALYTICS (watch history)                   */}
          {/* ================================================== */}
          {activeTab === 'history' && (
            <div className="space-y-6">
              <div className="sp-admin-card p-5">
                <span className="sp-admin-kicker" style={{ color: 'var(--sp-info)' }}>Private Pilot Telemetry</span>
                <h3 className="text-sm font-bold text-white mt-0.5">Household Watch History &amp; Activity</h3>
                <p className="text-[10.5px] text-[#8993A3] mt-1 max-w-xl">Audited stream engagement across family members. Powers Continue Watching synchronization across authorized devices.</p>
              </div>

              {watchHistoryList.length === 0 ? (
                <div className="sp-admin-empty">
                  <History className="w-9 h-9 mx-auto mb-2 text-[#5F6978]" />
                  <p className="text-xs font-semibold text-[#C6CBD4]">No watch activity recorded yet</p>
                  <p className="text-[10px] text-[#5F6978] mt-1">Member sessions appear here in real time once playback starts.</p>
                </div>
              ) : (
                <div className="sp-admin-table-wrap">
                  <table className="sp-admin-table">
                    <thead>
                      <tr><th>Member</th><th>Content</th><th>Type</th><th>Progress</th><th className="text-right">Watched At</th></tr>
                    </thead>
                    <tbody>
                      {watchHistoryList.map((rec) => (
                        <tr key={rec.id}>
                          <td className="font-semibold text-white">{rec.userName}</td>
                          <td className="font-medium text-white">{rec.contentTitle}</td>
                          <td>{rec.contentType === 'channel' ? <span className="sp-admin-badge sp-admin-badge-info">Live</span> : <span className="sp-admin-badge sp-admin-badge-crimson">Cinema</span>}</td>
                          <td className="w-48">
                            <div className="flex items-center gap-2">
                              <div className="flex-1 bg-white/[0.08] h-1.5 rounded-full overflow-hidden"><div className="bg-[#E5093A] h-full" style={{ width: `${rec.progressPercentage}%` }} /></div>
                              <span className="text-[10px] font-mono text-[#8993A3]">{rec.progressPercentage}%</span>
                            </div>
                          </td>
                          <td className="text-right font-mono text-[10.5px] text-[#8993A3]">{new Date(rec.watchedAt).toLocaleString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* ================================================== */}
          {/* TAB 8: SETTINGS                                    */}
          {/* ================================================== */}
          {activeTab === 'settings' && (
            <div className="space-y-6">
              <div className="sp-admin-card p-5 sm:p-7 space-y-6">
                <div className="border-b border-white/[0.06] pb-4">
                  <span className="sp-admin-kicker">Pilot Configuration &amp; Company Roadmap</span>
                  <h3 className="text-sm font-bold text-white mt-0.5">Private Pilot Mode &amp; Capacity Limits</h3>
                  <p className="text-[10.5px] text-[#8993A3] mt-1 max-w-2xl leading-relaxed">Configure internal limits for the closed family beta. After SECP company registration, the architecture transitions to commercial operations without rebuilding.</p>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="p-4 rounded-xl bg-[#0B121D]/80 border border-white/[0.05] space-y-2">
                    <label className="text-[10px] font-bold text-[#8993A3] uppercase tracking-wider block">Private Mode Status</label>
                    <div className="flex items-center gap-2">
                      <span className={`w-2.5 h-2.5 rounded-full ${privateMode ? 'bg-[#19C77A]' : 'bg-[#5F6978]'}`} />
                      <span className="font-semibold text-white text-xs">{privateMode ? 'PRIVATE_MODE = true' : 'Public Access'}</span>
                    </div>
                    <p className="text-[10px] text-[#5F6978]">Public registration locked. Admin approval required.</p>
                  </div>
                  <div className="p-4 rounded-xl bg-[#0B121D]/80 border border-white/[0.05] space-y-2">
                    <label className="text-[10px] font-bold text-[#8993A3] uppercase tracking-wider block">Max Private Users</label>
                    <input type="number" min="3" max="50" value={maxPrivateUsers} onChange={(e) => setMaxPrivateUsers(parseInt(e.target.value) || 5)} className="sp-admin-input font-mono" />
                    <p className="text-[10px] text-[#5F6978]">Target pilot size: 3–5 trusted members.</p>
                  </div>
                  <div className="p-4 rounded-xl bg-[#0B121D]/80 border border-white/[0.05] space-y-2">
                    <label className="text-[10px] font-bold text-[#8993A3] uppercase tracking-wider block">Max Devices Per User</label>
                    <input type="number" min="1" max="10" value={maxDevicesPerUser} onChange={(e) => setMaxDevicesPerUser(parseInt(e.target.value) || 2)} className="sp-admin-input font-mono" />
                    <p className="text-[10px] text-[#5F6978]">Concurrency cap for household devices.</p>
                  </div>
                </div>
                <div className="flex items-center justify-end">
                  <button onClick={handleSavePilotSettings} className="sp-admin-primary">Save Pilot Configuration</button>
                </div>
              </div>

              <div className="sp-admin-card p-5 sm:p-7 space-y-4">
                <h3 className="text-sm font-bold text-white">SECP Corporate Incorporation &amp; Commercial Readiness</h3>
                <p className="text-[10.5px] text-[#8993A3] leading-relaxed max-w-2xl">Commercial checkout, public pricing, and reseller advertising are safely disabled during this private pilot. Payment and subscription models are preserved for activation once regulatory filings are finalized.</p>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {[
                    { k: 'COMMERCIAL_MODE', v: 'false (Disabled)', tone: 'text-[#FF8DA0]' },
                    { k: 'PUBLIC_REGISTRATION', v: 'false (Disabled)', tone: 'text-[#FF8DA0]' },
                    { k: 'PAYMENTS_ENABLED', v: 'false (Disabled)', tone: 'text-[#FF8DA0]' },
                    { k: 'SECP FILING STATUS', v: 'In Preparation', tone: 'text-[#F6CD85]' },
                  ].map((s) => (
                    <div key={s.k} className="p-3 rounded-xl bg-[#0B121D]/80 border border-white/[0.05]">
                      <span className="text-[9.5px] text-[#5F6978] block">{s.k}</span>
                      <span className={`font-mono text-[11px] font-bold ${s.tone}`}>{s.v}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ================================================== */}
          {/* TAB 9: CONTENT & TAKEDOWNS (cinema)                */}
          {/* ================================================== */}
          {activeTab === 'cinema' && (
            <div className="space-y-8">
              <div className="sp-admin-card p-5">
                <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
                  <div>
                    <h3 className="text-sm font-bold text-white">Verified Broadcaster Channels</h3>
                    <p className="text-[10px] text-[#5F6978] mt-0.5">Statutory public broadcasters and official open-license live streams.</p>
                  </div>
                  <button onClick={() => setShowAddChannel(true)} className="sp-admin-primary !min-h-[40px]"><Plus className="w-4 h-4" /> Add Broadcaster</button>
                </div>
                <div className="sp-admin-table-wrap !shadow-none">
                  <table className="sp-admin-table">
                    <thead><tr><th>Channel</th><th>Category</th><th>Provenance</th><th>Status</th><th className="text-right">Actions</th></tr></thead>
                    <tbody>
                      {channels.map((chan) => (
                        <tr key={chan.id}>
                          <td>
                            <div className="flex items-center gap-2 font-semibold text-white">
                              <img src={chan.logo} alt="" referrerPolicy="no-referrer" className="w-5 h-5 object-contain" />
                              <span>{chan.channelName}</span>
                            </div>
                          </td>
                          <td>{chan.category}</td>
                          <td className="font-mono text-[10px] text-[#8FC3FF]">{chan.rightsStatus}</td>
                          <td><span className={`sp-admin-badge ${chan.enabled ? 'sp-admin-badge-success' : 'sp-admin-badge-danger'}`}>{chan.enabled ? 'Active' : 'Disabled'}</span></td>
                          <td className="text-right">
                            <button onClick={() => handleToggleChannel(chan.id, chan.enabled)} className={`sp-admin-badge ${chan.enabled ? 'sp-admin-badge-danger' : 'sp-admin-badge-success'} cursor-pointer`}>{chan.enabled ? 'Disable' : 'Enable'}</button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="sp-admin-card p-5">
                <h3 className="text-sm font-bold text-white mb-4">Cinema Catalog &amp; License Provenance</h3>
                <div className="sp-admin-table-wrap !shadow-none">
                  <table className="sp-admin-table">
                    <thead><tr><th>Title</th><th>Year</th><th>License</th><th>State</th><th className="text-right">Actions</th></tr></thead>
                    <tbody>
                      {movies.map((mov) => (
                        <tr key={mov.id}>
                          <td className="font-semibold text-white">{mov.title}</td>
                          <td>{mov.year}</td>
                          <td className="text-[#C6CBD4]">{mov.license}</td>
                          <td><span className={`sp-admin-badge ${mov.enabled ? 'sp-admin-badge-success' : 'sp-admin-badge-danger'}`}>{mov.enabled ? 'Published' : 'Disabled'}</span></td>
                          <td className="text-right">
                            <button onClick={() => handleToggleMovie(mov.id, mov.enabled)} className={`sp-admin-badge ${mov.enabled ? 'sp-admin-badge-danger' : 'sp-admin-badge-success'} cursor-pointer`}>{mov.enabled ? 'Disable' : 'Enable'}</button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="sp-admin-card p-5">
                <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
                  <div>
                    <h3 className="text-sm font-bold text-white">Copyright &amp; DMCA Notice Review Queue</h3>
                    <p className="text-[10px] text-[#5F6978] mt-0.5">Notice &amp; takedown statutory compliance workflow.</p>
                  </div>
                  <button onClick={() => onNavigate('takedown')} className="text-xs font-semibold text-[#FF2E55] hover:underline">View Public Form</button>
                </div>
                {takedowns.length === 0 ? (
                  <div className="sp-admin-empty">
                    <ShieldAlert className="w-8 h-8 mx-auto mb-2 text-[#5F6978]" />
                    <p className="text-xs font-semibold text-[#C6CBD4]">No copyright reports</p>
                    <p className="text-[10px] text-[#5F6978] mt-1">Submitted takedown notices will queue here for review.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {takedowns.map((ticket) => (
                      <div key={ticket.id} className="p-4 rounded-xl bg-[#0B121D]/80 border border-white/[0.06] space-y-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <ShieldAlert className="w-4 h-4 text-[#F2B84B]" />
                            <span className="font-bold text-white text-xs">Ticket #{ticket.id} — {ticket.contentTitle}</span>
                          </div>
                          <span className="sp-admin-badge sp-admin-badge-warning">{ticket.status}</span>
                        </div>
                        <p className="text-xs text-[#C6CBD4]">Claimant: {ticket.claimantName} ({ticket.claimantEmail})</p>
                        <p className="text-xs text-[#8993A3] italic">"{ticket.statement}"</p>
                        {ticket.status !== 'ACCEPTED_REMOVED' && (
                          <div className="flex items-center gap-2 pt-1">
                            <button onClick={() => handleProcessTakedown(ticket.id, 'DISABLE_AND_ACCEPT')} className="px-3 py-1.5 rounded-lg bg-[#FF4D67] hover:bg-[#E5093A] text-white text-[11px] font-semibold transition-colors">Disable Content &amp; Accept</button>
                            <button onClick={() => handleProcessTakedown(ticket.id, 'REJECT')} className="sp-admin-secondary !min-h-[36px] !text-[11px]">Reject (Verified)</button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Add Channel Modal */}
              {showAddChannel && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
                  <div className="w-full max-w-md rounded-2xl bg-[#0D1520] border border-white/[0.08] p-6 shadow-[0_22px_55px_rgba(0,0,0,0.38)]">
                    <h3 className="text-sm font-bold text-white mb-4">Add Verified Broadcaster Stream</h3>
                    <div className="space-y-3 mb-6">
                      <div>
                        <label className="text-[10.5px] font-semibold text-[#8993A3] block mb-1.5">Channel Name</label>
                        <input type="text" value={newChanName} onChange={(e) => setNewChanName(e.target.value)} placeholder="e.g. NHK World English" className="sp-admin-input" />
                      </div>
                      <div>
                        <label className="text-[10.5px] font-semibold text-[#8993A3] block mb-1.5">Direct Stream URL (.m3u8)</label>
                        <input type="text" value={newChanStream} onChange={(e) => setNewChanStream(e.target.value)} placeholder="https://.../index.m3u8" className="sp-admin-input font-mono !text-[11px]" />
                      </div>
                      <div>
                        <label className="text-[10.5px] font-semibold text-[#8993A3] block mb-1.5">Source Name</label>
                        <input type="text" value={newChanSource} onChange={(e) => setNewChanSource(e.target.value)} placeholder="e.g. Official Public Web Feed" className="sp-admin-input" />
                      </div>
                      <div>
                        <label className="text-[10.5px] font-semibold text-[#8993A3] block mb-1.5">Category</label>
                        <select value={newChanCategory} onChange={(e) => setNewChanCategory(e.target.value as any)} className="sp-admin-select">
                          <option value="News">News</option>
                          <option value="Science & Tech">Science &amp; Tech</option>
                          <option value="Sports">Sports</option>
                          <option value="Culture">Culture</option>
                        </select>
                      </div>
                    </div>
                    <div className="flex items-center justify-end gap-2">
                      <button onClick={() => setShowAddChannel(false)} className="sp-admin-secondary !min-h-[38px]">Cancel</button>
                      <button onClick={handleAddChannel} className="sp-admin-primary">Save &amp; Activate</button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ================================================== */}
          {/* CREATOR HUB (admin console)                        */}
          {/* ================================================== */}
          {activeTab === 'creatorhub' && (
            <AdminCreatorHub />
          )}

          {/* ================================================== */}
          {/* TAB 10: LOGS                                       */}
          {/* ================================================== */}
          {activeTab === 'logs' && (
            <div className="space-y-6">
              <div className="sp-admin-card p-5">
                <h3 className="text-sm font-bold text-white mb-0.5">System Administration Audit Trail</h3>
                <p className="text-[10px] text-[#5F6978] mb-4">Real-time audit records of all administrative actions, takedown decisions, and member status transitions.</p>
                {adminLogs.length === 0 ? (
                  <div className="sp-admin-empty"><ScrollText className="w-8 h-8 mx-auto mb-2 text-[#5F6978]" /><p className="text-xs font-semibold text-[#C6CBD4]">No logs yet</p></div>
                ) : (
                  <div className="space-y-2 font-mono text-[10.5px] max-h-96 overflow-y-auto">
                    {adminLogs.map((log) => {
                      const isError = /ERROR|FAIL/i.test(log.action);
                      const isWarn = /TAKEDOWN|DISABLE|DELETE/i.test(log.action);
                      return (
                        <div key={log.id} className="p-2.5 rounded-lg bg-[#0B121D]/80 border border-white/[0.05] flex items-center gap-3">
                          <span className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase shrink-0 ${isError ? 'bg-[#FF4D67]/15 text-[#FF8DA0]' : isWarn ? 'bg-[#F2B84B]/15 text-[#F6CD85]' : 'bg-[#19C77A]/15 text-[#5FE0A8]'}`}>{isError ? 'ERROR' : isWarn ? 'WARN' : 'INFO'}</span>
                          <span className="font-bold text-[#FF2E55] shrink-0">{log.action}</span>
                          <span className="text-[#C6CBD4] flex-1 truncate">{log.details}</span>
                          <span className="text-[#5F6978] text-[9.5px] shrink-0">{new Date(log.timestamp).toLocaleString()}</span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {iptvLogs.length > 0 && (
                <div className="sp-admin-card p-5">
                  <h3 className="text-sm font-bold text-white mb-3">Star IPTV Diagnostic Event Log</h3>
                  <div className="space-y-2 font-mono text-[10.5px] max-h-60 overflow-y-auto">
                    {iptvLogs.map((log) => (
                      <div key={log.id} className="p-2 rounded-lg bg-[#0B121D]/80 border border-white/[0.05] flex items-center gap-3">
                        <span className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase shrink-0 ${log.level === 'error' ? 'bg-[#FF4D67]/15 text-[#FF8DA0]' : log.level === 'warn' ? 'bg-[#F2B84B]/15 text-[#F6CD85]' : 'bg-[#56A8FF]/15 text-[#8FC3FF]'}`}>{log.action}</span>
                        <span className="text-[#C6CBD4] flex-1 truncate">{log.message}</span>
                        <span className="text-[#5F6978] text-[9.5px] shrink-0">{new Date(log.timestamp).toLocaleTimeString()}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </main>
      </div>
    </div>
  );
};
