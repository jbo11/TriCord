import { Fragment, lazy, Suspense, type CSSProperties, type FormEvent, type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Archive,
  ArchiveRestore,
  ArrowUpDown,
  Bell,
  Banknote,
  BriefcaseBusiness,
  Bug,
  Camera,
  CalendarDays,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleHelp,
  Clock3,
  ClipboardList,
  Copy,
  CreditCard,
  Download,
  EllipsisVertical,
  File as FileIcon,
  FileText,
  Filter,
  Globe2,
  ChartNoAxesCombined,
  GripVertical,
  Headphones,
  Image as ImageIcon,
  Inbox,
  Link2,
  Info,
  LayoutGrid,
  List,
  Loader2,
  LogOut,
  Mail,
  Menu,
  MessageSquare,
  Moon,
  PanelRightClose,
  PanelRightOpen,
  Palette,
  Pencil,
  Phone,
  Pin,
  PinOff,
  Plus,
  Reply as ReplyIcon,
  Search,
  Send,
  Settings,
  Share2,
  ShieldCheck,
  Smile,
  Sun,
  Trash2,
  User,
  UserPlus,
  X,
  type LucideIcon,
} from 'lucide-react';
import { type RealtimeChannel, type Session } from '@supabase/supabase-js';
import { cn, formatTimeAgo } from './lib/utils';
import { isSupabaseConfigured, supabase } from './lib/supabase';
import { canOpenView, hasWorkspaceCapability } from './lib/permissions';
import { WorkforceModule } from './components/workforce/WorkforceModules';
import { MarketingHome } from './components/MarketingHome';
import triCordLogo from './assets/tricord-logo.png';
import {
  AppComment,
  AppAttachment,
  AppLinkPreview,
  AppMembership,
  AppReaction,
  AppPost,
  AppProfile,
  AppSpace,
  AppTask,
  AppWorkspace,
  BusinessModuleKey,
  BusinessModules,
  KnowledgeArticle,
  KnowledgeCategory,
  SpaceAccess,
  SortMode,
  TaskPriority,
  TaskStatus,
  UserEmailAccount,
  UserPrivateProfile,
  ViewMode,
  WorkspaceCapabilities,
  WorkspaceRole,
} from './types';

const sortOptions: { value: SortMode; label: string }[] = [
  { value: 'active', label: 'Active' },
  { value: 'newest', label: 'Newest' },
  { value: 'assigned', label: 'Assigned' },
  { value: 'archived', label: 'Archived' },
];

const workspaceRoles: { role: WorkspaceRole; detail: string }[] = [
  { role: 'owner', detail: 'Hub ownership, billing, security, and deletion.' },
  { role: 'admin', detail: 'Members, rooms, integrations, policies, and audit visibility.' },
  { role: 'member', detail: 'Posts, replies, files, tasks, and hub search.' },
  { role: 'guest', detail: 'Only invited rooms and assigned work.' },
];

const knowledgeCategories: { value: KnowledgeCategory; label: string }[] = [
  { value: 'documentation', label: 'Documentation' },
  { value: 'how_to', label: 'How-to guide' },
  { value: 'faq', label: 'FAQ' },
  { value: 'best_practice', label: 'Best practice' },
  { value: 'troubleshooting', label: 'Troubleshooting' },
  { value: 'sop', label: 'Standard operating procedure' },
];

const INVITE_STORAGE_KEY = 'tricord_invite_token';
const BASIC_PROFILE_SELECT = 'id, email, display_name, avatar_url, timezone';
const PROFILE_SELECT = 'id, email, display_name, full_name, nickname, avatar_url, timezone';
const linkPreviewCache = new Map<string, AppLinkPreview>();
const THREAD_WIDTH_STORAGE_KEY = 'tricord_thread_width';
const THEME_STORAGE_KEY = 'tricord_theme';
const CHAT_OPEN_STORAGE_KEY = 'tricord_chat_open';
const ACCENT_STORAGE_KEY = 'tricord_accent';
const WORKSPACE_STORAGE_KEY = 'tricord_workspace_id';
const ROUTE_REDIRECT_STORAGE_KEY = 'tricord_redirect_path';
const REPLY_DRAFT_STORAGE_KEY = 'tricord_reply_draft';
const FORM_DRAFT_STORAGE_KEY = 'tricord_form_draft';
const NOTIFICATION_PREFS_STORAGE_KEY = 'tricord_notification_preferences';
const UNREAD_SEEN_STORAGE_KEY = 'tricord_unread_seen';
const ROOM_COMPACT_STORAGE_KEY = 'tricord_room_compact';
const MAX_DIRECT_UPLOAD_BYTES = 20 * 1024 * 1024;
const MAX_ATTACHMENTS_PER_MESSAGE = 10;
const MAX_MESSAGE_CHARACTERS = 10000;
const BLOCKED_FILE_EXTENSIONS = new Set(['ade', 'adp', 'apk', 'app', 'bat', 'bin', 'cmd', 'com', 'cpl', 'dll', 'dmg', 'exe', 'gadget', 'hta', 'ins', 'iso', 'jar', 'js', 'jse', 'lib', 'lnk', 'mde', 'msc', 'msi', 'msp', 'mst', 'osx', 'pif', 'ps1', 'scr', 'sh', 'sys', 'vb', 'vbe', 'vbs', 'vxd', 'ws', 'wsc', 'wsf', 'wsh']);
const GOOGLE_DRIVE_API_KEY = (import.meta.env.VITE_GOOGLE_API_KEY as string | undefined)?.trim();
const GOOGLE_DRIVE_CLIENT_ID = (import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined)?.trim();
const GOOGLE_DRIVE_PICKER_SCOPE = 'https://www.googleapis.com/auth/drive.metadata.readonly';
const INBOUND_EMAIL_DOMAIN = ((import.meta.env.VITE_INBOUND_EMAIL_DOMAIN as string | undefined)?.trim() || 'room.tricord.cc').replace(/^@/, '').replace(/\/$/, '').toLowerCase();
const PUBLIC_ASSET_BASE = import.meta.env.BASE_URL || '/';
const USER_GUIDE_URL = `${PUBLIC_ASSET_BASE.replace(/\/$/, '')}/tricord-user-guide.pdf`;
const googleScriptPromises = new Map<string, Promise<void>>();
const EmojiPicker = lazy(() => import('emoji-picker-react'));

type AccentColor = 'tangerine' | 'violet' | 'blue' | 'teal' | 'rose';

const accentPalettes: Record<AccentColor, { label: string; accent: string; strong: string; soft: string; muted: string; ink: string }> = {
  tangerine: { label: 'Tangerine', accent: '#F97316', strong: '#C2410C', soft: '#FFEDD5', muted: '#FDBA74', ink: '#431407' },
  violet: { label: 'Violet', accent: '#7C3AED', strong: '#5B21B6', soft: '#EDE9FE', muted: '#A78BFA', ink: '#2E1065' },
  blue: { label: 'Blue', accent: '#2563EB', strong: '#1D4ED8', soft: '#DBEAFE', muted: '#60A5FA', ink: '#172554' },
  teal: { label: 'Teal', accent: '#0D9488', strong: '#0F766E', soft: '#CCFBF1', muted: '#5EEAD4', ink: '#042F2E' },
  rose: { label: 'Rose', accent: '#E11D48', strong: '#BE123C', soft: '#FFE4E6', muted: '#FB7185', ink: '#4C0519' },
};

type BillingInterval = 'monthly' | 'yearly';
type PaidPlan = 'tricord';
type LaunchPlan = 'tricord';

const STANDARD_HUB_EMPLOYEE_LIMIT = 25;
const STANDARD_HUB_MONTHLY_PRICE = 29;
const STANDARD_HUB_YEARLY_PRICE = 290;

const launchPlans: Array<{
  id: LaunchPlan;
  name: string;
  monthly: string;
  annual: string;
  description: string;
  highlights: string[];
}> = [
  {
    id: 'tricord',
    name: 'Standard Hub',
    monthly: '$29/month',
    annual: '$290/year',
    description: 'One complete Hub for teams up to 25 employees, with collaboration, rooms, tasks, CRM, recruitment, knowledge, attendance, storage, and mailbox capacity included.',
    highlights: ['Up to 25 employees', '25 mailboxes; shared mailboxes are not included', '25 GB Hub storage', 'Unlimited rooms, messages, tasks, CRM, recruitment, knowledge base, and attendance', 'Contact us for teams with more than 25 employees'],
  },
];

interface ForwardableMessage {
  body: string;
  attachments: AppAttachment[];
}

type ExternalAttachmentProvider = 'google_drive' | 'gmail' | 'outlook';

interface ExternalAttachmentDraft {
  provider: ExternalAttachmentProvider;
  url: string;
  title: string;
  mimeType?: string;
  iconUrl?: string;
  sizeBytes?: number;
}

interface RoomPreference {
  space_id: string;
  position: number;
  pinned: boolean;
}

interface RoomCompactSettings {
  all: boolean;
  rooms: Record<string, boolean>;
}

type AccountModalView = 'personalization' | 'profile' | 'settings' | 'subscription' | 'notifications' | 'help' | 'about' | 'report';
interface HubSetup { name: string; countryCode: string; currencyCode: string; locale: string; timezone: string; dateFormat: string; payrollFrequency: string; firstDayOfWeek: number }

interface ConfirmDialogState {
  title: string;
  body: string;
  confirmLabel?: string;
  onConfirm: () => Promise<void> | void;
}

interface NotificationPreferences {
  desktop: boolean;
  sound: boolean;
  tabBadges: boolean;
  mentions: boolean;
  directMessages: boolean;
  taskAssignments: boolean;
  announcements: boolean;
  email: boolean;
}

const DEFAULT_NOTIFICATION_PREFERENCES: NotificationPreferences = {
  desktop: false,
  sound: false,
  tabBadges: true,
  mentions: true,
  directMessages: true,
  taskAssignments: true,
  announcements: true,
  email: false,
};
interface BusinessModuleConfig {
  key: BusinessModuleKey;
  title: string;
  shortLabel: string;
  description: string;
  noticeTitle: string;
  noticeBody: string;
}

const BUSINESS_MODULE_NOTICE_VERSION = '2026-07-14';

const DEFAULT_BUSINESS_MODULES: BusinessModules = {
  attendance_tracking: false,
  employee_records: false,
  payroll_preparation: false,
};

const BUSINESS_MODULE_CONFIGS: BusinessModuleConfig[] = [
  {
    key: 'attendance_tracking',
    title: 'Attendance Tracking',
    shortLabel: 'Attendance',
    description: 'Let Admins and Members clock in and out, while authorized leaders review records and optional verification details.',
    noticeTitle: 'Attendance Tracking Notice',
    noticeBody: 'This feature is provided as a recordkeeping tool only. TriCord does not certify attendance records for payroll, labor law compliance, or regulatory purposes. Your organization is responsible for ensuring compliance with all applicable employment laws in your jurisdiction.',
  },
  {
    key: 'employee_records',
    title: 'Employee Records',
    shortLabel: 'Employee Records',
    description: 'Organize employee profiles, leave requests, documents, performance notes, and role-protected records.',
    noticeTitle: 'Employee Records Notice',
    noticeBody: 'TriCord stores employee information as provided by your organization. Your organization is responsible for complying with all applicable privacy, employment, and recordkeeping laws.',
  },
  {
    key: 'payroll_preparation',
    title: 'Payroll Preparation',
    shortLabel: 'Payroll Prep',
    description: 'Organize compensation inputs, employee-specific items, payment details, and draft preparation periods for owner review.',
    noticeTitle: 'Payroll Preparation Notice',
    noticeBody: 'TriCord assists in organizing compensation and payroll-preparation records. TriCord is not a payroll processor, tax advisor, legal advisor, or HR consulting service. TriCord does not process payroll, calculate taxes, file payroll returns, submit government reports, or guarantee compliance with labor, payroll, tax, privacy, or employment laws. Your organization remains responsible for reviewing all records and complying with applicable laws.',
  },
];


interface BusinessModuleDisclosureState {
  module: BusinessModuleConfig;
  nextModules: BusinessModules;
}



function readStoredJson<T>(key: string, fallback: T): T {
  if (!key || typeof window === 'undefined') return fallback;
  try {
    const stored = window.localStorage.getItem(key);
    if (!stored) return fallback;
    return { ...fallback, ...JSON.parse(stored) } as T;
  } catch {
    return fallback;
  }
}

function isEmptyDraftValue(value: unknown): boolean {
  if (value == null) return true;
  if (typeof value === 'string') return value.trim() === '';
  if (Array.isArray(value)) return value.length === 0;
  if (typeof value === 'object') return Object.values(value as Record<string, unknown>).every(isEmptyDraftValue);
  return false;
}

function usePersistentDraft<T>(storageKey: string, initialValue: T, isEmpty: (value: T) => boolean = (value) => isEmptyDraftValue(value)) {
  const [draft, setDraft] = useState<T>(() => readStoredJson(storageKey, initialValue));
  const loadedKeyRef = useRef(storageKey);
  const skipSaveRef = useRef(false);

  useEffect(() => {
    loadedKeyRef.current = storageKey;
    skipSaveRef.current = true;
    setDraft(readStoredJson(storageKey, initialValue));
  }, [storageKey, initialValue]);

  useEffect(() => {
    if (!storageKey || loadedKeyRef.current !== storageKey || typeof window === 'undefined') return;
    if (skipSaveRef.current) {
      skipSaveRef.current = false;
      return;
    }
    if (isEmpty(draft)) window.localStorage.removeItem(storageKey);
    else window.localStorage.setItem(storageKey, JSON.stringify(draft));
  }, [draft, isEmpty, storageKey]);

  const clearDraft = useCallback(() => {
    if (storageKey && typeof window !== 'undefined') window.localStorage.removeItem(storageKey);
    skipSaveRef.current = true;
    setDraft(initialValue);
  }, [initialValue, storageKey]);

  return [draft, setDraft, clearDraft] as const;
}

function getFormDraftKey(kind: string, userId: string, workspaceId: string, recordId = 'new') {
  return [FORM_DRAFT_STORAGE_KEY, userId, workspaceId, kind, recordId].filter(Boolean).join(':');
}

function getNotificationPreferenceKey(userId: string) {
  return `${NOTIFICATION_PREFS_STORAGE_KEY}:${userId}`;
}

function getUnreadSeenKey(userId: string, workspaceId: string) {
  return `${UNREAD_SEEN_STORAGE_KEY}:${userId}:${workspaceId}`;
}

function includesCurrentUserMention(body: string, profile?: AppProfile) {
  if (!profile) return false;
  const aliases = [profile.nickname, profile.display_name, profile.full_name, profile.email]
    .filter(Boolean)
    .map((value) => String(value).toLowerCase().replace(/\s+/g, ' ').trim());
  const normalized = body.toLowerCase().replace(/\s+/g, ' ');
  return aliases.some((alias) => alias && (normalized.includes(`@${alias}`) || normalized.includes(`@${alias.split('@')[0]}`)));
}

function updateFaviconBadge(count: number, enabled: boolean) {
  if (typeof document === 'undefined') return;
  let icon = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
  if (!icon) {
    icon = document.createElement('link');
    icon.rel = 'icon';
    document.head.appendChild(icon);
  }
  if (!enabled || count <= 0) {
    icon.href = `${PUBLIC_ASSET_BASE.replace(/\/$/, '')}/favicon.ico`;
    return;
  }
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 64;
  const context = canvas.getContext('2d');
  if (!context) return;
  context.fillStyle = '#F97316';
  context.beginPath();
  context.moveTo(18, 6);
  context.lineTo(46, 6);
  context.quadraticCurveTo(58, 6, 58, 18);
  context.lineTo(58, 46);
  context.quadraticCurveTo(58, 58, 46, 58);
  context.lineTo(18, 58);
  context.quadraticCurveTo(6, 58, 6, 46);
  context.lineTo(6, 18);
  context.quadraticCurveTo(6, 6, 18, 6);
  context.closePath();
  context.fill();
  context.fillStyle = '#DC2626';
  context.beginPath();
  context.arc(46, 18, 15, 0, Math.PI * 2);
  context.fill();
  context.fillStyle = '#FFFFFF';
  context.font = 'bold 18px system-ui, sans-serif';
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.fillText(count > 9 ? '9+' : String(count), 46, 18);
  icon.href = canvas.toDataURL('image/png');
}

function playNotificationTone() {
  try {
    const AudioContextClass = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return;
    const context = new AudioContextClass();
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = 'sine';
    oscillator.frequency.value = 740;
    gain.gain.setValueAtTime(0.001, context.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.08, context.currentTime + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + 0.18);
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start();
    oscillator.stop(context.currentTime + 0.2);
  } catch {
    // Ignore browsers that block programmatic audio until the next user gesture.
  }
}

export default function App() {
  const [theme, setTheme] = useState<'light' | 'dark'>(getInitialTheme);
  const [accentColor, setAccentColor] = useState<AccentColor>(getInitialAccentColor);
  const [routeKey, setRouteKey] = useState(getInitialRouteKey);
  const [session, setSession] = useState<Session | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [view, setView] = useState<ViewMode>('feed');
  const [sort, setSort] = useState<SortMode>('active');
  const [query, setQuery] = useState('');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [workspaces, setWorkspaces] = useState<AppWorkspace[]>([]);
  const [workspaceId, setWorkspaceId] = useState('');
  const [spaces, setSpaces] = useState<AppSpace[]>([]);
  const [roomPreferences, setRoomPreferences] = useState<Record<string, RoomPreference>>({});
  const [activeSpaceId, setActiveSpaceId] = useState('all');
  const [posts, setPosts] = useState<AppPost[]>([]);
  const [comments, setComments] = useState<AppComment[]>([]);
  const [attachments, setAttachments] = useState<AppAttachment[]>([]);
  const [reactions, setReactions] = useState<AppReaction[]>([]);
  const [profiles, setProfiles] = useState<Record<string, AppProfile>>({});
  const [privateProfile, setPrivateProfile] = useState<UserPrivateProfile | null>(null);
  const [capabilities, setCapabilities] = useState<WorkspaceCapabilities | null>(null);
  const [tasks, setTasks] = useState<AppTask[]>([]);
  const [memberships, setMemberships] = useState<AppMembership[]>([]);
  const [knowledgeArticles, setKnowledgeArticles] = useState<KnowledgeArticle[]>([]);
  const [emailAccounts, setEmailAccounts] = useState<UserEmailAccount[]>([]);
  const [selectedEmailAccountId, setSelectedEmailAccountId] = useState('');
  const [selectedPostId, setSelectedPostId] = useState('');
  const [loading, setLoading] = useState(true);
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);
  const [notice, setNotice] = useState('');
  const [composerOpen, setComposerOpen] = useState(false);
  const [spaceModalOpen, setSpaceModalOpen] = useState(false);
  const [hubModalOpen, setHubModalOpen] = useState(false);
  const [renamingSpace, setRenamingSpace] = useState<AppSpace | null>(null);
  const [forwardingRoom, setForwardingRoom] = useState<AppSpace | null>(null);
  const [taskModalOpen, setTaskModalOpen] = useState(false);
  const [accountModal, setAccountModal] = useState<AccountModalView | null>(null);
  const [billingModalOpen, setBillingModalOpen] = useState(false);
  const [billingError, setBillingError] = useState('');
  const [confirmDialog, setConfirmDialog] = useState<ConfirmDialogState | null>(null);
  const [businessModuleDisclosure, setBusinessModuleDisclosure] = useState<BusinessModuleDisclosureState | null>(null);
  const billingSeatSyncKeyRef = useRef('');
  const [editingPost, setEditingPost] = useState<AppPost | null>(null);
  const [editingTask, setEditingTask] = useState<AppTask | null>(null);
  const [knowledgeModalOpen, setKnowledgeModalOpen] = useState(false);
  const [editingKnowledgeArticle, setEditingKnowledgeArticle] = useState<KnowledgeArticle | null>(null);
  const [inviteToken, setInviteToken] = useState(getInitialInviteToken);
  const [inviteAcceptError, setInviteAcceptError] = useState('');
  const [threadWidth, setThreadWidth] = useState(getInitialThreadWidth);
  const [chatOpen, setChatOpen] = useState(true);
  const [chatOnOtherPages, setChatOnOtherPages] = useState(getInitialChatOpen);
  const [notificationPreferences, setNotificationPreferences] = useState<NotificationPreferences>(DEFAULT_NOTIFICATION_PREFERENCES);
  const [lastSeenActivityAt, setLastSeenActivityAt] = useState(new Date().toISOString());
  const selectedPostIdRef = useRef('');
  const commentsSignatureRef = useRef('');
  const workspaceChannelRef = useRef<RealtimeChannel | null>(null);
  const previousUnreadCountRef = useRef(0);

  const spaceIdsKey = spaces.map((space) => space.id).join(',');

  const selectedWorkspace = workspaces.find((workspace) => workspace.id === workspaceId);
  const currentRole = selectedWorkspace?.role;
  const hasCapability = useCallback((capability: keyof Omit<WorkspaceCapabilities, 'workspace_id' | 'user_id'>) => (
    hasWorkspaceCapability(currentRole, capabilities, capability)
  ), [capabilities, currentRole]);
  const canManageMembers = hasCapability('manage_members');
  const canManageRooms = hasCapability('manage_rooms');
  const canManageKnowledge = hasCapability('manage_knowledge');
  const savedBusinessModules = useMemo(() => getBusinessModules(selectedWorkspace), [selectedWorkspace]);
  const subscriptionState = getWorkspaceSubscriptionState(selectedWorkspace);
  const workspaceReadOnly = subscriptionState.status === 'expired' || subscriptionState.status === 'cancelled';
  const premiumFeatures = true;
  const businessModules = savedBusinessModules;
  const canViewTimekeeping = businessModules.attendance_tracking && canOpenView('timekeeping', currentRole, capabilities);
  const canViewHr = businessModules.employee_records && canOpenView('hr', currentRole, capabilities);
  const canViewPayroll = businessModules.payroll_preparation && canOpenView('payroll', currentRole, capabilities);
  const canViewReports = (businessModules.attendance_tracking || businessModules.employee_records || businessModules.payroll_preparation) && hasCapability('view_reports');
  const canManageAdmin = currentRole === 'owner' || canManageMembers || canManageRooms || canManageKnowledge || hasCapability('view_audit');
  const canModerateContent = currentRole === 'owner' || currentRole === 'admin';
  const showThreadPanel = chatOpen;
  const selectedPost = posts.find((post) => post.id === selectedPostId && (activeSpaceId === 'all' || post.space_id === activeSpaceId))
    ?? posts.find((post) => post.state !== 'archived' && (activeSpaceId === 'all' || post.space_id === activeSpaceId));
  const selectedProfile = selectedPost ? profiles[selectedPost.author_id] : undefined;
  const selectedPostRoom = selectedPost ? spaces.find((space) => space.id === selectedPost.space_id) : undefined;
  const fallbackSenderAddress = selectedPostRoom ? getRoomForwardingAddress(selectedPostRoom) : selectedWorkspace ? `${slugify(selectedWorkspace.name) || 'room'}@${INBOUND_EMAIL_DOMAIN}` : `room@${INBOUND_EMAIL_DOMAIN}`;
  const currentProfile = session?.user.id && profiles[session.user.id]
    ? { ...profiles[session.user.id], ...privateProfile }
    : undefined;
  const ownerEmail = profiles[memberships.find((membership) => membership.role === 'owner')?.user_id ?? '']?.email ?? '';
  const memberProfiles = useMemo(
    () => (Object.values(profiles) as AppProfile[]).sort((a, b) => getProfileName(a).localeCompare(getProfileName(b))),
    [profiles],
  );
  const hubMentionProfiles = useMemo(
    () => memberships
      .map((membership) => profiles[membership.user_id])
      .filter((profile): profile is AppProfile => Boolean(profile))
      .sort((a, b) => getProfileName(a).localeCompare(getProfileName(b))),
    [memberships, profiles],
  );
  const billableSeatCount = useMemo(
    () => Math.max(memberships.filter((membership) => membership.role !== 'guest').length, 1),
    [memberships],
  );
  const notificationPrefsKey = session?.user.id ? getNotificationPreferenceKey(session.user.id) : '';
  const unreadSeenKey = session?.user.id && workspaceId ? getUnreadSeenKey(session.user.id, workspaceId) : '';
  const unreadActivityCount = useMemo(() => {
    if (!session?.user.id || !workspaceId || !lastSeenActivityAt) return 0;
    const cutoff = Date.parse(lastSeenActivityAt);
    if (!Number.isFinite(cutoff)) return 0;
    const currentUserId = session.user.id;
    const currentUserProfile = profiles[currentUserId];
    const newComments = comments.filter((comment) => comment.author_id !== currentUserId && Date.parse(comment.created_at) > cutoff);
    const mentionCommentIds = new Set(newComments.filter((comment) => includesCurrentUserMention(comment.body, currentUserProfile)).map((comment) => comment.id));
    const mentionCount = notificationPreferences.mentions ? mentionCommentIds.size : 0;
    const commentCount = notificationPreferences.directMessages
      ? newComments.filter((comment) => !mentionCommentIds.has(comment.id)).length
      : 0;
    const postCount = notificationPreferences.announcements
      ? posts.filter((post) => post.author_id !== currentUserId && Date.parse(post.created_at) > cutoff).length
      : 0;
    const assignedTaskCount = notificationPreferences.taskAssignments
      ? tasks.filter((task) => task.assignee_id === currentUserId && Date.parse(task.created_at) > cutoff).length
      : 0;
    return commentCount + mentionCount + postCount + assignedTaskCount;
  }, [comments, lastSeenActivityAt, notificationPreferences.announcements, notificationPreferences.directMessages, notificationPreferences.mentions, notificationPreferences.taskAssignments, posts, profiles, session?.user.id, tasks, workspaceId]);

  const markWorkspaceActivitySeen = useCallback(() => {
    if (!unreadSeenKey || typeof window === 'undefined') return;
    const now = new Date().toISOString();
    window.localStorage.setItem(unreadSeenKey, now);
    setLastSeenActivityAt(now);
  }, [unreadSeenKey]);

  const openBillingPortal = useCallback(async () => {
    if (!supabase || !workspaceId) return;
    try {
      setNotice('');
      setBillingError('');
      const { data, error } = await supabase.functions.invoke('create-billing-portal-session', { body: { workspaceId } });
      if (error) throw new Error(await getFunctionErrorMessage(error));
      const url = (data as { url?: string } | null)?.url;
      if (!url) throw new Error('Billing portal did not return a redirect URL.');
      window.location.href = url;
    } catch (caughtError) {
      const message = getErrorMessage(caughtError);
      setBillingError(message);
      setNotice(message);
    }
  }, [workspaceId]);

  const startCheckout = useCallback(async (_plan: PaidPlan, interval: BillingInterval) => {
    if (!supabase || !workspaceId) return;
    try {
      setNotice('');
      setBillingError('');
      const { data, error } = await supabase.functions.invoke('create-checkout-session', { body: { workspaceId, plan: 'tricord', interval } });
      if (error) throw new Error(await getFunctionErrorMessage(error));
      const url = (data as { url?: string } | null)?.url;
      if (!url) throw new Error('Checkout did not return a redirect URL.');
      window.location.href = url;
    } catch (caughtError) {
      const message = getErrorMessage(caughtError);
      setBillingError(message);
      setNotice(message);
    }
  }, [workspaceId]);

  const openConfirmDialog = useCallback((dialog: ConfirmDialogState) => {
    setConfirmDialog(dialog);
  }, []);

  useEffect(() => {
    if (!supabase || !workspaceId || !selectedWorkspace || currentRole === 'guest') return;
    if (selectedWorkspace.subscription_status !== 'active') return;
    const roleSignature = memberships
      .map((membership) => `${membership.id}:${membership.role}`)
      .sort()
      .join('|');
    const syncKey = `${workspaceId}:active:${roleSignature}`;
    if (!roleSignature || billingSeatSyncKeyRef.current === syncKey) return;
    billingSeatSyncKeyRef.current = syncKey;
    void supabase.functions.invoke('sync-billing-seats', { body: { workspaceId } }).then(({ error }) => {
      if (error) console.warn('TriCord seat billing sync failed:', error.message);
    });
  }, [currentRole, memberships, selectedWorkspace, workspaceId]);
  const appUrl = getAppUrl();
  const marketingHome = isMarketingHomeRoute(inviteToken, routeKey);

  useEffect(() => {
    const updateRoute = () => setRouteKey(`${window.location.pathname}${window.location.search}${window.location.hash}`);
    window.addEventListener('popstate', updateRoute);
    window.addEventListener('tricord:navigate', updateRoute);
    return () => {
      window.removeEventListener('popstate', updateRoute);
      window.removeEventListener('tricord:navigate', updateRoute);
    };
  }, []);

  useEffect(() => {
    selectedPostIdRef.current = selectedPost?.id ?? '';
  }, [selectedPost?.id]);

  useEffect(() => {
    window.localStorage.setItem(THEME_STORAGE_KEY, theme);
  }, [theme]);

  useEffect(() => {
    const palette = accentPalettes[accentColor];
    const root = document.documentElement;
    root.style.setProperty('--accent', palette.accent);
    root.style.setProperty('--accent-strong', palette.strong);
    root.style.setProperty('--accent-soft', palette.soft);
    root.style.setProperty('--accent-muted', palette.muted);
    root.style.setProperty('--accent-ink', palette.ink);
    window.localStorage.setItem(ACCENT_STORAGE_KEY, accentColor);
  }, [accentColor]);

  useEffect(() => {
    window.localStorage.setItem(CHAT_OPEN_STORAGE_KEY, String(chatOnOtherPages));
  }, [chatOnOtherPages]);

  useEffect(() => {
    if (!notificationPrefsKey) {
      setNotificationPreferences(DEFAULT_NOTIFICATION_PREFERENCES);
      return;
    }
    setNotificationPreferences(readStoredJson(notificationPrefsKey, DEFAULT_NOTIFICATION_PREFERENCES));
  }, [notificationPrefsKey]);

  useEffect(() => {
    if (!notificationPrefsKey) return;
    window.localStorage.setItem(notificationPrefsKey, JSON.stringify(notificationPreferences));
  }, [notificationPreferences, notificationPrefsKey]);

  useEffect(() => {
    if (!unreadSeenKey) {
      setLastSeenActivityAt(new Date().toISOString());
      return;
    }
    const stored = window.localStorage.getItem(unreadSeenKey);
    const initialSeenAt = stored || new Date().toISOString();
    if (!stored) window.localStorage.setItem(unreadSeenKey, initialSeenAt);
    setLastSeenActivityAt(initialSeenAt);
  }, [unreadSeenKey]);

  const isViewingActiveDiscussion = view === 'feed' && chatOpen && Boolean(selectedPostId);

  useEffect(() => {
    if (!unreadSeenKey) return;
    const markVisible = () => {
      if (document.visibilityState === 'visible' && isViewingActiveDiscussion) markWorkspaceActivitySeen();
    };
    window.addEventListener('focus', markVisible);
    document.addEventListener('visibilitychange', markVisible);
    return () => {
      window.removeEventListener('focus', markVisible);
      document.removeEventListener('visibilitychange', markVisible);
    };
  }, [isViewingActiveDiscussion, markWorkspaceActivitySeen, unreadSeenKey]);

  useEffect(() => {
    if (!unreadSeenKey || !isViewingActiveDiscussion || document.visibilityState !== 'visible') return;
    markWorkspaceActivitySeen();
  }, [comments.length, isViewingActiveDiscussion, markWorkspaceActivitySeen, posts.length, tasks.length, unreadSeenKey]);

  useEffect(() => {
    if (marketingHome) return;
    const visibleCount = notificationPreferences.tabBadges ? unreadActivityCount : 0;
    document.title = visibleCount > 0 ? `(${visibleCount}) TriCord` : 'TriCord';
    updateFaviconBadge(visibleCount, notificationPreferences.tabBadges);
  }, [marketingHome, notificationPreferences.tabBadges, unreadActivityCount]);

  useEffect(() => {
    if (unreadActivityCount > previousUnreadCountRef.current && document.visibilityState === 'hidden') {
      if (notificationPreferences.desktop && 'Notification' in window && Notification.permission === 'granted') {
        new Notification('TriCord update', { body: `${unreadActivityCount} unread update${unreadActivityCount === 1 ? '' : 's'}` });
      }
      if (notificationPreferences.sound) playNotificationTone();
    }
    previousUnreadCountRef.current = unreadActivityCount;
  }, [notificationPreferences.desktop, notificationPreferences.sound, unreadActivityCount]);

  useEffect(() => {
    const toggleDiscussionPanel = (event: KeyboardEvent) => {
      if (event.key !== '\\' || (!event.metaKey && !event.ctrlKey)) return;
      event.preventDefault();
      setChatOpen((open) => !open);
    };
    window.addEventListener('keydown', toggleDiscussionPanel);
    return () => window.removeEventListener('keydown', toggleDiscussionPanel);
  }, []);

  const loadRoomPreferences = useCallback(async (userId: string, spaceIds: string[]) => {
    if (!supabase || spaceIds.length === 0) {
      setRoomPreferences({});
      return;
    }
    const { data, error } = await supabase
      .from('room_preferences')
      .select('space_id, position, pinned')
      .eq('user_id', userId)
      .in('space_id', spaceIds);
    if (error) {
      setRoomPreferences({});
      return;
    }
    const preferences = (data ?? []) as RoomPreference[];
    setRoomPreferences(Object.fromEntries(preferences.map((preference) => [preference.space_id, preference])));
  }, []);

  useEffect(() => {
    if (!session?.user.id) {
      setRoomPreferences({});
      return;
    }
    void loadRoomPreferences(session.user.id, spaces.map((space) => space.id));
  }, [loadRoomPreferences, session?.user.id, spaceIdsKey]);

  const visiblePosts = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    const base = posts.filter((post) => {
      if (sort === 'archived') return post.state === 'archived';
      if (post.state === 'archived') return false;
      if (sort === 'assigned') return post.metadata?.assigned_to === session?.user.id;
      return true;
    });

    const searched = normalizedQuery
      ? base.filter((post) => `${post.title} ${post.body}`.toLowerCase().includes(normalizedQuery))
      : base;

    return [...searched].sort((a, b) => {
      if (sort === 'newest') return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      return new Date(b.last_activity_at).getTime() - new Date(a.last_activity_at).getTime();
    });
  }, [posts, query, session?.user.id, sort]);

  const getMostRecentPostForSpace = useCallback((spaceId: string) => {
    const candidates = posts.filter((post) => {
      if (post.state === 'archived') return false;
      return spaceId === 'all' || post.space_id === spaceId;
    });

    return [...candidates].sort((a, b) => new Date(b.last_activity_at).getTime() - new Date(a.last_activity_at).getTime())[0];
  }, [posts]);

  const handleSpaceChange = useCallback((spaceId: string) => {
    const wasOnFeed = view === 'feed';
    const nextPost = getMostRecentPostForSpace(spaceId);

    setActiveSpaceId(spaceId);
    setView('feed');
    setSort('active');
    setSelectedPostId(nextPost?.id ?? '');
    setChatOpen(wasOnFeed);
    setSidebarOpen(false);
  }, [getMostRecentPostForSpace, view]);

  useEffect(() => {
    if (view !== 'feed') return;
    const currentPost = selectedPostId ? posts.find((post) => post.id === selectedPostId) : undefined;
    if (currentPost && (activeSpaceId === 'all' || currentPost.space_id === activeSpaceId)) return;
    const nextPost = getMostRecentPostForSpace(activeSpaceId);
    setSelectedPostId(nextPost?.id ?? '');
  }, [activeSpaceId, getMostRecentPostForSpace, posts, selectedPostId, view]);

  const loadWorkspaceData = useCallback(async (targetWorkspaceId: string, silent = false) => {
    if (!supabase || !targetWorkspaceId) return;
    if (!silent) setLoading(true);
    setNotice('');

    const [spaceResult, postResult, taskResult, membershipResult, knowledgeResult, capabilityResult] = await Promise.all([
      supabase
        .from('spaces')
        .select('id, workspace_id, name, slug, access, description, archived_at, created_by, email_alias, email_forwarding_enabled, created_at, updated_at')
        .eq('workspace_id', targetWorkspaceId)
        .is('archived_at', null)
        .order('name', { ascending: true }),
      supabase
        .from('posts')
        .select('id, workspace_id, space_id, author_id, title, body, state, pinned_at, archived_at, last_activity_at, metadata, created_at, updated_at')
        .eq('workspace_id', targetWorkspaceId)
        .order('last_activity_at', { ascending: false })
        .limit(80),
      supabase
        .from('tasks')
        .select('id, workspace_id, post_id, title, description, project_name, priority, tags, assignee_id, created_by, status, due_at, archived_at, created_at, updated_at')
        .eq('workspace_id', targetWorkspaceId)
        .is('archived_at', null)
        .order('created_at', { ascending: false })
        .limit(40),
      supabase
        .from('memberships')
        .select('id, workspace_id, user_id, role, joined_at')
        .eq('workspace_id', targetWorkspaceId),
      supabase
        .from('knowledge_articles')
        .select('id, workspace_id, category, title, summary, content, created_by, created_at, updated_at')
        .eq('workspace_id', targetWorkspaceId)
        .order('updated_at', { ascending: false }),
      supabase
        .from('workspace_capabilities')
        .select('workspace_id, user_id, manage_members, manage_rooms, manage_knowledge, manage_hr, approve_leave, manage_timekeeping, correct_attendance, manage_payroll, approve_payroll, view_reports, view_audit')
        .eq('workspace_id', targetWorkspaceId)
        .eq('user_id', session?.user.id ?? '')
        .maybeSingle(),
    ]);

    if (spaceResult.error) setNotice(spaceResult.error.message);
    if (postResult.error) setNotice(postResult.error.message);
    if (taskResult.error) setNotice(taskResult.error.message);
    if (membershipResult.error) setNotice(membershipResult.error.message);
    if (knowledgeResult.error) setNotice(knowledgeResult.error.message);
    if (capabilityResult.error) setNotice(capabilityResult.error.message);

    const nextSpaces = (spaceResult.data ?? []) as AppSpace[];
    const nextPosts = (postResult.data ?? []) as AppPost[];
    const nextTasks = (taskResult.data ?? []) as AppTask[];
    const nextMemberships = (membershipResult.data ?? []) as AppMembership[];
    const nextKnowledgeArticles = (knowledgeResult.data ?? []) as KnowledgeArticle[];

    setSpaces(nextSpaces);
    setPosts(nextPosts);
    setTasks(nextTasks);
    setMemberships(nextMemberships);
    setKnowledgeArticles(nextKnowledgeArticles);
    setCapabilities((capabilityResult.data as WorkspaceCapabilities | null) ?? null);
    setSelectedPostId((current) => current || nextPosts[0]?.id || '');
    setActiveSpaceId((current) => (current === 'all' || nextSpaces.some((space) => space.id === current) ? current : 'all'));

    const profileIds = new Set<string>();
    nextPosts.forEach((post) => profileIds.add(post.author_id));
    nextTasks.forEach((task) => {
      if (task.assignee_id) profileIds.add(task.assignee_id);
      profileIds.add(task.created_by);
    });
    nextKnowledgeArticles.forEach((article) => profileIds.add(article.created_by));
    (membershipResult.data ?? []).forEach((membership) => profileIds.add(String(membership.user_id)));

    if (profileIds.size > 0) {
      const nextProfiles = await fetchProfiles([...profileIds]);
      setProfiles(Object.fromEntries(nextProfiles.map((profile) => [profile.id, profile])));
    } else {
      setProfiles({});
    }

    if (!silent) setLoading(false);
  }, [session?.user.id]);

  useEffect(() => {
    if (!supabase || !session?.user.id) {
      setPrivateProfile(null);
      return;
    }
    void supabase
      .from('user_private_profiles')
      .select('user_id, phone, address, bio')
      .eq('user_id', session.user.id)
      .maybeSingle()
      .then(({ data, error }) => {
        if (error) {
          setNotice(error.message);
          return;
        }
        setPrivateProfile((data as UserPrivateProfile | null) ?? {
          user_id: session.user.id,
          phone: null,
          address: null,
          bio: null,
        });
      });
  }, [session?.user.id]);

  const loadEmailAccounts = useCallback(async () => {
    if (!supabase || !workspaceId || !session?.user.id) {
      setEmailAccounts([]);
      setSelectedEmailAccountId('');
      return;
    }
    const { data, error } = await supabase
      .from('user_email_accounts')
      .select('id, workspace_id, user_id, provider, email_address, display_name, token_expiry, provider_account_id, scopes, last_sync_at, sync_cursor, revoked_at, is_default, is_connected, last_error, created_at, updated_at')
      .eq('workspace_id', workspaceId)
      .eq('user_id', session.user.id)
      .eq('is_connected', true)
      .order('is_default', { ascending: false })
      .order('created_at', { ascending: true });
    if (error) {
      setNotice(error.message);
      return;
    }
    const nextAccounts = (data ?? []) as UserEmailAccount[];
    setEmailAccounts(nextAccounts);
    setSelectedEmailAccountId((current) => {
      if (current === 'room' || nextAccounts.some((account) => account.id === current)) return current;
      return nextAccounts.find((account) => account.is_default)?.id ?? nextAccounts[0]?.id ?? 'room';
    });
  }, [session?.user.id, workspaceId]);

  useEffect(() => {
    void loadEmailAccounts();
  }, [loadEmailAccounts]);

  const loadMemberships = useCallback(async (userId: string, preferredWorkspaceId?: string) => {
    if (!supabase) return;

    const membershipResult = await supabase
      .from('memberships')
      .select('workspace_id, role')
      .eq('user_id', userId)
      .order('joined_at', { ascending: true });

    if (membershipResult.error) {
      setNotice(membershipResult.error.message);
      setLoading(false);
      return;
    }

    const memberships = (membershipResult.data ?? []) as { workspace_id: string; role: WorkspaceRole }[];
    const workspaceIds = memberships.map((membership) => membership.workspace_id);

    if (workspaceIds.length === 0) {
      setWorkspaces([]);
      setWorkspaceId('');
      setSpaces([]);
      setPosts([]);
      setTasks([]);
      setLoading(false);
      return;
    }

    const workspaceResult = await supabase
      .from('workspaces')
      .select('*')
      .in('id', workspaceIds);

    if (workspaceResult.error) {
      setNotice(workspaceResult.error.message);
      setLoading(false);
      return;
    }

    const roleByWorkspace = new Map(memberships.map((membership) => [membership.workspace_id, membership.role]));
    const nextWorkspaces = ((workspaceResult.data ?? []) as AppWorkspace[]).map((workspace) => ({
      ...workspace,
      role: roleByWorkspace.get(workspace.id) ?? 'member',
    }));

    const storedWorkspaceId = window.localStorage.getItem(WORKSPACE_STORAGE_KEY) ?? '';
    const desiredWorkspaceId = preferredWorkspaceId ?? storedWorkspaceId ?? workspaceId;
    const nextWorkspaceId = desiredWorkspaceId && nextWorkspaces.some((workspace) => workspace.id === desiredWorkspaceId)
      ? desiredWorkspaceId
      : nextWorkspaces[0]?.id ?? '';

    setWorkspaces(nextWorkspaces);
    setWorkspaceId(nextWorkspaceId);
    window.localStorage.setItem(WORKSPACE_STORAGE_KEY, nextWorkspaceId);
    if (nextWorkspaceId) await loadWorkspaceData(nextWorkspaceId);
  }, [loadWorkspaceData, workspaceId]);

  useEffect(() => {
    if (!supabase) {
      setAuthReady(true);
      setLoading(false);
      return;
    }

    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setAuthReady(true);
    });

    const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
    });

    return () => data.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (inviteToken) {
      window.localStorage.setItem(INVITE_STORAGE_KEY, inviteToken);
    }
  }, [inviteToken]);

  useEffect(() => {
    if (!authReady || !supabase) return;
    if (!session?.user) {
      setLoading(false);
      return;
    }

    void (async () => {
      setLoading(true);
      try {
        await ensureProfile(session);
        let acceptedWorkspaceId: string | undefined;

        if (inviteToken) {
          setInviteAcceptError('');
          acceptedWorkspaceId = await acceptWorkspaceInvitation(session, inviteToken);
          setInviteToken('');
          clearStoredInviteToken();
          const url = new URL(window.location.href);
          url.searchParams.delete('invite');
          window.history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`);
        }

        await loadMemberships(session.user.id, acceptedWorkspaceId);
      } catch (caughtError) {
        const message = getErrorMessage(caughtError);
        if (inviteToken) setInviteAcceptError(message);
        else setNotice(message);
        setLoading(false);
      }
    })();
  }, [authReady, inviteToken, loadMemberships, session]);

  const loadComments = useCallback(async (postId: string) => {
    if (!supabase || !postId) {
      setComments([]);
      setAttachments([]);
      setReactions([]);
      return;
    }

    const [commentResult, attachmentResult] = await Promise.all([
      supabase
        .from('comments')
        .select('id, workspace_id, post_id, parent_comment_id, author_id, body, is_decision, created_at, updated_at')
        .eq('post_id', postId)
        .order('created_at', { ascending: true }),
      supabase
        .from('attachments')
        .select('id, workspace_id, post_id, comment_id, uploaded_by, bucket, object_path, filename, mime_type, byte_size, metadata, created_at')
        .eq('post_id', postId)
        .order('created_at', { ascending: true }),
    ]);

    if (commentResult.error || attachmentResult.error) {
      setNotice(commentResult.error?.message ?? attachmentResult.error?.message ?? 'Messages could not be loaded.');
      return;
    }

    const nextComments = (commentResult.data ?? []) as AppComment[];
    commentsSignatureRef.current = getCommentsSignature(nextComments);
    const commentIds = nextComments.map((comment) => comment.id);
    const reactionFilter = commentIds.length > 0
      ? `post_id.eq.${postId},comment_id.in.(${commentIds.join(',')})`
      : `post_id.eq.${postId}`;
    const reactionResult = await supabase
      .from('reactions')
      .select('id, workspace_id, post_id, comment_id, user_id, emoji, created_at')
      .or(reactionFilter)
      .order('created_at', { ascending: true });
    if (reactionResult.error) {
      setNotice(reactionResult.error.message);
      return;
    }

    setComments(nextComments);
    const nextAttachments = await Promise.all(
      ((attachmentResult.data ?? []) as AppAttachment[]).map(async (attachment) => {
        const externalUrl = getExternalAttachmentUrl(attachment);
        if (externalUrl) return { ...attachment, signed_url: externalUrl };
        const { data } = await supabase.storage.from(attachment.bucket).createSignedUrl(attachment.object_path, 3600);
        return { ...attachment, signed_url: data?.signedUrl };
      }),
    );
    setAttachments(nextAttachments);
    setReactions((reactionResult.data ?? []) as AppReaction[]);

    const authorIds = [...new Set(nextComments.map((comment) => comment.author_id))];
    if (authorIds.length) {
      const nextProfiles = await fetchProfiles(authorIds);
      setProfiles((current) => ({
        ...current,
        ...Object.fromEntries(nextProfiles.map((profile) => [profile.id, profile])),
      }));
    }
  }, []);

  useEffect(() => {
    if (!supabase || !workspaceId || !session?.access_token) return;
    let channel: RealtimeChannel | null = null;
    let cancelled = false;

    void (async () => {
      await supabase.realtime.setAuth(session.access_token);
      if (cancelled) return;
      channel = supabase
      .channel(`workspace-${workspaceId}`, { config: { broadcast: { self: false } } })
      .on('broadcast', { event: 'comments_changed' }, ({ payload }) => {
        const activePostId = selectedPostIdRef.current;
        if (activePostId && String(payload?.postId ?? '') === activePostId) void loadComments(activePostId);
      })
      .on('broadcast', { event: 'posts_changed' }, () => {
        void loadWorkspaceData(workspaceId, true);
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'spaces', filter: `workspace_id=eq.${workspaceId}` }, () => {
        void loadWorkspaceData(workspaceId, true);
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'workspace_capabilities', filter: `workspace_id=eq.${workspaceId}` }, () => {
        void loadWorkspaceData(workspaceId, true);
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'posts', filter: `workspace_id=eq.${workspaceId}` }, () => {
        void loadWorkspaceData(workspaceId, true);
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'comments', filter: `workspace_id=eq.${workspaceId}` }, (payload) => {
        const changedPostId = String((payload.new as { post_id?: string })?.post_id ?? (payload.old as { post_id?: string })?.post_id ?? '');
        const activePostId = selectedPostIdRef.current;
        if (activePostId && (!changedPostId || changedPostId === activePostId)) void loadComments(activePostId);
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'attachments', filter: `workspace_id=eq.${workspaceId}` }, () => {
        if (selectedPostIdRef.current) void loadComments(selectedPostIdRef.current);
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'reactions', filter: `workspace_id=eq.${workspaceId}` }, () => {
        if (selectedPostIdRef.current) void loadComments(selectedPostIdRef.current);
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks', filter: `workspace_id=eq.${workspaceId}` }, () => {
        void loadWorkspaceData(workspaceId, true);
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'knowledge_articles', filter: `workspace_id=eq.${workspaceId}` }, () => {
        void loadWorkspaceData(workspaceId, true);
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'memberships', filter: `workspace_id=eq.${workspaceId}` }, () => {
        void loadWorkspaceData(workspaceId, true);
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'user_email_accounts', filter: `workspace_id=eq.${workspaceId}` }, () => {
        void loadEmailAccounts();
      })
      .subscribe((status, error) => {
        if (status === 'SUBSCRIBED') workspaceChannelRef.current = channel;
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          console.warn('TriCord realtime reconnecting:', error?.message ?? status);
          setNotice('Live updates briefly disconnected. TriCord is reconnecting in the background. Your work is still safe.');
          window.setTimeout(() => {
            void loadWorkspaceData(workspaceId, true);
            if (selectedPostIdRef.current) void loadComments(selectedPostIdRef.current);
          }, 1200);
        }
      });
    })();

    return () => {
      cancelled = true;
      if (workspaceChannelRef.current === channel) workspaceChannelRef.current = null;
      if (channel) void supabase.removeChannel(channel);
    };
  }, [loadComments, loadEmailAccounts, loadWorkspaceData, session?.access_token, workspaceId]);

  useEffect(() => {
    if (!supabase || !workspaceId || !session?.user.id) return;
    let checking = false;
    const reconcileMessages = async () => {
      const activePostId = selectedPostIdRef.current;
      if (!activePostId || checking || document.visibilityState !== 'visible') return;
      checking = true;
      const { data, error } = await supabase
        .from('comments')
        .select('id, updated_at')
        .eq('post_id', activePostId)
        .order('created_at', { ascending: true });
      checking = false;
      if (error) return;
      const signature = (data ?? []).map((comment) => `${comment.id}:${comment.updated_at}`).join('|');
      if (signature !== commentsSignatureRef.current) void loadComments(activePostId);
    };
    const intervalId = window.setInterval(() => void reconcileMessages(), 3000);
    const handleVisibility = () => { if (document.visibilityState === 'visible') void reconcileMessages(); };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => {
      window.clearInterval(intervalId);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [loadComments, session?.user.id, workspaceId]);

  useEffect(() => {
    if (!selectedPost?.id) {
      setComments([]);
      setAttachments([]);
      setReactions([]);
      return;
    }
    void loadComments(selectedPost.id);
  }, [loadComments, selectedPost?.id]);

  useEffect(() => {
    if (!canOpenView(view, currentRole, capabilities)) {
      setView('feed');
      return;
    }
    if ((view === 'timekeeping' && !businessModules.attendance_tracking)
      || (view === 'hr' && !businessModules.employee_records)
      || (view === 'payroll' && !businessModules.payroll_preparation)
      || (view === 'reports' && !(businessModules.attendance_tracking || businessModules.employee_records || businessModules.payroll_preparation))) {
      setView('feed');
    }
  }, [businessModules, capabilities, currentRole, view]);

  useEffect(() => {
    if (authReady && !loading) setHasLoadedOnce(true);
  }, [authReady, loading]);

  const currentSpacePosts = activeSpaceId === 'all'
    ? visiblePosts
    : visiblePosts.filter((post) => post.space_id === activeSpaceId);

  if (marketingHome) {
    return <MarketingHome appUrl={appUrl} />;
  }

  if (!isSupabaseConfigured) {
    return <SetupScreen theme={theme} setTheme={setTheme} />;
  }

  if (!authReady || (loading && !hasLoadedOnce)) {
    return <LoadingScreen theme={theme} />;
  }

  if (!session?.user) {
    return <AuthScreen theme={theme} setTheme={setTheme} inviteToken={inviteToken} />;
  }

  if (inviteToken) {
    return (
      <InviteAcceptScreen
        theme={theme}
        email={session.user.email ?? ''}
        error={inviteAcceptError}
        onUseInvitedEmail={async () => {
          setInviteAcceptError('');
          if (inviteToken) {
            window.localStorage.setItem(INVITE_STORAGE_KEY, inviteToken);
          }
          await supabase?.auth.signOut();
        }}
        onClear={() => {
          setInviteToken('');
          setInviteAcceptError('');
          clearStoredInviteToken();
          const url = new URL(window.location.href);
          url.searchParams.delete('invite');
          window.history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`);
        }}
      />
    );
  }

  if (workspaces.length === 0) {
    return (
      <OnboardingScreen
        theme={theme}
        setTheme={setTheme}
        email={session.user.email ?? ''}
        onSignOut={() => void supabase?.auth.signOut()}
        onCreate={async (setup) => {
          await createWorkspace(session, setup);
          await loadMemberships(session.user.id);
        }}
      />
    );
  }

  return (
    <div className={cn('relative h-dvh overflow-hidden font-sans', theme === 'dark' ? 'bg-[#0C0B10] text-[#FAF9FC]' : 'bg-[#F5F4F7] text-[#17151D]')}>
      <AmbientMotifs theme={theme} />
      <div className="relative z-10 grid h-full min-h-0 grid-cols-1 lg:grid-cols-[280px_minmax(0,1fr)]">
        <Sidebar
          activeSpaceId={activeSpaceId}
          onSpaceChange={handleSpaceChange}
          spaces={spaces}
          roomPreferences={roomPreferences}
          theme={theme}
          view={view}
          onViewChange={(nextView) => {
            setView(nextView);
            if (nextView !== 'feed') setChatOpen(chatOnOtherPages);
            setSidebarOpen(false);
          }}
          workspaces={workspaces}
          workspaceId={workspaceId}
          sidebarOpen={sidebarOpen}
          profile={currentProfile}
          email={session.user.email ?? ''}
          plan={formatSubscriptionStatusLabel(selectedWorkspace)}
          onClose={() => setSidebarOpen(false)}
          onCreateSpace={() => setSpaceModalOpen(true)}
          onRenameSpace={setRenamingSpace}
          onSaveRoomOrder={async (orderedSpaces) => {
            try {
              const nextPreferences = await saveRoomOrder(session.user.id, orderedSpaces, roomPreferences);
              setRoomPreferences(nextPreferences);
            } catch (caughtError) {
              setNotice(getErrorMessage(caughtError));
            }
          }}
          onSetRoomPinned={async (space, pinned) => {
            try {
              const nextPreferences = await setRoomPinned(session.user.id, space, pinned, roomPreferences);
              setRoomPreferences(nextPreferences);
            } catch (caughtError) {
              setNotice(getErrorMessage(caughtError));
            }
          }}
          onOpenRoomEmail={(space) => setForwardingRoom(space)}
          onDeleteSpace={(space) => openConfirmDialog({
            title: 'Delete room?',
            body: `Delete the room "${space.name}"? Its posts, discussions, and related activity will also be permanently deleted.`,
            confirmLabel: 'Delete room',
            onConfirm: async () => {
              await deleteSpace(space.id);
              if (activeSpaceId === space.id) setActiveSpaceId('all');
              setSelectedPostId('');
              await loadWorkspaceData(workspaceId, true);
            },
          })}
          onOpenAccount={setAccountModal}
          onSelectWorkspace={async (nextWorkspaceId) => {
            if (nextWorkspaceId === workspaceId) return;
            setSelectedPostId('');
            setActiveSpaceId('all');
            setWorkspaceId(nextWorkspaceId);
            window.localStorage.setItem(WORKSPACE_STORAGE_KEY, nextWorkspaceId);
            await loadWorkspaceData(nextWorkspaceId);
          }}
          onCreateHub={() => setHubModalOpen(true)}
          onOpenBilling={() => { setBillingError(''); setBillingModalOpen(true); }}
          onSignOut={() => void supabase?.auth.signOut()}
          canManageAdmin={canManageAdmin}
          canManageRooms={canManageRooms}
          canViewTimekeeping={canViewTimekeeping}
          canViewHr={canViewHr}
          canViewPayroll={canViewPayroll}
          canViewReports={canViewReports}
          premiumFeatures={premiumFeatures}
          businessModules={businessModules}
        />

        <main className="grid h-full min-h-0 grid-rows-[auto_minmax(0,1fr)] overflow-hidden">
          <header className={cn('shrink-0 border-b px-4 py-4 md:px-6', theme === 'dark' ? 'border-white/10 bg-[#0C0B10]/85' : 'border-[#E7E3EA] bg-[#FFFFFF]/80')}>
            <div className="flex items-center gap-3">
              <button
                aria-label="Open navigation"
                onClick={() => setSidebarOpen(true)}
                className={cn('inline-flex h-10 w-10 items-center justify-center rounded-lg border lg:hidden', subtleButton(theme))}
              >
                <Menu className="h-4 w-4" />
              </button>
              <div className="min-w-0 flex-1">
                <p className={cn('truncate text-xs font-semibold uppercase tracking-[0.24em]', muted(theme))}>Hub</p>
                <h1 className="truncate text-2xl font-bold tracking-tight md:text-3xl">{selectedWorkspace?.name ?? 'TriCord'}</h1>
              </div>
              {view === 'feed' && <label className={cn('hidden h-11 w-[min(28vw,360px)] items-center gap-2 rounded-lg border px-3 md:flex', surface(theme))}>
                <Search className={cn('h-4 w-4 shrink-0', muted(theme))} />
                <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search posts" className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-current" />
              </label>}
              {view === 'feed' && <button onClick={() => setComposerOpen(true)} className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-[#17151D] px-4 text-sm font-semibold text-[#FAF9FC] shadow-lg shadow-[#17151D]/20 transition hover:bg-[#17151D]">
                <Plus className="h-4 w-4" /><span className="hidden sm:inline">New post</span>
              </button>}
              {!chatOpen && (
                <button type="button" aria-label="Toggle side panel" title="Toggle side panel" onClick={() => setChatOpen(true)} className={cn('inline-flex h-11 w-11 items-center justify-center rounded-lg border', surface(theme))}>
                  <PanelRightOpen className="h-4 w-4" />
                </button>
              )}
            </div>
            {view === 'feed' && <label className={cn('mt-3 flex h-10 items-center gap-2 rounded-lg border px-3 md:hidden', surface(theme))}>
              <Search className={cn('h-4 w-4 shrink-0', muted(theme))} />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search posts"
                className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-current"
              />
            </label>}
          </header>

          <div
            className={cn('grid min-h-0 grid-cols-1 overflow-hidden', showThreadPanel && 'xl:grid-cols-[minmax(0,1fr)_var(--thread-width)]')}
            style={{ '--thread-width': `${threadWidth}%` } as CSSProperties}
          >
            <section className="flex min-h-0 min-w-0 flex-col overflow-hidden px-3 py-3 md:px-6 md:py-5">
              {notice && (
                <div className="mb-4 rounded-lg border border-[var(--accent)] bg-[var(--accent-soft)] px-4 py-3 text-sm text-[var(--accent-strong)]">
                  {notice}
                </div>
              )}

              {view === 'feed' && (
                <>
                  <Metrics posts={posts} tasks={tasks} knowledgeCount={knowledgeArticles.length + 1} theme={theme} />
                  <SortBar sort={sort} setSort={setSort} theme={theme} />
                  <div className="mt-3 min-h-0 flex-1 overflow-y-auto pr-1 scroll-area md:mt-4">
                    {currentSpacePosts.length > 0 ? (
                      <div className="grid gap-4 pb-6">
                        {currentSpacePosts.map((post) => (
                          <div key={post.id}>
                            <PostRow
                              post={post}
                              selected={selectedPost?.id === post.id}
                              profile={profiles[post.author_id]}
                              theme={theme}
                              space={spaces.find((item) => item.id === post.space_id)}
                              members={memberProfiles}
                              onClick={() => {
                                setSelectedPostId(post.id);
                                setChatOpen(true);
                              }}
                              canManage={post.author_id === session.user.id || canModerateContent}
                              onEdit={() => setEditingPost(post)}
                              onAssign={async (assigneeId) => {
                                try {
                                  await assignPost(post.id, assigneeId);
                                  await loadWorkspaceData(workspaceId, true);
                                } catch (caughtError) {
                                  setNotice(getErrorMessage(caughtError));
                                }
                              }}
                              onArchive={async () => {
                                try {
                                  await setPostArchived(post.id, post.state !== 'archived');
                                  if (selectedPostId === post.id) setSelectedPostId('');
                                  await loadWorkspaceData(workspaceId, true);
                                } catch (caughtError) {
                                  setNotice(getErrorMessage(caughtError));
                                }
                              }}
                              onDelete={() => openConfirmDialog({
                                title: 'Delete post?',
                                body: 'Delete this post and its discussion? This cannot be undone.',
                                confirmLabel: 'Delete post',
                                onConfirm: async () => {
                                  await deletePost(post.id);
                                  void workspaceChannelRef.current?.send({ type: 'broadcast', event: 'posts_changed', payload: { workspaceId } });
                                  if (selectedPostId === post.id) setSelectedPostId('');
                                  await loadWorkspaceData(workspaceId, true);
                                },
                              })}
                            />
                          </div>
                        ))}
                      </div>
                    ) : (
                      <EmptyState
                        theme={theme}
                        icon={Inbox}
                        title="No posts yet"
                        body="Create the first post for this hub. New activity will stay grouped here instead of disappearing into channels."
                        actionLabel="Create post"
                        onAction={() => setComposerOpen(true)}
                      />
                    )}
                  </div>
                </>
              )}

              {view === 'tasks' && (
                <TasksView
                  tasks={tasks}
                  profiles={profiles}
                  theme={theme}
                  canManageTaskActions={canModerateContent}
                  onCreateTask={() => setTaskModalOpen(true)}
                  onEditTask={(task) => setEditingTask(task)}
                  onDeleteTask={(task) => openConfirmDialog({
                    title: 'Delete task?',
                    body: 'Delete this task? This cannot be undone.',
                    confirmLabel: 'Delete task',
                    onConfirm: async () => {
                      await deleteTask(task.id);
                      await loadWorkspaceData(workspaceId, true);
                    },
                  })}
                  onStatusChange={async (taskId, status) => {
                    try {
                      await updateTaskStatus(taskId, status);
                      await loadWorkspaceData(workspaceId, true);
                    } catch (caughtError) {
                      setNotice(getErrorMessage(caughtError));
                    }
                  }}
                  onArchiveTask={async (task) => {
                    try {
                      await archiveTask(task.id);
                      await loadWorkspaceData(workspaceId, true);
                    } catch (caughtError) {
                      setNotice(getErrorMessage(caughtError));
                    }
                  }}
                />
              )}
              {view === 'knowledge' && currentRole !== 'guest' && (
                <KnowledgeView
                  articles={knowledgeArticles}
                  profiles={profiles}
                  theme={theme}
                  canManage={canManageKnowledge}
                  onCreate={() => setKnowledgeModalOpen(true)}
                  onEdit={(article) => setEditingKnowledgeArticle(article)}
                  onDelete={(article) => openConfirmDialog({
                    title: 'Delete knowledge article?',
                    body: 'Delete this knowledge article? This cannot be undone.',
                    confirmLabel: 'Delete article',
                    onConfirm: async () => {
                      await deleteKnowledgeArticle(article.id);
                      await loadWorkspaceData(workspaceId, true);
                    },
                  })}
                />
              )}

              {(view === 'timekeeping' || view === 'hr' || view === 'payroll' || view === 'reports') && currentRole && currentRole !== 'guest' && (
                <WorkforceModule
                  view={view}
                  workspaceId={workspaceId}
                  userId={session.user.id}
                  role={currentRole}
                  profiles={profiles}
                  memberships={memberships}
                  capabilities={capabilities}
                  theme={theme}
                  premiumFeatures={premiumFeatures}
                  onNotice={setNotice}
                />
              )}
              {view === 'admin' && canManageAdmin && (
                <AdminView
                  workspace={selectedWorkspace}
                  currentRole={currentRole}
                  currentCapabilities={capabilities}
                  theme={theme}
                  memberships={memberships}
                  profiles={profiles}
                  spaces={spaces}
                  businessModules={businessModules}
                  onInvite={(email, role) => createWorkspaceInvitation(workspaceId, email, role)}
                  onRoleChange={async (membershipId, role) => {
                    await updateMemberRole(membershipId, role);
                    await loadWorkspaceData(workspaceId, true);
                  }}
                />
              )}
            </section>

            {showThreadPanel && <ThreadPanel
              post={selectedPost}
              profile={selectedProfile}
              comments={comments}
              attachments={attachments}
              reactions={reactions}
              recentPosts={posts.filter((item) => item.state === 'open' && item.id !== selectedPost?.id)}
              profiles={profiles}
              mentionProfiles={hubMentionProfiles}
              theme={theme}
              currentUserId={session.user.id}
              canManage={canManageAdmin}
              width={threadWidth}
              onWidthChange={(width) => {
                const nextWidth = clampThreadWidth(width);
                setThreadWidth(nextWidth);
                window.localStorage.setItem(THREAD_WIDTH_STORAGE_KEY, String(nextWidth));
              }}
              onClose={() => setChatOpen(false)}
              canClose
              onConfirm={openConfirmDialog}
              premiumEmail={premiumFeatures}
              emailAccounts={emailAccounts}
              selectedEmailAccountId={selectedEmailAccountId}
              fallbackSenderAddress={fallbackSenderAddress}
              onSelectedEmailAccountIdChange={setSelectedEmailAccountId}
              onReply={async (body, files, externalAttachments, parentCommentId, providerAccountId) => {
                if (!selectedPost || !session.user) return;
                const emailCommand = parseEmailSendCommand(body);
                let commentBody = body;
                if (emailCommand) {
                  const { error } = await supabase.functions.invoke('send-room-email', {
                    body: { workspaceId, postId: selectedPost.id, to: emailCommand.to, cc: emailCommand.cc, bcc: emailCommand.bcc, body: emailCommand.message, subject: emailCommand.subject || `Re: ${selectedPost.title}`, providerAccountId: providerAccountId === 'room' ? undefined : providerAccountId },
                  });
                  if (error) throw new Error(await getFunctionErrorMessage(error));
                  commentBody = `Email sent to ${emailCommand.to}${emailCommand.cc.length ? ` (cc: ${emailCommand.cc.join(', ')})` : ''}${emailCommand.bcc.length ? ` (bcc: ${emailCommand.bcc.join(', ')})` : ''}\n\n${emailCommand.message}`;
                }
                await createComment(selectedPost, session.user.id, commentBody, false, files, externalAttachments, parentCommentId);
                void workspaceChannelRef.current?.send({ type: 'broadcast', event: 'comments_changed', payload: { postId: selectedPost.id } });
                await loadWorkspaceData(workspaceId, true);
                await loadComments(selectedPost.id);
              }}
              onReact={async (commentId, emoji) => {
                if (!selectedPost || !session.user) return;
                await toggleReaction(selectedPost, commentId, session.user.id, emoji);
                await loadComments(selectedPost.id);
              }}
              onEditComment={async (commentId, body) => {
                if (!selectedPost) return;
                await updateComment(commentId, body);
                void workspaceChannelRef.current?.send({ type: 'broadcast', event: 'comments_changed', payload: { postId: selectedPost.id } });
                await loadComments(selectedPost.id);
              }}
              onDeleteComment={async (commentId) => {
                if (!selectedPost) return;
                await deleteComment(commentId);
                void workspaceChannelRef.current?.send({ type: 'broadcast', event: 'comments_changed', payload: { postId: selectedPost.id } });
                await loadComments(selectedPost.id);
              }}
              onForward={async (messageIds, targetPostIds) => {
                if (!selectedPost || !session.user) return;
                const sourceMessages = messageIds.map((messageId) => {
                  if (messageId === selectedPost.id) {
                    return {
                      body: selectedPost.body,
                      attachments: attachments.filter((attachment) => !attachment.comment_id),
                    };
                  }
                  const comment = comments.find((item) => item.id === messageId);
                  if (!comment) return null;
                  return {
                    body: comment.body,
                    attachments: attachments.filter((attachment) => attachment.comment_id === comment.id),
                  };
                }).filter((message): message is ForwardableMessage => Boolean(message));
                const targets = posts.filter((item) => targetPostIds.includes(item.id));
                await forwardMessages(targets, sourceMessages, session.user.id);
                targetPostIds.forEach((postId) => void workspaceChannelRef.current?.send({ type: 'broadcast', event: 'comments_changed', payload: { postId } }));
                await loadWorkspaceData(workspaceId, true);
              }}
            />}
          </div>
        </main>
      </div>

      {composerOpen && (
        <PostComposer
          theme={theme}
          spaces={spaces}
          defaultSpaceId={activeSpaceId === 'all' ? spaces[0]?.id ?? '' : activeSpaceId}
          draftKey={getFormDraftKey('post', session.user.id, workspaceId)}
          onClose={() => setComposerOpen(false)}
          onCreate={async ({ title, body, spaceId }) => {
            if (!session.user) return;
            await createPost(workspaceId, spaceId, session.user.id, title, body);
            setComposerOpen(false);
            await loadWorkspaceData(workspaceId, true);
          }}
        />
      )}

      {editingPost && (
        <PostComposer
          theme={theme}
          spaces={spaces}
          defaultSpaceId={editingPost.space_id}
          initialPost={editingPost}
          draftKey={getFormDraftKey('post', session.user.id, workspaceId, editingPost.id)}
          onClose={() => setEditingPost(null)}
          onCreate={async ({ title, body, spaceId }) => {
            await updatePost(editingPost.id, { title, body, spaceId });
            setEditingPost(null);
            await loadWorkspaceData(workspaceId, true);
            await loadComments(editingPost.id);
          }}
        />
      )}

      {spaceModalOpen && (
        <SpaceModal
          theme={theme}
          draftKey={getFormDraftKey('room', session.user.id, workspaceId)}
          onClose={() => setSpaceModalOpen(false)}
          onCreate={async ({ name, access }) => {
            if (!session.user) return;
            const space = await createSpace(workspaceId, session.user.id, name, access);
            setSpaceModalOpen(false);
            await loadWorkspaceData(workspaceId, true);
            setActiveSpaceId(space.id);
          }}
        />
      )}

      {forwardingRoom && (
        <RoomEmailForwardingModal
          theme={theme}
          room={forwardingRoom}
          premiumEmail={premiumFeatures}
          onUpgrade={() => { setForwardingRoom(null); setBillingModalOpen(true); }}
          onClose={() => setForwardingRoom(null)}
        />
      )}

      {renamingSpace && (
        <RenameRoomModal
          theme={theme}
          room={renamingSpace}
          onClose={() => setRenamingSpace(null)}
          onRename={async (name) => {
            await renameSpace(renamingSpace.id, name);
            setRenamingSpace(null);
            await loadWorkspaceData(workspaceId, true);
          }}
        />
      )}

      {taskModalOpen && (
        <TaskModal
          theme={theme}
          profiles={memberProfiles}
          draftKey={getFormDraftKey('task', session.user.id, workspaceId)}
          onClose={() => setTaskModalOpen(false)}
          onCreate={async ({ title, description, projectName, priority, tags, assigneeId, dueAt }) => {
            if (!session.user) return;
            await createTask(workspaceId, session.user.id, { title, description, projectName, priority, tags, assigneeId, dueAt });
            setTaskModalOpen(false);
            await loadWorkspaceData(workspaceId, true);
          }}
        />
      )}

      {editingTask && (
        <TaskModal
          theme={theme}
          profiles={memberProfiles}
          task={editingTask}
          draftKey={getFormDraftKey('task', session.user.id, workspaceId, editingTask.id)}
          onClose={() => setEditingTask(null)}
          onCreate={async ({ title, description, projectName, priority, tags, assigneeId, dueAt }) => {
            await updateTask(editingTask.id, { title, description, projectName, priority, tags, assigneeId, dueAt });
            setEditingTask(null);
            await loadWorkspaceData(workspaceId, true);
          }}
        />
      )}

      {knowledgeModalOpen && (
        <KnowledgeArticleModal
          theme={theme}
          draftKey={getFormDraftKey('knowledge', session.user.id, workspaceId)}
          onClose={() => setKnowledgeModalOpen(false)}
          onSave={async (input) => {
            await createKnowledgeArticle(workspaceId, session.user.id, input);
            setKnowledgeModalOpen(false);
            await loadWorkspaceData(workspaceId, true);
          }}
        />
      )}

      {editingKnowledgeArticle && (
        <KnowledgeArticleModal
          theme={theme}
          article={editingKnowledgeArticle}
          draftKey={getFormDraftKey('knowledge', session.user.id, workspaceId, editingKnowledgeArticle.id)}
          onClose={() => setEditingKnowledgeArticle(null)}
          onSave={async (input) => {
            await updateKnowledgeArticle(editingKnowledgeArticle.id, input);
            setEditingKnowledgeArticle(null);
            await loadWorkspaceData(workspaceId, true);
          }}
        />
      )}

      {billingModalOpen && selectedWorkspace && (
        <BillingPlansModal
          theme={theme}
          currentPlan={selectedWorkspace.subscription_status ?? selectedWorkspace.plan ?? 'trial'}
          billableSeatCount={billableSeatCount}
          error={billingError}
          canManageBilling={currentRole === 'owner'}
          onClose={() => setBillingModalOpen(false)}
          onCheckout={(plan, interval) => startCheckout(plan, interval)}
          onManageBilling={openBillingPortal}
        />
      )}

      {confirmDialog && (
        <ConfirmActionModal
          theme={theme}
          title={confirmDialog.title}
          body={confirmDialog.body}
          confirmLabel={confirmDialog.confirmLabel ?? 'Confirm'}
          onClose={() => setConfirmDialog(null)}
          onConfirm={async () => {
            await confirmDialog.onConfirm();
            setConfirmDialog(null);
          }}
          onError={(message) => setNotice(message)}
        />
      )}

      {accountModal && (
        <SettingsModal
          section={accountModal}
          theme={theme}
          setTheme={setTheme}
          accentColor={accentColor}
          setAccentColor={setAccentColor}
          chatOpen={chatOnOtherPages}
          setChatOpen={(open) => {
            setChatOnOtherPages(open);
            if (open || view !== 'feed') setChatOpen(open);
          }}
          profile={currentProfile}
          email={session.user.email ?? ''}
          workspace={selectedWorkspace}
          role={currentRole}
          ownerEmail={ownerEmail}
          premiumEmail={premiumFeatures}
          businessModules={savedBusinessModules}
          notificationPreferences={notificationPreferences}
          onNotificationPreferencesChange={setNotificationPreferences}
          onBusinessModulesChange={async (nextModules) => {
            if (!selectedWorkspace || currentRole !== 'owner') return;
            const changedEntry = BUSINESS_MODULE_CONFIGS.find((module) => !getBusinessModules(selectedWorkspace)[module.key] && nextModules[module.key]);
            if (changedEntry && !hasAcknowledgedBusinessModule(selectedWorkspace, changedEntry.key)) {
              setBusinessModuleDisclosure({ module: changedEntry, nextModules });
              return;
            }
            await updateWorkspaceBusinessModules(selectedWorkspace.id, nextModules, selectedWorkspace.business_module_disclaimers ?? {});
            setWorkspaces((current) => current.map((workspace) => workspace.id === selectedWorkspace.id ? { ...workspace, business_modules: nextModules } : workspace));
          }}
          onUpgrade={() => { setAccountModal(null); setBillingModalOpen(true); }}
          onClose={() => setAccountModal(null)}
          onOpenSection={setAccountModal}
          onSaveProfile={async (input) => {
            if (!session.user) return;
            await updateProfile(session.user.id, input);
            setPrivateProfile({
              user_id: session.user.id,
              phone: input.phone || null,
              address: input.address || null,
              bio: input.bio || null,
            });
            await loadWorkspaceData(workspaceId, true);
          }}
          onUploadAvatar={async (file) => {
            if (!session.user) throw new Error('Sign in before uploading a photo.');
            return uploadAvatar(session.user.id, file);
          }}
        />
      )}

      {businessModuleDisclosure && selectedWorkspace && (
        <ModalShell theme={theme} title={businessModuleDisclosure.module.noticeTitle} onClose={() => setBusinessModuleDisclosure(null)}>
          <div className="grid gap-5">
            <p className={cn('text-sm leading-7', muted(theme))}>{businessModuleDisclosure.module.noticeBody}</p>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setBusinessModuleDisclosure(null)} className={cn('h-10 rounded-lg border px-4 text-sm font-semibold', subtleButton(theme))}>Cancel</button>
              <button
                type="button"
                onClick={async () => {
                  const nextDisclaimers = { ...(selectedWorkspace.business_module_disclaimers ?? {}), [businessModuleDisclosure.module.key]: BUSINESS_MODULE_NOTICE_VERSION };
                  await updateWorkspaceBusinessModules(selectedWorkspace.id, businessModuleDisclosure.nextModules, nextDisclaimers);
                  setWorkspaces((current) => current.map((workspace) => workspace.id === selectedWorkspace.id ? { ...workspace, business_modules: businessModuleDisclosure.nextModules, business_module_disclaimers: nextDisclaimers } : workspace));
                  setBusinessModuleDisclosure(null);
                }}
                className="h-10 rounded-lg bg-[var(--accent-strong)] px-4 text-sm font-bold text-white"
              >
                I Understand
              </button>
            </div>
          </div>
        </ModalShell>
      )}

      {hubModalOpen && (
        <HubSetupModal
          theme={theme}
          email={session.user.email ?? ''}
          onClose={() => setHubModalOpen(false)}
          onCreate={async (setup) => {
            const newWorkspaceId = await createWorkspace(session, setup);
            setHubModalOpen(false);
            await loadMemberships(session.user.id, newWorkspaceId);
          }}
        />
      )}
    </div>
  );
}

function AmbientMotifs({ theme }: { theme: 'light' | 'dark' }) {
  const gridLine = theme === 'dark' ? 'rgba(255,255,255,0.035)' : 'rgba(39,34,47,0.035)';
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      <div className="absolute inset-0 opacity-70" style={{
        backgroundImage:
          'linear-gradient(90deg, ' + gridLine + ' 1px, transparent 1px), linear-gradient(' + gridLine + ' 1px, transparent 1px), radial-gradient(circle at 78% 8%, color-mix(in srgb, var(--accent) 18%, transparent), transparent 22rem)',
        backgroundSize: '36px 36px, 36px 36px, auto',
      }} />
    </div>
  );
}

function TriCordLogo({ className = '' }: { className?: string }) {
  return <img src={triCordLogo} alt="" aria-hidden="true" draggable={false} className={cn('object-contain', className)} />;
}

function Sidebar({
  activeSpaceId,
  onSpaceChange,
  spaces,
  roomPreferences,
  theme,
  view,
  onViewChange,
  workspaces,
  workspaceId,
  sidebarOpen,
  profile,
  email,
  plan,
  onClose,
  onCreateSpace,
  onRenameSpace,
  onSaveRoomOrder,
  onSetRoomPinned,
  onOpenRoomEmail,
  onDeleteSpace,
  onOpenAccount,
  onSelectWorkspace,
  onCreateHub,
  onOpenBilling,
  onSignOut,
  canManageAdmin,
  canManageRooms,
  canViewTimekeeping,
  canViewHr,
  canViewPayroll,
  canViewReports,
  premiumFeatures,
  businessModules,
}: {
  activeSpaceId: string;
  onSpaceChange: (spaceId: string) => void;
  spaces: AppSpace[];
  roomPreferences: Record<string, RoomPreference>;
  theme: 'light' | 'dark';
  view: ViewMode;
  onViewChange: (view: ViewMode) => void;
  workspaces: AppWorkspace[];
  workspaceId: string;
  sidebarOpen: boolean;
  profile?: AppProfile;
  email: string;
  plan: string;
  onClose: () => void;
  onCreateSpace: () => void;
  onRenameSpace: (space: AppSpace) => void;
  onSaveRoomOrder: (spaces: AppSpace[]) => Promise<void>;
  onSetRoomPinned: (space: AppSpace, pinned: boolean) => Promise<void>;
  onOpenRoomEmail: (space: AppSpace) => void;
  onDeleteSpace: (space: AppSpace) => Promise<void>;
  onOpenAccount: (view: AccountModalView) => void;
  onSelectWorkspace: (workspaceId: string) => Promise<void>;
  onCreateHub: () => void;
  onOpenBilling: () => void;
  onSignOut: () => void;
  canManageAdmin: boolean;
  canManageRooms: boolean;
  canViewTimekeeping: boolean;
  canViewHr: boolean;
  canViewPayroll: boolean;
  canViewReports: boolean;
  premiumFeatures: boolean;
  businessModules: BusinessModules;
}) {
  const currentRole = workspaces.find((workspace) => workspace.id === workspaceId)?.role;
  const canManageSpaces = currentRole === 'owner' || canManageRooms;
  const showBusinessNav = currentRole !== 'guest' && (canViewTimekeeping || canViewHr || canViewPayroll || canViewReports || canManageAdmin);
  const canCreateSpaces = canManageSpaces || currentRole === 'member';
  const currentRoleLabel = currentRole ? getRoleLabel(currentRole) : 'hub';
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const [settingsMenuOpen, setSettingsMenuOpen] = useState(false);
  const [helpMenuOpen, setHelpMenuOpen] = useState(false);
  const [roomMenuId, setRoomMenuId] = useState('');
  const [sortMenuOpen, setSortMenuOpen] = useState(false);
  const [roomCompactSettings, setRoomCompactSettings] = useState<RoomCompactSettings>({ all: false, rooms: {} });
  const [reorderMode, setReorderMode] = useState(false);
  const [draggedRoomId, setDraggedRoomId] = useState('');
  const [workforceNavOpen, setWorkforceNavOpen] = useState(false);
  const accountMenuRef = useRef<HTMLDivElement | null>(null);
  const roomMenuRef = useRef<HTMLDivElement | null>(null);
  const accountName = getProfileName(profile, email.split('@')[0] || 'Hub member');
  const roomCompactStorageKey = `${ROOM_COMPACT_STORAGE_KEY}:${profile?.id ?? email}:${workspaceId}`;
  const planLabel = plan;
  const ownerCanManageBilling = currentRole === 'owner';
  const orderedSpaces = useMemo(() => [...spaces].sort((a, b) => {
    const aPreference = roomPreferences[a.id];
    const bPreference = roomPreferences[b.id];
    if (Boolean(aPreference?.pinned) !== Boolean(bPreference?.pinned)) return aPreference?.pinned ? -1 : 1;
    const aPosition = aPreference?.position ?? Number.MAX_SAFE_INTEGER;
    const bPosition = bPreference?.position ?? Number.MAX_SAFE_INTEGER;
    if (aPosition !== bPosition) return aPosition - bPosition;
    return a.name.localeCompare(b.name);
  }), [roomPreferences, spaces]);

  useEffect(() => {
    if (!accountMenuOpen) return;
    const closeMenu = (event: PointerEvent) => {
      if (!accountMenuRef.current?.contains(event.target as Node)) {
        setAccountMenuOpen(false);
        setSettingsMenuOpen(false);
        setHelpMenuOpen(false);
      }
    };
    document.addEventListener('pointerdown', closeMenu);
    return () => document.removeEventListener('pointerdown', closeMenu);
  }, [accountMenuOpen]);

  useEffect(() => {
    if (!roomMenuId) return;
    const closeMenu = (event: PointerEvent) => {
      if (!roomMenuRef.current?.contains(event.target as Node)) {
        setRoomMenuId('');
        setSortMenuOpen(false);
      }
    };
    document.addEventListener('pointerdown', closeMenu);
    return () => document.removeEventListener('pointerdown', closeMenu);
  }, [roomMenuId]);

  useEffect(() => {
    setRoomCompactSettings(readRoomCompactSettings(roomCompactStorageKey));
  }, [roomCompactStorageKey]);

  const saveSortedRooms = async (mode: 'name' | 'newest') => {
    const sorted = [...orderedSpaces].sort((a, b) => {
      const pinnedDifference = Number(Boolean(roomPreferences[b.id]?.pinned)) - Number(Boolean(roomPreferences[a.id]?.pinned));
      if (pinnedDifference) return pinnedDifference;
      return mode === 'name'
        ? a.name.localeCompare(b.name)
        : new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });
    await onSaveRoomOrder(sorted);
    setRoomMenuId('');
    setSortMenuOpen(false);
  };

  const persistRoomCompactSettings = (nextSettings: RoomCompactSettings) => {
    setRoomCompactSettings(nextSettings);
    window.localStorage.setItem(roomCompactStorageKey, JSON.stringify(nextSettings));
  };

  const isRoomCompact = () => roomCompactSettings.all;

  const toggleAllRoomCompact = () => {
    persistRoomCompactSettings({ all: !roomCompactSettings.all, rooms: {} });
  };

  const dropRoom = async (targetRoomId: string) => {
    if (!draggedRoomId || draggedRoomId === targetRoomId) return;
    if (roomPreferences[draggedRoomId]?.pinned || roomPreferences[targetRoomId]?.pinned) return;
    const next = [...orderedSpaces];
    const sourceIndex = next.findIndex((space) => space.id === draggedRoomId);
    const targetIndex = next.findIndex((space) => space.id === targetRoomId);
    if (sourceIndex < 0 || targetIndex < 0) return;
    const [moved] = next.splice(sourceIndex, 1);
    next.splice(targetIndex, 0, moved);
    setDraggedRoomId('');
    await onSaveRoomOrder(next);
  };

  const openAccountView = (nextView: AccountModalView) => {
    setAccountMenuOpen(false);
    setSettingsMenuOpen(false);
    setHelpMenuOpen(false);
    onOpenAccount(nextView);
  };

  return (
    <>
      <div className={cn('fixed inset-0 z-40 bg-black/30 lg:hidden', sidebarOpen ? 'block' : 'hidden')} onClick={onClose} />
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 flex h-dvh w-[280px] flex-col overflow-visible border-r px-4 py-5 transition-transform lg:static lg:z-auto lg:translate-x-0',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full',
          theme === 'dark' ? 'border-white/10 bg-[#111018]' : 'border-[#E7E3EA] bg-white',
        )}
      >
        <div className="mb-5 flex items-center justify-between">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[var(--accent)] shadow-lg shadow-[var(--accent-strong)]/20">
              <TriCordLogo className="h-9 w-9" />
            </div>
            <div className="min-w-0">
              <p className={cn('truncate text-xl font-bold tracking-tight', theme === 'dark' ? 'text-[#FAF9FC]' : 'text-[#17151D]')}>TriCord</p>
              <p className={cn('truncate text-xs', muted(theme))}>{currentRoleLabel}</p>
            </div>
          </div>
          <button aria-label="Close navigation" onClick={onClose} className={cn('rounded-lg border p-2 lg:hidden', subtleButton(theme))}>
            <X className="h-4 w-4" />
          </button>
        </div>

        <nav className="space-y-1">
          <NavButton icon={MessageSquare} label="Active Feed" active={view === 'feed'} onClick={() => onViewChange('feed')} theme={theme} />
          <NavButton icon={ClipboardList} label="Tasks" active={view === 'tasks'} onClick={() => onViewChange('tasks')} theme={theme} />
          {currentRole !== 'guest' && <NavButton icon={FileText} label="Knowledge" active={view === 'knowledge'} onClick={() => onViewChange('knowledge')} theme={theme} />}
          {showBusinessNav && <div className={cn('my-3 flex items-center border-t pt-2', theme === 'dark' ? 'border-white/10' : 'border-[#E7E3EA]')}><span className={cn('min-w-0 flex-1 px-2 text-[10px] font-semibold uppercase tracking-[0.16em]', muted(theme))}>Workforce</span><button type="button" aria-label={workforceNavOpen ? 'Collapse workforce navigation' : 'Expand workforce navigation'} title={workforceNavOpen ? 'Collapse workforce navigation' : 'Expand workforce navigation'} onClick={() => setWorkforceNavOpen((open) => !open)} className={cn('inline-flex h-7 w-7 items-center justify-center rounded-md border', subtleButton(theme))}><ChevronDown className={cn('h-3.5 w-3.5 transition-transform', !workforceNavOpen && '-rotate-90')} /></button></div>}
          {showBusinessNav && workforceNavOpen && <>
            {canViewTimekeeping && <NavButton icon={Clock3} label="Attendance" active={view === 'timekeeping'} onClick={() => onViewChange('timekeeping')} theme={theme} />}
            {canViewHr && <NavButton icon={BriefcaseBusiness} label="Employee Records" active={view === 'hr'} onClick={() => onViewChange('hr')} theme={theme} />}
            {canViewPayroll && <NavButton icon={Banknote} label="Payroll Prep" active={view === 'payroll'} onClick={() => onViewChange('payroll')} theme={theme} />}
            {canViewReports && <NavButton icon={ChartNoAxesCombined} label="Attendance Reports" active={view === 'reports'} onClick={() => onViewChange('reports')} theme={theme} />}
            {canManageAdmin && <NavButton icon={ShieldCheck} label="Admin" active={view === 'admin'} onClick={() => onViewChange('admin')} theme={theme} />}
          </>}
        </nav>

        <section className="mt-7 flex min-h-0 flex-1 flex-col overflow-hidden">
          <div className={cn('mb-3 flex items-center justify-between px-2 text-xs font-semibold uppercase tracking-[0.18em]', muted(theme))}>
            Rooms
            {canCreateSpaces && (
              <button aria-label="Create room" onClick={onCreateSpace} className={cn('rounded p-1', theme === 'dark' ? 'hover:bg-white/10' : 'hover:bg-[#F0EDF3]')}>
                <Plus className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
          <div className="min-h-0 flex-1 space-y-2 overflow-y-auto pb-36 pr-1 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
            <div className={cn('flex items-center rounded-lg border transition', activeSpaceId === 'all' ? 'border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent-strong)]' : theme === 'dark' ? 'border-white/15 bg-white/[0.06] text-[#FAF9FC]' : 'border-[#E7E3EA] bg-white text-[#3D3744] hover:bg-[#F7F6F9]')}>
              <button onClick={() => onSpaceChange('all')} className="min-w-0 flex-1 p-3 text-left text-sm font-semibold">All posts</button>
              <button
                type="button"
                aria-label={roomCompactSettings.all ? 'Expand all rooms' : 'Collapse all rooms'}
                title={roomCompactSettings.all ? 'Expand all rooms' : 'Collapse all rooms'}
                onClick={toggleAllRoomCompact}
                className={cn('mr-2 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md transition', roomCompactSettings.all ? 'bg-[var(--accent)] text-[var(--accent-ink)]' : theme === 'dark' ? 'hover:bg-white/10' : 'hover:bg-[#F0EDF3]')}
              >
                {roomCompactSettings.all ? <PanelRightOpen className="h-4 w-4" /> : <PanelRightClose className="h-4 w-4" />}
              </button>
            </div>
            {orderedSpaces.map((space, index) => {
              const canManageRoom = canManageSpaces || (currentRole === 'member' && space.created_by === profile?.id);
              const preference = roomPreferences[space.id];
              const pinned = Boolean(preference?.pinned);
              const menuOpen = roomMenuId === space.id;
              const compactRoom = isRoomCompact();
              const menuOpensUp = orderedSpaces.length > 3 && orderedSpaces.length - index <= 2;
              return (
                <div
                  key={space.id}
                  className={cn('relative transition', draggedRoomId === space.id && 'opacity-45')}
                  draggable={reorderMode && !pinned}
                  onDragStart={() => setDraggedRoomId(space.id)}
                  onDragEnd={() => setDraggedRoomId('')}
                  onDragOver={(event) => { if (reorderMode && !pinned) event.preventDefault(); }}
                  onDrop={() => void dropRoom(space.id)}
                >
                  <button
                    onClick={() => onSpaceChange(space.id)}
                    className={cn('w-full rounded-lg border p-3 pr-11 text-left transition', reorderMode && !pinned && 'cursor-grab pl-9 active:cursor-grabbing', activeSpaceId === space.id ? 'border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent-strong)]' : theme === 'dark' ? 'border-white/15 bg-white/[0.06] text-[#FAF9FC]' : 'border-[#E7E3EA] bg-white text-[#3D3744] hover:bg-[#F7F6F9]')}
                  >
                    <div className="flex items-center gap-2">
                      <span className="h-2.5 w-2.5 rounded-full bg-[var(--accent)]" />
                      <span className="truncate text-sm font-semibold">{space.name}</span>
                      {pinned && <Pin className="h-3.5 w-3.5 shrink-0" aria-label="Pinned room" />}
                    </div>
                    {!compactRoom && <p className={cn('mt-1 text-xs capitalize', activeSpaceId === space.id ? 'text-[var(--accent-strong)]' : muted(theme))}>{getRoomAccessLabel(space.access)} room</p>}
                  </button>
                  {reorderMode && !pinned && <GripVertical className={cn('pointer-events-none absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2', muted(theme))} />}
                  <div ref={menuOpen ? roomMenuRef : undefined}>
                    <button
                      type="button"
                      aria-label={`${space.name} room options`}
                      title="Room options"
                      aria-expanded={menuOpen}
                      onClick={() => { setRoomMenuId((current) => current === space.id ? '' : space.id); setSortMenuOpen(false); }}
                      className={cn('absolute right-2 top-2 inline-flex h-8 w-8 items-center justify-center rounded-md transition', theme === 'dark' ? 'hover:bg-white/10' : 'hover:bg-[#F0EDF3]')}
                    >
                      <EllipsisVertical className="h-4 w-4" />
                    </button>
                    {menuOpen && (
                      <div className={cn('absolute right-2 z-[65] w-48 rounded-lg border p-1.5 text-sm shadow-2xl', menuOpensUp ? 'bottom-10' : 'top-10', theme === 'dark' ? 'border-white/10 bg-[#17151D] text-white' : 'border-[#E7E3EA] bg-white text-[#3D3744]')}>
                        <RoomMenuButton icon={Mail} label="Email integration" onClick={() => { setRoomMenuId(''); onOpenRoomEmail(space); }} />
                        {canManageRoom && <RoomMenuButton icon={Pencil} label="Rename" onClick={() => { setRoomMenuId(''); onRenameSpace(space); }} />}
                        <RoomMenuButton icon={GripVertical} label={reorderMode ? 'Finish moving' : 'Move'} onClick={() => { setReorderMode((active) => !active); setRoomMenuId(''); }} />
                        <RoomMenuButton icon={ArrowUpDown} label="Sort" trailing={ChevronRight} active={sortMenuOpen} onClick={() => setSortMenuOpen((open) => !open)} />
                        {sortMenuOpen && (
                          <div className="mb-1 ml-3 border-l border-current/15 pl-2">
                            <RoomMenuButton label="Name A–Z" onClick={() => void saveSortedRooms('name')} />
                            <RoomMenuButton label="Newest first" onClick={() => void saveSortedRooms('newest')} />
                          </div>
                        )}
                        <RoomMenuButton icon={pinned ? PinOff : Pin} label={pinned ? 'Unpin' : 'Pin'} onClick={() => { setRoomMenuId(''); void onSetRoomPinned(space, !pinned); }} />
                        {canManageRoom && (
                          <>
                            <div className="my-1 border-t border-current/10" />
                            <RoomMenuButton icon={Trash2} label="Delete" danger onClick={() => { setRoomMenuId(''); void onDeleteSpace(space); }} />
                          </>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        <div ref={accountMenuRef} className="relative mt-auto shrink-0 pt-4">
          {accountMenuOpen && (
            <div className="absolute bottom-[calc(100%+0.5rem)] left-0 right-0 z-[70] rounded-lg border border-white/10 bg-[#17151D] p-2 text-[#FAF9FC] shadow-2xl">
              <div className="flex items-center gap-3 border-b border-white/10 px-2 pb-3 pt-1">
                <Avatar profile={profile} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold">{accountName}</p>
                  <p className="text-xs text-[#AAA4B3]">{planLabel}</p>
                </div>
              </div>
              <div className="mt-2 grid gap-1">
                {ownerCanManageBilling && <AccountMenuButton icon={CreditCard} label="Manage billing" onClick={() => { setAccountMenuOpen(false); onOpenBilling(); }} />}
                {ownerCanManageBilling && <div className="my-1 border-t border-white/10" />}
                <p className="px-3 pb-1 pt-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-[#AAA4B3]">Hubs</p>
                {workspaces.map((workspace) => (
                  <button
                    key={workspace.id}
                    type="button"
                    onClick={() => {
                      setAccountMenuOpen(false);
                      void onSelectWorkspace(workspace.id);
                    }}
                    className={cn('flex min-h-10 w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm transition hover:bg-white/10', workspace.id === workspaceId && 'bg-white/10')}
                  >
                    <Globe2 className="h-4 w-4 shrink-0" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-semibold">{workspace.name}</span>
                      <span className="block text-xs capitalize text-[#AAA4B3]">{getRoleLabel(workspace.role ?? 'member')}</span>
                    </span>
                    {workspace.id === workspaceId && <span className="h-2 w-2 shrink-0 rounded-full bg-[var(--accent)]" aria-label="Current Hub" />}
                  </button>
                ))}
                <AccountMenuButton icon={Plus} label="Create Hub" onClick={() => { setAccountMenuOpen(false); onCreateHub(); }} />
                <div className="my-1 border-t border-white/10" />
                <div className="relative">
                  <AccountMenuButton icon={Settings} label="Settings" rooming={ChevronRight} active={settingsMenuOpen} onClick={() => { setSettingsMenuOpen((open) => !open); setHelpMenuOpen(false); }} />
                  {settingsMenuOpen && (
                    <>
                      <div className="mt-1 grid gap-1 border-t border-white/10 pt-1 lg:hidden">
                        <AccountMenuButton icon={Palette} label="Personalization" onClick={() => openAccountView('personalization')} />
                        <AccountMenuButton icon={User} label="Profile" onClick={() => openAccountView('profile')} />
                        <AccountMenuButton icon={Bell} label="Notifications" onClick={() => openAccountView('notifications')} />
                        <AccountMenuButton icon={Settings} label="Hub Settings" onClick={() => openAccountView('settings')} />
                        {currentRole === 'owner' && <AccountMenuButton icon={CreditCard} label="Subscription" onClick={() => openAccountView('subscription')} />}
                      </div>
                      <div className="absolute bottom-0 left-[calc(100%+0.75rem)] hidden w-56 gap-1 rounded-lg border border-white/10 bg-[#17151D] p-2 shadow-2xl lg:grid">
                        <AccountMenuButton icon={Palette} label="Personalization" onClick={() => openAccountView('personalization')} />
                        <AccountMenuButton icon={User} label="Profile" onClick={() => openAccountView('profile')} />
                        <AccountMenuButton icon={Bell} label="Notifications" onClick={() => openAccountView('notifications')} />
                        <AccountMenuButton icon={Settings} label="Hub Settings" onClick={() => openAccountView('settings')} />
                        {currentRole === 'owner' && <AccountMenuButton icon={CreditCard} label="Subscription" onClick={() => openAccountView('subscription')} />}
                      </div>
                    </>
                  )}
                </div>
                <div className="relative">
                  <AccountMenuButton icon={CircleHelp} label="Help" rooming={ChevronRight} active={helpMenuOpen} onClick={() => { setHelpMenuOpen((open) => !open); setSettingsMenuOpen(false); }} />
                  {helpMenuOpen && (
                    <>
                      <div className="mt-1 grid gap-1 border-t border-white/10 pt-1 lg:hidden">
                        <AccountMenuButton icon={CircleHelp} label="Help center" onClick={() => openAccountView('help')} />
                        <AccountMenuButton icon={Info} label="About TriCord" onClick={() => openAccountView('about')} />
                        <AccountMenuButton icon={Bug} label="Report a problem" onClick={() => openAccountView('report')} />
                      </div>
                      <div className="absolute bottom-0 left-[calc(100%+0.75rem)] hidden w-56 gap-1 rounded-lg border border-white/10 bg-[#17151D] p-2 shadow-2xl lg:grid">
                        <AccountMenuButton icon={CircleHelp} label="Help center" onClick={() => openAccountView('help')} />
                        <AccountMenuButton icon={Info} label="About TriCord" onClick={() => openAccountView('about')} />
                        <AccountMenuButton icon={Bug} label="Report a problem" onClick={() => openAccountView('report')} />
                      </div>
                    </>
                  )}
                </div>
                <div className="my-1 border-t border-white/10" />
                <AccountMenuButton icon={LogOut} label="Log out" onClick={onSignOut} />
              </div>
            </div>
          )}
          <button
            type="button"
            aria-label="Open account menu"
            aria-expanded={accountMenuOpen}
            onClick={() => {
              setAccountMenuOpen((open) => !open);
              setSettingsMenuOpen(false);
              setHelpMenuOpen(false);
            }}
            className={cn('flex w-full items-center gap-3 rounded-lg border p-2 text-left transition', theme === 'dark' ? 'border-white/15 bg-white/[0.06] text-[#FAF9FC] hover:bg-white/10' : 'border-[#E7E3EA] bg-[#F7F6F9] text-[#17151D] hover:bg-[#F0EDF3]')}
          >
            <Avatar profile={profile} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-bold">{accountName}</p>
              <p className={cn('text-xs', muted(theme))}>{planLabel}</p>
            </div>
            <ChevronRight className={cn('h-4 w-4 shrink-0 transition-transform', accountMenuOpen && '-rotate-90')} />
          </button>
        </div>
      </aside>
    </>
  );
}

function RoomMenuButton({ icon: Icon, label, trailing: TrailingIcon, active = false, danger = false, onClick }: { icon?: LucideIcon; label: string; trailing?: LucideIcon; active?: boolean; danger?: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn('flex h-9 w-full items-center gap-2 rounded-md px-2.5 text-left font-semibold transition hover:bg-[var(--accent-soft)] hover:text-[var(--accent-strong)]', active && 'bg-black/5', danger && 'text-[#B91C1C]')}
    >
      {Icon ? <Icon className="h-4 w-4 shrink-0" /> : <span className="w-4 shrink-0" />}
      <span className="min-w-0 flex-1 truncate">{label}</span>
      {TrailingIcon && <TrailingIcon className={cn('h-4 w-4 shrink-0 transition', active && 'rotate-90')} />}
    </button>
  );
}

function Metrics({ posts, tasks, knowledgeCount, theme }: { posts: AppPost[]; tasks: AppTask[]; knowledgeCount: number; theme: 'light' | 'dark' }) {
  const openPosts = posts.filter((post) => post.state === 'open').length;
  const openTasks = tasks.filter((task) => task.status !== 'done' && task.status !== 'canceled').length;

  return (
    <div className="grid shrink-0 grid-cols-3 gap-2 md:gap-3">
      <MetricCard label="Open posts" value={openPosts} theme={theme} />
      <MetricCard label="Knowledge" value={knowledgeCount} theme={theme} />
      <MetricCard label="Open tasks" value={openTasks} theme={theme} />
    </div>
  );
}

function MetricCard({ label, value, theme }: { label: string; value: number; theme: 'light' | 'dark' }) {
  return (
    <div className={cn('relative overflow-hidden rounded-lg border p-3 md:p-4', surface(theme))}>
      <p className={cn('text-[10px] font-semibold uppercase tracking-[0.14em] md:text-xs md:tracking-[0.18em]', muted(theme))}>{label}</p>
      <p className="mt-2 text-2xl font-bold md:mt-3">{value}</p>
    </div>
  );
}

function SortBar({ sort, setSort, theme }: { sort: SortMode; setSort: (sort: SortMode) => void; theme: 'light' | 'dark' }) {
  return (
    <div className={cn('mt-3 flex shrink-0 gap-1 overflow-hidden rounded-lg border p-1 md:mt-4 md:gap-2', surface(theme))}>
      {sortOptions.map((option) => (
        <button
          key={option.value}
          onClick={() => setSort(option.value)}
          className={cn('h-8 rounded-md px-2 text-xs font-semibold transition md:h-9 md:px-3 md:text-sm', sort === option.value ? 'bg-[var(--accent)] text-[var(--accent-ink)] shadow-sm' : cn(muted(theme), 'hover:bg-[var(--accent-soft)]'))}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

function PostRow({
  post,
  selected,
  profile,
  theme,
  space,
  members,
  onClick,
  canManage,
  onEdit,
  onAssign,
  onArchive,
  onDelete,
}: {
  post: AppPost;
  selected: boolean;
  profile?: AppProfile;
  theme: 'light' | 'dark';
  space?: AppSpace;
  members: AppProfile[];
  onClick: () => void;
  canManage: boolean;
  onEdit: () => void;
  onAssign: (assigneeId: string) => Promise<void>;
  onArchive: () => Promise<void>;
  onDelete: () => Promise<void>;
}) {
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') onClick();
      }}
      className={cn('w-full rounded-lg border p-4 text-left transition', selected ? 'border-[var(--accent)] shadow-lg shadow-[var(--accent-strong)]/15' : surface(theme))}
    >
      <div className="flex flex-wrap items-center gap-2">
        <StatusPill state={post.state} />
        {space && <span className={cn('rounded-full px-2.5 py-1 text-xs font-semibold', theme === 'dark' ? 'bg-white/10 text-[#B8B3C2]' : 'bg-[#E4F1F3] text-[#185C74]')}>{space.name}</span>}
        <span className={cn('ml-auto text-xs', muted(theme))}>{formatTimeAgo(post.last_activity_at)}</span>
      </div>
      <h2 className="mt-3 text-lg font-bold tracking-tight">{post.title}</h2>
      <p className={cn('mt-2 line-clamp-2 text-sm leading-6', muted(theme))}>{post.body}</p>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <Avatar profile={profile} />
          <span className="truncate text-sm font-semibold">{getProfileName(profile)}</span>
        </div>
        <div className="ml-auto flex flex-wrap items-center justify-end gap-2">
          <label className="sr-only" htmlFor={`assignee-${post.id}`}>Assign post</label>
          <select
            id={`assignee-${post.id}`}
            value={typeof post.metadata?.assigned_to === 'string' ? post.metadata.assigned_to : ''}
            disabled={post.state === 'archived'}
            title="Assign post"
            onClick={(event) => event.stopPropagation()}
            onChange={(event) => {
              event.stopPropagation();
              void onAssign(event.target.value);
            }}
            className={cn('h-9 max-w-40 rounded-lg border px-2 text-xs font-semibold outline-none disabled:cursor-not-allowed disabled:opacity-60', subtleButton(theme))}
          >
            <option value="">All</option>
            {members.map((member) => <option key={member.id} value={member.id}>{getProfileName(member)}</option>)}
          </select>
          <button
            type="button"
            aria-label={post.state === 'archived' ? 'Restore post' : 'Archive post'}
            title={post.state === 'archived' ? 'Restore post' : 'Archive post'}
            onClick={(event) => {
              event.stopPropagation();
              void onArchive();
            }}
            className={cn('inline-flex h-9 w-9 items-center justify-center rounded-lg border', subtleButton(theme))}
          >
            {post.state === 'archived' ? <ArchiveRestore className="h-3.5 w-3.5" /> : <Archive className="h-3.5 w-3.5" />}
          </button>
          {canManage && (
            <>
            <button
              type="button"
              aria-label="Edit post"
              title="Edit post"
              onClick={(event) => {
                event.stopPropagation();
                onEdit();
              }}
              className={cn('inline-flex h-9 w-9 items-center justify-center rounded-lg border', subtleButton(theme))}
            >
              <Pencil className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              aria-label="Delete post"
              title="Delete post"
              onClick={(event) => {
                event.stopPropagation();
                void onDelete();
              }}
              className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-[#FCA5A5] bg-[#FEF2F2] text-[#B91C1C]"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function ThreadPanel({
  post,
  profile,
  comments,
  attachments,
  reactions,
  recentPosts,
  profiles,
  mentionProfiles,
  theme,
  currentUserId,
  canManage,
  width,
  onWidthChange,
  onClose,
  canClose,
  onConfirm,
  premiumEmail,
  emailAccounts,
  selectedEmailAccountId,
  fallbackSenderAddress,
  onSelectedEmailAccountIdChange,
  onReply,
  onReact,
  onEditComment,
  onDeleteComment,
  onForward,
}: {
  post?: AppPost;
  profile?: AppProfile;
  comments: AppComment[];
  attachments: AppAttachment[];
  reactions: AppReaction[];
  recentPosts: AppPost[];
  profiles: Record<string, AppProfile>;
  mentionProfiles: AppProfile[];
  theme: 'light' | 'dark';
  currentUserId: string;
  canManage: boolean;
  width: number;
  onWidthChange: (width: number) => void;
  onClose: () => void;
  canClose: boolean;
  onConfirm: (dialog: ConfirmDialogState) => void;
  premiumEmail: boolean;
  emailAccounts: UserEmailAccount[];
  selectedEmailAccountId: string;
  fallbackSenderAddress: string;
  onSelectedEmailAccountIdChange: (accountId: string) => void;
  onReply: (body: string, files: File[], externalAttachments: ExternalAttachmentDraft[], parentCommentId: string | null, providerAccountId: string) => Promise<void>;
  onReact: (commentId: string | null, emoji: string) => Promise<void>;
  onEditComment: (commentId: string, body: string) => Promise<void>;
  onDeleteComment: (commentId: string) => Promise<void>;
  onForward: (messageIds: string[], targetPostIds: string[]) => Promise<void>;
}) {
  const [reply, setReply] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [externalAttachments, setExternalAttachments] = useState<ExternalAttachmentDraft[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [dragActive, setDragActive] = useState(false);
  const [attachmentMenuOpen, setAttachmentMenuOpen] = useState(false);
  const [composerEmojiOpen, setComposerEmojiOpen] = useState(false);
  const [replyingTo, setReplyingTo] = useState<AppComment | null>(null);
  const [editingComment, setEditingComment] = useState<AppComment | null>(null);
  const [forwarding, setForwarding] = useState(false);
  const [selectedMessageIds, setSelectedMessageIds] = useState<Set<string>>(new Set());
  const [forwardModalOpen, setForwardModalOpen] = useState(false);
  const [cameraAvailable, setCameraAvailable] = useState(false);
  const latestMessageRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const attachmentMenuRef = useRef<HTMLDivElement | null>(null);
  const loadedDraftKeyRef = useRef('');
  const skipNextDraftSaveRef = useRef(false);
  const [mentionMatch, setMentionMatch] = useState<{ query: string; start: number; end: number } | null>(null);
  const [mentionActiveIndex, setMentionActiveIndex] = useState(0);
  const replyDraftKey = post ? `${REPLY_DRAFT_STORAGE_KEY}:${currentUserId}:${post.workspace_id}:${post.id}` : '';
  const mentionOptions = useMemo(() => {
    if (!mentionMatch) return [];
    const query = mentionMatch.query.toLowerCase();
    return mentionProfiles
      .filter((mentionProfile) => getMentionSearchValue(mentionProfile).includes(query))
      .slice(0, 8);
  }, [mentionMatch, mentionProfiles]);
  const emailCommandPreview = premiumEmail ? parseEmailSendCommand(reply) : null;
  const lockedEmailCommand = !premiumEmail && Boolean(parseEmailSendCommand(reply));
  const connectedEmailAccounts = premiumEmail ? emailAccounts.filter((account) => account.is_connected) : [];

  useEffect(() => {
    latestMessageRef.current?.scrollIntoView({ block: 'end', behavior: 'smooth' });
  }, [post?.id, comments.length, attachments.length, reactions.length]);

  useEffect(() => {
    setMentionMatch(null);
    setMentionActiveIndex(0);
    if (!replyDraftKey) {
      loadedDraftKeyRef.current = '';
      setReply('');
      return;
    }
    loadedDraftKeyRef.current = replyDraftKey;
    skipNextDraftSaveRef.current = true;
    setReply(window.localStorage.getItem(replyDraftKey) ?? '');
    setFiles([]);
    setExternalAttachments([]);
    setReplyingTo(null);
  }, [replyDraftKey]);

  useEffect(() => {
    if (!replyDraftKey || loadedDraftKeyRef.current !== replyDraftKey) return;
    if (skipNextDraftSaveRef.current) {
      skipNextDraftSaveRef.current = false;
      return;
    }
    if (reply.trim()) window.localStorage.setItem(replyDraftKey, reply);
    else window.localStorage.removeItem(replyDraftKey);
  }, [reply, replyDraftKey]);

  useEffect(() => {
    if (!error) return;
    const timeoutId = window.setTimeout(() => setError(''), 10000);
    return () => window.clearTimeout(timeoutId);
  }, [error]);

  useEffect(() => {
    setForwarding(false);
    setForwardModalOpen(false);
    setComposerEmojiOpen(false);
    setEditingComment(null);
    setSelectedMessageIds(new Set());
  }, [post?.id]);

  useEffect(() => {
    if (!attachmentMenuOpen) return;
    const closeMenu = (event: PointerEvent) => {
      if (!attachmentMenuRef.current?.contains(event.target as Node)) setAttachmentMenuOpen(false);
    };
    document.addEventListener('pointerdown', closeMenu);
    return () => document.removeEventListener('pointerdown', closeMenu);
  }, [attachmentMenuOpen]);

  useEffect(() => {
    let active = true;
    const mediaDevices = navigator.mediaDevices;
    const detectCamera = async () => {
      const mobileCapture = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent) && Boolean(mediaDevices?.getUserMedia);
      if (!mediaDevices?.enumerateDevices) {
        if (active) setCameraAvailable(mobileCapture);
        return;
      }
      try {
        const devices = await mediaDevices.enumerateDevices();
        if (active) setCameraAvailable(mobileCapture || devices.some((device) => device.kind === 'videoinput'));
      } catch {
        if (active) setCameraAvailable(mobileCapture);
      }
    };
    void detectCamera();
    mediaDevices?.addEventListener?.('devicechange', detectCamera);
    return () => {
      active = false;
      mediaDevices?.removeEventListener?.('devicechange', detectCamera);
    };
  }, []);

  const addFiles = (incoming: FileList | File[]) => {
    const incomingFiles = Array.from(incoming);
    const accepted: File[] = [];
    const rejected: string[] = [];
    incomingFiles.forEach((file) => {
      const validation = validateUploadFile(file);
      if (validation) rejected.push(`${file.name}: ${validation}`);
      else accepted.push(file);
    });
    setFiles((current) => [...current, ...accepted].slice(0, MAX_ATTACHMENTS_PER_MESSAGE));
    if (rejected.length) setError(rejected.slice(0, 3).join(' '));
    else if (incomingFiles.length + files.length + externalAttachments.length > MAX_ATTACHMENTS_PER_MESSAGE) setError(`Only ${MAX_ATTACHMENTS_PER_MESSAGE} attachments can be added to one message.`);
  };

  const addExternalAttachment = (attachment: ExternalAttachmentDraft) => {
    if (files.length + externalAttachments.length >= MAX_ATTACHMENTS_PER_MESSAGE) {
      setError(`Only ${MAX_ATTACHMENTS_PER_MESSAGE} attachments can be added to one message.`);
      return;
    }
    setExternalAttachments((current) => [...current, attachment]);
    setError('');
  };

  const openFilePicker = (accept: string, capture = false) => {
    const input = fileInputRef.current;
    if (!input) return;
    input.accept = accept;
    if (capture) input.setAttribute('capture', 'environment');
    else input.removeAttribute('capture');
    input.click();
  };

  const updateMentionMatch = (value: string, caretPosition = textareaRef.current?.selectionStart ?? value.length) => {
    const nextMatch = getActiveMentionMatch(value, caretPosition);
    setMentionMatch(nextMatch);
    setMentionActiveIndex(0);
  };

  const insertMention = (mentionProfile: AppProfile) => {
    if (!mentionMatch) return;
    const mentionName = getProfileName(mentionProfile, mentionProfile.email.split('@')[0] || 'Hub member').replace(/\s+/g, ' ').trim();
    const mentionText = `@${mentionName} `;
    const nextReply = `${reply.slice(0, mentionMatch.start)}${mentionText}${reply.slice(mentionMatch.end)}`;
    const nextCursor = mentionMatch.start + mentionText.length;
    setReply(nextReply);
    setMentionMatch(null);
    setMentionActiveIndex(0);
    window.requestAnimationFrame(() => {
      textareaRef.current?.focus();
      textareaRef.current?.setSelectionRange(nextCursor, nextCursor);
    });
  };

  const insertEmoji = (emoji: string) => {
    const cursorStart = textareaRef.current?.selectionStart ?? reply.length;
    const cursorEnd = textareaRef.current?.selectionEnd ?? cursorStart;
    const nextReply = `${reply.slice(0, cursorStart)}${emoji}${reply.slice(cursorEnd)}`;
    const nextCursor = cursorStart + emoji.length;
    setReply(nextReply);
    setComposerEmojiOpen(false);
    setMentionMatch(null);
    window.requestAnimationFrame(() => {
      textareaRef.current?.focus();
      textareaRef.current?.setSelectionRange(nextCursor, nextCursor);
    });
  };

  const addPastedImages = (clipboardFiles: FileList) => {
    const pastedImages = Array.from(clipboardFiles).filter((file) => file.type.startsWith('image/'));
    if (pastedImages.length === 0) return false;
    const now = Date.now();
    addFiles(pastedImages.map((file, index) => {
      const extension = getImageExtension(file.type);
      const filename = file.name && file.name !== 'image.png' ? file.name : `pasted-image-${now}-${index + 1}.${extension}`;
      return new File([file], filename, { type: file.type || 'image/png', lastModified: now });
    }));
    return true;
  };

  const beginForward = (messageId: string) => {
    setForwarding(true);
    setSelectedMessageIds(new Set([messageId]));
  };

  const beginEditComment = (comment: AppComment) => {
    setEditingComment(comment);
    setReplyingTo(null);
    setFiles([]);
    setExternalAttachments([]);
    setError('');
    setReply(comment.body);
    window.requestAnimationFrame(() => {
      textareaRef.current?.focus();
      textareaRef.current?.setSelectionRange(comment.body.length, comment.body.length);
    });
  };

  const toggleForwardSelection = (messageId: string) => {
    setSelectedMessageIds((current) => {
      const next = new Set(current);
      if (next.has(messageId)) next.delete(messageId);
      else next.add(messageId);
      return next;
    });
  };

  if (!post) {
    return (
      <aside className={cn('fixed inset-y-0 right-0 z-[75] flex w-full max-w-[min(100vw,28rem)] flex-col overflow-hidden border-l p-6 shadow-2xl xl:relative xl:z-auto xl:w-auto xl:max-w-none xl:shadow-none', theme === 'dark' ? 'border-white/10 bg-[#121017]' : 'border-[#E7E3EA] bg-[#FFFFFF]')}>
        <ThreadResizeHandle theme={theme} width={width} onWidthChange={onWidthChange} />
        <div className="absolute left-4 top-4 z-10 hidden xl:block">
          <ThreadWidthPresets theme={theme} width={width} onWidthChange={onWidthChange} />
        </div>
        {canClose && <button
          type="button"
          aria-label="Toggle side panel"
          title="Toggle side panel"
          onClick={onClose}
          className={cn('absolute right-4 top-4 z-10 inline-flex h-9 w-9 items-center justify-center rounded-lg border', subtleButton(theme))}
        >
          <PanelRightClose className="h-4 w-4" />
        </button>}
        <EmptyState theme={theme} icon={MessageSquare} title="No thread selected" body="Select or create a post to view its discussion." />
      </aside>
    );
  }

  return (
    <aside className={cn('fixed inset-y-0 right-0 z-[75] flex w-full max-w-[min(100vw,28rem)] flex-col overflow-hidden border-l shadow-2xl xl:relative xl:z-auto xl:w-auto xl:max-w-none xl:shadow-none', theme === 'dark' ? 'border-white/10 bg-[#121017]' : 'border-[#E7E3EA] bg-[#FFFFFF]')}>
      <ThreadResizeHandle theme={theme} width={width} onWidthChange={onWidthChange} />
      <div className="shrink-0 border-b border-inherit p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <StatusPill state={post.state} />
            <h2 className="mt-3 text-xl font-bold tracking-tight">{post.title}</h2>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <ThreadWidthPresets theme={theme} width={width} onWidthChange={onWidthChange} />
          {canClose && <button
            type="button"
            aria-label="Toggle side panel"
            title="Toggle side panel"
            onClick={onClose}
            className={cn('inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border', subtleButton(theme))}
          >
            <PanelRightClose className="h-4 w-4" />
          </button>}
          </div>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-5 scroll-area">
        <div className="flex items-start gap-2">
          {forwarding && <MessageSelectionCheckbox checked={selectedMessageIds.has(post.id)} onChange={() => toggleForwardSelection(post.id)} />}
          <div className="min-w-0 flex-1">
            <ThreadCard
              profile={profile}
              body={post.body}
              timestamp={post.created_at}
              theme={theme}
              workspaceId={post.workspace_id}
              reactions={reactions.filter((reaction) => reaction.post_id === post.id && !reaction.comment_id)}
              currentUserId={currentUserId}
              mentionProfiles={mentionProfiles}
              onReply={() => { setReplyingTo(null); textareaRef.current?.focus(); }}
              onReact={(emoji) => onReact(null, emoji)}
              onForward={() => beginForward(post.id)}
            />
          </div>
        </div>
        <div className="mt-4 space-y-3">
          {comments.map((comment) => (
            <div key={comment.id} className="flex items-start gap-2">
              {forwarding && <MessageSelectionCheckbox checked={selectedMessageIds.has(comment.id)} onChange={() => toggleForwardSelection(comment.id)} />}
              <div className="min-w-0 flex-1">
                <ThreadCard
                  profile={profiles[comment.author_id]}
                  body={comment.body}
                  timestamp={comment.created_at}
                  theme={theme}
                  attachments={attachments.filter((attachment) => attachment.comment_id === comment.id)}
                  workspaceId={comment.workspace_id}
                  reactions={reactions.filter((reaction) => reaction.comment_id === comment.id)}
                  currentUserId={currentUserId}
                  mentionProfiles={mentionProfiles}
                  preferMenuAbove
                  parentComment={comments.find((item) => item.id === comment.parent_comment_id)}
                  onReply={() => { setReplyingTo(comment); textareaRef.current?.focus(); }}
                  onReact={(emoji) => onReact(comment.id, emoji)}
                  onForward={() => beginForward(comment.id)}
                  onEdit={comment.author_id === currentUserId || canManage ? () => beginEditComment(comment) : undefined}
                  onDelete={comment.author_id === currentUserId || canManage ? async () => {
                    onConfirm({
                      title: 'Delete message?',
                      body: 'Delete this message? This cannot be undone.',
                      confirmLabel: 'Delete message',
                      onConfirm: async () => { await onDeleteComment(comment.id); },
                    });
                  } : undefined}
                />
              </div>
            </div>
          ))}
          <div ref={latestMessageRef} />
        </div>
      </div>

      {forwarding && (
        <div className={cn('flex shrink-0 items-center gap-3 border-t p-4', theme === 'dark' ? 'border-white/10 bg-[#0C0B10]' : 'border-[#E7E3EA] bg-[#F5F4F7]')}>
          <button type="button" onClick={() => { setForwarding(false); setSelectedMessageIds(new Set()); }} className={cn('h-10 rounded-lg border px-3 text-sm font-semibold', subtleButton(theme))}>Cancel</button>
          <span className={cn('text-sm', muted(theme))}>{selectedMessageIds.size} selected</span>
          <button type="button" disabled={selectedMessageIds.size === 0} onClick={() => setForwardModalOpen(true)} className="ml-auto inline-flex h-10 items-center gap-2 rounded-lg bg-[var(--accent-strong)] px-4 text-sm font-semibold text-white disabled:opacity-50"><Share2 className="h-4 w-4" />Forward</button>
        </div>
      )}

      <form
        className={cn('relative shrink-0 border-t p-4', forwarding && 'hidden', dragActive && 'ring-2 ring-inset ring-[var(--accent)]', theme === 'dark' ? 'border-white/10 bg-[#0C0B10]' : 'border-[#E7E3EA] bg-[#F5F4F7]')}
        onDragEnter={(event) => { event.preventDefault(); setDragActive(true); }}
        onDragOver={(event) => { event.preventDefault(); setDragActive(true); }}
        onDragLeave={(event) => { event.preventDefault(); if (!event.currentTarget.contains(event.relatedTarget as Node)) setDragActive(false); }}
        onDrop={(event) => {
          event.preventDefault();
          setDragActive(false);
          addFiles(event.dataTransfer.files);
        }}
        onSubmit={async (event) => {
          event.preventDefault();
          if (!reply.trim() && files.length === 0 && externalAttachments.length === 0) return;
          if (reply.length > MAX_MESSAGE_CHARACTERS) { setError(`Messages must be ${MAX_MESSAGE_CHARACTERS.toLocaleString()} characters or fewer.`); return; }
          setSubmitting(true);
          setError('');
          try {
            if (editingComment) {
              await onEditComment(editingComment.id, reply.trim());
            } else {
              await onReply(reply.trim(), files, externalAttachments, replyingTo?.id ?? null, selectedEmailAccountId || 'room');
            }
            if (replyDraftKey) window.localStorage.removeItem(replyDraftKey);
            setMentionMatch(null);
            setReply('');
            setFiles([]);
            setExternalAttachments([]);
            setReplyingTo(null);
            setEditingComment(null);
          } catch (caughtError) {
            setError(getErrorMessage(caughtError));
          } finally {
            setSubmitting(false);
          }
        }}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          className="hidden"
          onChange={(event) => {
            if (event.target.files) addFiles(event.target.files);
            event.target.value = '';
            setAttachmentMenuOpen(false);
          }}
        />
        {lockedEmailCommand && (
          <p className="mb-2 rounded-lg border border-[#FDBA74] bg-[#FFF7ED] px-3 py-2 text-xs font-semibold text-[#9A3412]">Connect Google Workspace/Gmail or Microsoft 365/Outlook to send email from discussions.</p>
        )}
        {emailCommandPreview && (
          <div className={cn('mb-2 flex flex-wrap items-center gap-2 rounded-lg border px-3 py-2 text-xs', subtleButton(theme))}>
            <span className={cn('font-semibold', muted(theme))}>From</span>
            <select
              value={selectedEmailAccountId || 'room'}
              onChange={(event) => onSelectedEmailAccountIdChange(event.target.value)}
              className="min-w-[12rem] flex-1 rounded-md border border-inherit bg-transparent px-2 py-1 text-sm font-semibold outline-none"
            >
              <option value="room">Room Email · {fallbackSenderAddress}</option>
              {connectedEmailAccounts.map((account) => (
                <option key={account.id} value={account.id}>{formatEmailProviderLabel(account.provider)} · {account.email_address}{account.is_default ? ' · Default' : ''}</option>
              ))}
            </select>
          </div>
        )}
        {editingComment && (
          <div className={cn('mb-2 flex items-start gap-2 rounded-lg border px-3 py-2 text-xs', subtleButton(theme))}>
            <Pencil className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span className="min-w-0 flex-1"><strong>Editing message</strong><span className={cn('ml-2', muted(theme))}>Save changes or cancel editing.</span></span>
            <button type="button" aria-label="Cancel edit" title="Cancel edit" onClick={() => { setEditingComment(null); setReply(''); }}><X className="h-3.5 w-3.5" /></button>
          </div>
        )}
        {replyingTo && !editingComment && (
          <div className={cn('mb-2 flex items-start gap-2 rounded-lg border px-3 py-2 text-xs', subtleButton(theme))}>
            <ReplyIcon className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span className="min-w-0 flex-1">
              <strong>{getProfileName(profiles[replyingTo.author_id])}</strong>
              <span className={cn('ml-2 line-clamp-1', muted(theme))}>{replyingTo.body || 'Attachment'}</span>
            </span>
            <button type="button" aria-label="Cancel reply" title="Cancel reply" onClick={() => setReplyingTo(null)}><X className="h-3.5 w-3.5" /></button>
          </div>
        )}
        {mentionOptions.length > 0 && (
          <MentionSuggestions
            theme={theme}
            profiles={mentionOptions}
            activeIndex={Math.min(mentionActiveIndex, mentionOptions.length - 1)}
            onSelect={insertMention}
          />
        )}
        <textarea
          ref={textareaRef}
          value={reply}
          onChange={(event) => {
            setReply(event.target.value);
            updateMentionMatch(event.target.value, event.target.selectionStart);
          }}
          onClick={(event) => updateMentionMatch(reply, event.currentTarget.selectionStart)}
          onKeyUp={(event) => {
            if (['ArrowDown', 'ArrowUp', 'Enter', 'Tab', 'Escape'].includes(event.key)) return;
            updateMentionMatch(reply, event.currentTarget.selectionStart);
          }}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !event.nativeEvent.isComposing) {
              if (event.altKey) {
                event.preventDefault();
                const textarea = event.currentTarget;
                const start = textarea.selectionStart;
                const end = textarea.selectionEnd;
                const nextReply = reply.slice(0, start) + '\n' + reply.slice(end);
                setReply(nextReply);
                setMentionMatch(null);
                window.requestAnimationFrame(() => {
                  textarea.selectionStart = start + 1;
                  textarea.selectionEnd = start + 1;
                });
                return;
              }
              if (mentionOptions.length > 0) {
                event.preventDefault();
                insertMention(mentionOptions[Math.min(mentionActiveIndex, mentionOptions.length - 1)]);
                return;
              }
              event.preventDefault();
              event.currentTarget.form?.requestSubmit();
              return;
            }
            if (mentionOptions.length === 0) return;
            if (event.key === 'ArrowDown') {
              event.preventDefault();
              setMentionActiveIndex((index) => (index + 1) % mentionOptions.length);
            } else if (event.key === 'ArrowUp') {
              event.preventDefault();
              setMentionActiveIndex((index) => (index - 1 + mentionOptions.length) % mentionOptions.length);
            } else if (event.key === 'Tab') {
              event.preventDefault();
              insertMention(mentionOptions[Math.min(mentionActiveIndex, mentionOptions.length - 1)]);
            } else if (event.key === 'Escape') {
              event.preventDefault();
              setMentionMatch(null);
            }
          }}
          onPaste={(event) => {
            if (addPastedImages(event.clipboardData.files)) event.preventDefault();
          }}
          onBlur={() => window.setTimeout(() => setMentionMatch(null), 120)}
          placeholder="Reply to this post"
          className={cn('min-h-24 max-h-[40dvh] w-full resize-y overflow-y-auto rounded-lg border bg-transparent p-3 text-sm leading-6 outline-none scroll-area', subtleButton(theme))}
        />
        {!editingComment && (files.length > 0 || externalAttachments.length > 0) && (
          <div className="mt-2 flex flex-wrap gap-2">
            {files.map((file, index) => (
              <span key={`${file.name}-${index}`} className={cn('inline-flex max-w-full items-center gap-2 rounded-lg border px-2 py-1 text-xs', subtleButton(theme))}>
                <FileIcon className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate">{file.name}</span>
                <button type="button" aria-label={`Remove ${file.name}`} title="Remove attachment" onClick={() => setFiles((current) => current.filter((_, itemIndex) => itemIndex !== index))}>
                  <X className="h-3.5 w-3.5" />
                </button>
              </span>
            ))}
            {externalAttachments.map((attachment, index) => (
              <span key={`${attachment.url}-${index}`} className={cn('inline-flex max-w-full items-center gap-2 rounded-lg border px-2 py-1 text-xs', subtleButton(theme))}>
                {attachment.provider === 'google_drive' ? <Link2 className="h-3.5 w-3.5 shrink-0 text-[#0F766E]" /> : <Mail className="h-3.5 w-3.5 shrink-0 text-[#2563EB]" />}
                <span className="truncate">{attachment.title}</span>
                <button type="button" aria-label={`Remove ${attachment.title}`} title="Remove attachment" onClick={() => setExternalAttachments((current) => current.filter((_, itemIndex) => itemIndex !== index))}>
                  <X className="h-3.5 w-3.5" />
                </button>
              </span>
            ))}
          </div>
        )}
        {dragActive && <p className="mt-2 text-center text-sm font-semibold text-[var(--accent-strong)]">Drop files to attach</p>}
        {error && <p className="mt-2 text-sm font-semibold text-[#B91C1C]">{error}</p>}
        {composerEmojiOpen && (
          <div className={cn('absolute bottom-16 left-4 z-[70] overflow-hidden rounded-xl border shadow-2xl', theme === 'dark' ? 'border-white/10 bg-[#17151D]' : 'border-[#E7E3EA] bg-white')}>
            <div className={cn('flex items-center justify-between border-b px-3 py-2', theme === 'dark' ? 'border-white/10' : 'border-[#E7E3EA]')}>
              <span className="text-sm font-semibold">Emoji</span>
              <button type="button" aria-label="Close emoji picker" title="Close" onClick={() => setComposerEmojiOpen(false)} className={cn('inline-flex h-8 w-8 items-center justify-center rounded-md', theme === 'dark' ? 'hover:bg-white/10' : 'hover:bg-[var(--accent-soft)]')}><X className="h-4 w-4" /></button>
            </div>
            <Suspense fallback={<div className={cn('flex h-48 w-72 items-center justify-center text-sm', muted(theme))}>Loading emoji...</div>}>
              <EmojiPicker
                width={320}
                height={360}
                lazyLoadEmojis
                previewConfig={{ showPreview: false }}
                onEmojiClick={(emojiData) => insertEmoji(emojiData.emoji)}
              />
            </Suspense>
          </div>
        )}
        <div className="mt-3 flex items-center gap-3">
          {!editingComment && <div ref={attachmentMenuRef} className="relative">
            <button
              type="button"
              aria-label="Add attachments"
              title="Add attachment"
              aria-expanded={attachmentMenuOpen}
              onClick={() => setAttachmentMenuOpen((open) => !open)}
              className={cn('inline-flex h-10 w-10 items-center justify-center rounded-lg border', subtleButton(theme))}
            >
              <Plus className="h-4 w-4" />
            </button>
            {attachmentMenuOpen && (
              <AttachmentMenu
                theme={theme}
                cameraAvailable={cameraAvailable}
                onDocument={() => openFilePicker('.pdf,.doc,.docx,.txt,.rtf,.csv,.xls,.xlsx,.ods,.ppt,.pptx,.odp,.key,.zip,.rar,.7z,.tar,.gz')}
                onMedia={() => openFilePicker('image/*,video/*')}
                onCamera={() => openFilePicker('image/*,video/*', true)}
                onAudio={() => openFilePicker('audio/*')}
                onEmoji={() => { setAttachmentMenuOpen(false); setComposerEmojiOpen(true); }}
              />
            )}
          </div>}
          <button disabled={submitting || (!reply.trim() && files.length === 0 && externalAttachments.length === 0)} className="ml-auto inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-[var(--accent-strong)] px-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50">
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            {editingComment ? 'Save' : 'Reply'}
          </button>
        </div>
      </form>
      {forwardModalOpen && (
        <ForwardMessagesModal
          theme={theme}
          posts={recentPosts}
          messageCount={selectedMessageIds.size}
          onClose={() => setForwardModalOpen(false)}
          onForward={async (targetPostIds) => {
            await onForward([...selectedMessageIds], targetPostIds);
            setForwardModalOpen(false);
            setForwarding(false);
            setSelectedMessageIds(new Set());
          }}
        />
      )}
    </aside>
  );
}


function MentionSuggestions({ theme, profiles, activeIndex, onSelect }: { theme: 'light' | 'dark'; profiles: AppProfile[]; activeIndex: number; onSelect: (profile: AppProfile) => void }) {
  return (
    <div className={cn('mb-2 max-h-60 overflow-y-auto rounded-lg border p-1 shadow-2xl scroll-area', theme === 'dark' ? 'border-white/10 bg-[#17151D]' : 'border-[#E7E3EA] bg-white')}>
      {profiles.map((profile, index) => {
        const name = getProfileName(profile, profile.email.split('@')[0] || 'Hub member');
        const fullName = getProfileFullName(profile, name);
        return (
          <button
            key={profile.id}
            type="button"
            onMouseDown={(event) => {
              event.preventDefault();
              onSelect(profile);
            }}
            className={cn('flex w-full items-center gap-3 rounded-md px-3 py-2 text-left transition', index === activeIndex ? 'bg-[var(--accent-soft)] text-[var(--accent-strong)]' : theme === 'dark' ? 'hover:bg-white/10' : 'hover:bg-[#F7F6F9]')}
          >
            <Avatar profile={profile} />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-semibold">{name}</span>
              {fullName !== name && <span className={cn('block truncate text-xs', muted(theme))}>{fullName}</span>}
            </span>
          </button>
        );
      })}
    </div>
  );
}

function ThreadCard({ profile, body, timestamp, theme, workspaceId, attachments = [], reactions, currentUserId, mentionProfiles, preferMenuAbove = false, parentComment, onReply, onReact, onForward, onEdit, onDelete }: { profile?: AppProfile; body: string; timestamp: string; theme: 'light' | 'dark'; workspaceId: string; attachments?: AppAttachment[]; reactions: AppReaction[]; currentUserId: string; mentionProfiles: AppProfile[]; preferMenuAbove?: boolean; parentComment?: AppComment; onReply: () => void; onReact: (emoji: string) => Promise<void>; onForward: () => void; onEdit?: () => void; onDelete?: () => Promise<void> }) {
  const urls = extractUrls(body);
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuPosition, setMenuPosition] = useState({ top: 0, left: 0 });
  const [reactionPickerOpen, setReactionPickerOpen] = useState(false);
  const [actionError, setActionError] = useState('');
  const menuRef = useRef<HTMLDivElement | null>(null);
  const reactionGroups = groupReactions(reactions);

  useEffect(() => {
    if (!menuOpen) return;
    const closeMenu = (event: PointerEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) {
        setMenuOpen(false);
        setReactionPickerOpen(false);
      }
    };
    document.addEventListener('pointerdown', closeMenu);
    return () => document.removeEventListener('pointerdown', closeMenu);
  }, [menuOpen]);

  const runAction = async (action: () => Promise<void>) => {
    setActionError('');
    try { await action(); } catch (caughtError) { setActionError(getErrorMessage(caughtError)); }
  };

  return (
    <div className={cn('relative rounded-lg border p-4', surface(theme))}>
      <div className="mb-3 flex items-center gap-3">
        <Avatar profile={profile} />
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">{getProfileName(profile)}</p>
        </div>
      </div>
      {parentComment && (
        <div className={cn('mb-3 border-l-2 border-[var(--accent)] pl-3 text-xs', muted(theme))}>
          <strong>{parentComment.body ? parentComment.body.slice(0, 90) : 'Attachment'}</strong>
        </div>
      )}
      {body && <RichMessageText body={body} theme={theme} mentionProfiles={mentionProfiles} />}
      {urls.length > 0 && (
        <div className="mt-3 grid gap-2">
          {urls.map((url) => <div key={url}><LinkPreviewCard url={url} workspaceId={workspaceId} theme={theme} /></div>)}
        </div>
      )}
      {attachments.length > 0 && (
        <div className={cn('grid gap-2', body && 'mt-3')}>
          {attachments.map((attachment) => (
            <div key={attachment.id}>
              <AttachmentPreview attachment={attachment} theme={theme} />
            </div>
          ))}
        </div>
      )}
      <div className="mt-3 flex min-h-7 flex-wrap items-end gap-2">
        {reactionGroups.map((group) => (
          <button key={group.emoji} type="button" onClick={() => void runAction(() => onReact(group.emoji))} className={cn('inline-flex h-7 items-center gap-1 rounded-full border px-2 text-xs', group.userIds.includes(currentUserId) ? 'border-[var(--accent)] bg-[var(--accent-soft)] text-[#17151D]' : subtleButton(theme))}>
            <span>{group.emoji}</span><span>{group.count}</span>
          </button>
        ))}
        <div ref={menuRef} className="relative ml-auto flex items-center gap-1">
          <span className={cn('text-[11px]', muted(theme))}>{formatMessageTime(timestamp)}</span>
          <button
            type="button"
            aria-label="Message actions"
            title="Message actions"
            aria-expanded={menuOpen}
            onClick={(event) => {
              if (menuOpen) {
                setMenuOpen(false);
                return;
              }
              const rect = event.currentTarget.getBoundingClientRect();
              const menuHeight = onDelete || onEdit ? 250 : 170;
              const hasRoomAbove = rect.top - menuHeight - 8 >= 8;
              const hasRoomBelow = rect.bottom + menuHeight + 8 <= window.innerHeight;
              const top = preferMenuAbove && hasRoomAbove
                ? rect.top - menuHeight - 8
                : hasRoomBelow
                  ? rect.bottom + 8
                  : Math.max(8, rect.top - menuHeight - 8);
              setMenuPosition({
                top: Math.max(8, top),
                left: Math.min(window.innerWidth - 200, Math.max(8, rect.right - 192)),
              });
              setMenuOpen(true);
            }}
            className={cn('inline-flex h-7 w-7 items-center justify-center rounded-md', theme === 'dark' ? 'hover:bg-white/10' : 'hover:bg-[var(--accent-soft)]')}
          >
            <ChevronDown className="h-3.5 w-3.5" />
          </button>
          {menuOpen && (
            <div style={menuPosition} className={cn('fixed z-[90] w-48 rounded-lg border p-1.5 shadow-2xl', theme === 'dark' ? 'border-white/10 bg-[#17151D]' : 'border-[#E7E3EA] bg-[#FFFFFF]')}>
              <MessageMenuButton icon={ReplyIcon} label="Reply" onClick={() => { onReply(); setMenuOpen(false); }} />
              <MessageMenuButton icon={Copy} label="Copy" onClick={() => { void navigator.clipboard.writeText(body); setMenuOpen(false); }} />
              <MessageMenuButton icon={Smile} label="React" onClick={() => { setReactionPickerOpen(true); setMenuOpen(false); }} />
              <MessageMenuButton icon={Share2} label="Forward" onClick={() => { onForward(); setMenuOpen(false); }} />
              {onEdit && <MessageMenuButton icon={Pencil} label="Edit" onClick={() => { onEdit(); setMenuOpen(false); }} />}
              {onDelete && <MessageMenuButton icon={Trash2} label="Delete" danger onClick={() => { void runAction(onDelete); setMenuOpen(false); }} />}
            </div>
          )}
        </div>
      </div>
      {reactionPickerOpen && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/35 p-4" onClick={() => setReactionPickerOpen(false)}>
          <div className={cn('w-full max-w-sm overflow-hidden rounded-lg border shadow-2xl', theme === 'dark' ? 'border-white/10 bg-[#17151D]' : 'border-[#E7E3EA] bg-[#FFFFFF]')} onClick={(event) => event.stopPropagation()}>
            <div className="flex h-12 items-center justify-between border-b border-inherit px-4">
              <span className="text-sm font-bold">Choose a reaction</span>
              <button type="button" aria-label="Close emoji picker" title="Close" onClick={() => setReactionPickerOpen(false)} className={cn('inline-flex h-8 w-8 items-center justify-center rounded-md', theme === 'dark' ? 'hover:bg-white/10' : 'hover:bg-[var(--accent-soft)]')}><X className="h-4 w-4" /></button>
            </div>
            <Suspense fallback={<div className="flex h-96 items-center justify-center"><Loader2 className="h-5 w-5 animate-spin" /></div>}>
              <EmojiPicker
                width="100%"
                height={420}
                theme={theme}
                lazyLoadEmojis
                previewConfig={{ showPreview: false }}
                onEmojiClick={(emojiData) => {
                  void runAction(() => onReact(emojiData.emoji));
                  setReactionPickerOpen(false);
                }}
              />
            </Suspense>
          </div>
        </div>
      )}
      {actionError && <p className="mt-2 text-xs font-semibold text-[#B91C1C]">{actionError}</p>}
    </div>
  );
}

function ThreadWidthPresets({ theme, width, onWidthChange }: { theme: 'light' | 'dark'; width: number; onWidthChange: (width: number) => void }) {
  const [open, setOpen] = useState(false);
  const options = [
    { label: 'Wide', width: 80, detail: 'More room for discussion' },
    { label: 'Balanced', width: 50, detail: 'Equal workspace and discussion' },
    { label: 'Compact', width: 20, detail: 'More room for the workspace' },
  ];
  const active = options.reduce((closest, option) => Math.abs(option.width - width) < Math.abs(closest.width - width) ? option : closest, options[1]);
  return (
    <div className="relative hidden xl:block">
      <button
        type="button"
        aria-label="Discussion layout"
        title="Discussion layout"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
        className={cn('inline-flex h-8 items-center gap-2 rounded-md border px-2.5 text-xs font-semibold transition', subtleButton(theme))}
      >
        <LayoutGrid className="h-3.5 w-3.5" />
      </button>
      {open && (
        <div className={cn('absolute right-0 top-full z-[95] mt-2 w-56 overflow-hidden rounded-lg border p-1 shadow-2xl', theme === 'dark' ? 'border-white/10 bg-[#17151D]' : 'border-[#E7E3EA] bg-white')}>
          {options.map((option) => (
            <button
              key={option.label}
              type="button"
              onClick={() => { onWidthChange(option.width); setOpen(false); }}
              className={cn('flex w-full items-center justify-between gap-3 rounded-md px-3 py-2 text-left text-sm transition hover:bg-[var(--accent-soft)]', Math.round(width) === option.width && 'bg-[var(--accent-soft)] text-[var(--accent-strong)]')}
            >
              <span><strong className="block">{option.label}</strong><span className={cn('text-xs', muted(theme))}>{option.detail}</span></span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function ThreadResizeHandle({ theme, width, onWidthChange }: { theme: 'light' | 'dark'; width: number; onWidthChange: (width: number) => void }) {
  const dragStartRef = useRef<{ x: number; width: number; containerWidth: number } | null>(null);
  return (
    <div
      role="separator"
      aria-label="Resize discussion pane"
      aria-orientation="vertical"
      aria-valuemin={20}
      aria-valuemax={80}
      aria-valuenow={Math.round(width)}
      tabIndex={0}
      title="Drag to resize discussion pane"
      onPointerDown={(event) => {
        dragStartRef.current = { x: event.clientX, width, containerWidth: event.currentTarget.parentElement?.parentElement?.clientWidth ?? window.innerWidth };
        event.currentTarget.setPointerCapture(event.pointerId);
      }}
      onPointerMove={(event) => {
        if (!dragStartRef.current) return;
        const deltaPercent = ((dragStartRef.current.x - event.clientX) / dragStartRef.current.containerWidth) * 100;
        onWidthChange(dragStartRef.current.width + deltaPercent);
      }}
      onPointerUp={() => { dragStartRef.current = null; }}
      onLostPointerCapture={() => { dragStartRef.current = null; }}
      onKeyDown={(event) => {
        if (event.key === 'ArrowLeft') { event.preventDefault(); onWidthChange(width + 2); }
        if (event.key === 'ArrowRight') { event.preventDefault(); onWidthChange(width - 2); }
      }}
      className={cn('absolute inset-y-0 left-0 z-40 hidden w-2 -translate-x-1 cursor-col-resize touch-none outline-none transition xl:block after:absolute after:inset-y-0 after:left-1/2 after:w-px after:transition hover:after:w-0.5 focus:after:w-0.5', theme === 'dark' ? 'after:bg-white/20 hover:after:bg-[var(--accent)]' : 'after:bg-[#B8B3C2] hover:after:bg-[var(--accent-strong)]')}
    />
  );
}

function MessageSelectionCheckbox({ checked, onChange }: { checked: boolean; onChange: () => void }) {
  return (
    <label className="mt-4 inline-flex h-6 w-6 shrink-0 cursor-pointer items-center justify-center">
      <input type="checkbox" checked={checked} onChange={onChange} aria-label="Select message to forward" className="h-4 w-4 accent-[var(--accent-strong)]" />
    </label>
  );
}

function ForwardMessagesModal({ theme, posts, messageCount, onClose, onForward }: { theme: 'light' | 'dark'; posts: AppPost[]; messageCount: number; onClose: () => void; onForward: (targetPostIds: string[]) => Promise<void> }) {
  const [query, setQuery] = useState('');
  const [selectedPostIds, setSelectedPostIds] = useState<Set<string>>(new Set());
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const visiblePosts = posts.filter((post) => post.title.toLowerCase().includes(query.trim().toLowerCase())).slice(0, 30);

  return (
    <div className="fixed inset-0 z-[85] flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className={cn('flex max-h-[80vh] w-full max-w-md flex-col overflow-hidden rounded-lg border shadow-2xl', theme === 'dark' ? 'border-white/10 bg-[#17151D]' : 'border-[#E7E3EA] bg-[#FFFFFF]')} onClick={(event) => event.stopPropagation()}>
        <div className="flex h-14 shrink-0 items-center gap-3 border-b border-inherit px-4">
          <button type="button" aria-label="Close forward dialog" title="Close" onClick={onClose}><X className="h-5 w-5" /></button>
          <div><p className="font-bold">Forward messages</p><p className={cn('text-xs', muted(theme))}>{messageCount} selected</p></div>
        </div>
        <div className="shrink-0 p-4">
          <label className={cn('flex h-11 items-center gap-2 rounded-lg border px-3', subtleButton(theme))}>
            <Search className="h-4 w-4" />
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search recent discussions" className="min-w-0 flex-1 bg-transparent text-sm outline-none" />
          </label>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-3 scroll-area">
          <p className={cn('px-2 pb-2 text-xs font-semibold uppercase tracking-[0.16em]', muted(theme))}>Recent discussions</p>
          {visiblePosts.length === 0 ? (
            <p className={cn('p-6 text-center text-sm', muted(theme))}>No available discussions.</p>
          ) : visiblePosts.map((post) => (
            <label key={post.id} className={cn('flex cursor-pointer items-center gap-3 rounded-lg p-3', theme === 'dark' ? 'hover:bg-white/10' : 'hover:bg-[var(--accent-soft)]')}>
              <input
                type="checkbox"
                checked={selectedPostIds.has(post.id)}
                onChange={() => setSelectedPostIds((current) => {
                  const next = new Set(current);
                  if (next.has(post.id)) next.delete(post.id); else next.add(post.id);
                  return next;
                })}
                className="h-4 w-4 accent-[var(--accent-strong)]"
              />
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[var(--accent-soft)] text-[var(--accent-strong)]"><MessageSquare className="h-4 w-4" /></span>
              <span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold">{post.title}</span><span className={cn('block text-xs', muted(theme))}>Active {formatTimeAgo(post.last_activity_at)}</span></span>
            </label>
          ))}
        </div>
        <div className="shrink-0 border-t border-inherit p-4">
          <button
            type="button"
            disabled={submitting || selectedPostIds.size === 0}
            onClick={async () => {
              setSubmitting(true);
              setError('');
              try { await onForward([...selectedPostIds]); } catch (caughtError) { setError(getErrorMessage(caughtError)); setSubmitting(false); }
            }}
            className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-[var(--accent-strong)] px-4 text-sm font-semibold text-white disabled:opacity-50"
          >
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Share2 className="h-4 w-4" />}
            Forward to {selectedPostIds.size || ''} discussion{selectedPostIds.size === 1 ? '' : 's'}
          </button>
          {error && <p className="mt-2 text-sm font-semibold text-[#B91C1C]">{error}</p>}
        </div>
      </div>
    </div>
  );
}

function GoogleDriveAttachmentModal({ theme, onClose, onAdd }: { theme: 'light' | 'dark'; onClose: () => void; onAdd: (attachment: ExternalAttachmentDraft) => void }) {
  const [url, setUrl] = useState('');
  const [title, setTitle] = useState('');
  const [error, setError] = useState('');
  const [picking, setPicking] = useState(false);
  const pickerConfigured = Boolean(GOOGLE_DRIVE_API_KEY && GOOGLE_DRIVE_CLIENT_ID);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const normalizedUrl = normalizeGoogleDriveUrl(url);
    if (!normalizedUrl) {
      setError('Paste a valid Google Drive, Docs, Sheets, or Slides share link.');
      return;
    }
    onAdd({ provider: 'google_drive', url: normalizedUrl, title: title.trim() || getGoogleDriveAttachmentTitle(normalizedUrl) });
  };

  const chooseFromDrive = async () => {
    if (!pickerConfigured) return;
    setPicking(true);
    setError('');
    try {
      const selected = await openGoogleDrivePicker();
      selected.forEach(onAdd);
      if (selected.length) onClose();
    } catch (caughtError) {
      setError(getErrorMessage(caughtError));
    } finally {
      setPicking(false);
    }
  };

  return (
    <ModalShell theme={theme} title="Attach Google Drive file" onClose={onClose}>
      <div className="grid gap-4">
        <p className={cn('text-sm leading-6', muted(theme))}>
          Choose a file from Google Drive or paste a shared Drive link. TriCord stores the link in this discussion while Google Drive keeps the file permissions and access control.
        </p>
        <button
          type="button"
          disabled={!pickerConfigured || picking}
          onClick={() => void chooseFromDrive()}
          className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-[var(--accent-strong)] px-4 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
        >
          {picking ? <Loader2 className="h-4 w-4 animate-spin" /> : <Link2 className="h-4 w-4" />}
          {picking ? 'Opening Google Drive...' : 'Choose from Google Drive'}
        </button>
        {!pickerConfigured && <p className={cn('rounded-lg border px-3 py-2 text-sm leading-6', subtleButton(theme))}>Google Drive browsing is not connected yet. You can still paste a shared Drive link below.</p>}
        <div className={cn('flex items-center gap-3 text-xs font-semibold uppercase tracking-[0.16em]', muted(theme))}><span className="h-px flex-1 bg-current/20" />Or paste a link<span className="h-px flex-1 bg-current/20" /></div>
        <form className="grid gap-4" onSubmit={submit}>
          <label className="grid gap-2 text-sm font-semibold">
            Share link
            <input
              value={url}
              onChange={(event) => { setUrl(event.target.value); setError(''); }}
              placeholder="https://drive.google.com/file/d/..."
              className={cn('h-11 rounded-lg border bg-transparent px-3 text-sm outline-none', subtleButton(theme))}
            />
          </label>
          <label className="grid gap-2 text-sm font-semibold">
            Display name
            <input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Optional, for example Compensation worksheet"
              className={cn('h-11 rounded-lg border bg-transparent px-3 text-sm outline-none', subtleButton(theme))}
            />
          </label>
          {error && <p className="rounded-lg border border-[#FCA5A5] bg-[#FEF2F2] px-3 py-2 text-sm font-semibold text-[#B91C1C]">{error}</p>}
          <div className="flex justify-end gap-2">
            <button type="button" onClick={onClose} className={cn('h-10 rounded-lg border px-4 text-sm font-semibold', subtleButton(theme))}>Cancel</button>
            <button className="h-10 rounded-lg bg-[var(--accent-strong)] px-4 text-sm font-semibold text-white">Attach link</button>
          </div>
        </form>
      </div>
    </ModalShell>
  );
}

function AttachmentMenu({ theme, cameraAvailable, onDocument, onMedia, onCamera, onAudio, onEmoji }: { theme: 'light' | 'dark'; cameraAvailable: boolean; onDocument: () => void; onMedia: () => void; onCamera: () => void; onAudio: () => void; onEmoji: () => void }) {
  const items: { label: string; icon: LucideIcon; action: () => void; color: string; disabled?: boolean }[] = [
    { label: 'Document', icon: FileText, action: onDocument, color: 'text-[#7C3AED]' },
    { label: 'Photos & videos', icon: ImageIcon, action: onMedia, color: 'text-[#2563EB]' },
    { label: 'Camera', icon: Camera, action: onCamera, color: 'text-[#DB2777]', disabled: !cameraAvailable },
    { label: 'Audio', icon: Headphones, action: onAudio, color: 'text-[#EA580C]' },
    { label: 'Emoji', icon: Smile, action: onEmoji, color: 'text-[var(--accent-strong)]' },
  ];
  return (
    <div className={cn('absolute bottom-12 left-0 z-40 w-56 rounded-lg border p-2 shadow-2xl', theme === 'dark' ? 'border-white/10 bg-[#17151D]' : 'border-[#E7E3EA] bg-[#FFFFFF]')}>
      {items.map(({ label, icon: Icon, action, color, disabled }) => (
        <button key={label} type="button" disabled={disabled} title={disabled ? 'No camera detected' : undefined} onClick={action} className={cn('flex h-10 w-full items-center gap-3 rounded-md px-3 text-left text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-40', theme === 'dark' ? 'hover:bg-white/10' : 'hover:bg-[var(--accent-soft)]')}>
          <Icon className={cn('h-4 w-4', color)} />
          {label}
        </button>
      ))}
    </div>
  );
}

function MessageMenuButton({ icon: Icon, label, onClick, danger = false }: { icon: LucideIcon; label: string; onClick: () => void; danger?: boolean }) {
  return (
    <button type="button" onClick={onClick} className={cn('flex h-10 w-full items-center gap-3 rounded-md px-3 text-left text-sm font-semibold transition hover:bg-black/5', danger && 'text-[#B91C1C]')}>
      <Icon className="h-4 w-4" />
      {label}
    </button>
  );
}

function RichMessageText({ body, theme, mentionProfiles }: { body: string; theme: 'light' | 'dark'; mentionProfiles: AppProfile[] }) {
  const tokens = buildMessageTextTokens(body, mentionProfiles);
  return (
    <p className={cn('whitespace-pre-wrap break-words text-sm leading-6', muted(theme))}>
      {tokens.map((token, index) => {
        if (token.kind === 'url') return <a key={`${token.href}-${index}`} href={token.href} target="_blank" rel="noreferrer" className="font-semibold text-[#0F766E] underline decoration-[#0F766E]/40 underline-offset-2">{token.text}</a>;
        if (token.kind === 'mention') return <span key={`${token.text}-${index}`} className="rounded px-1 py-0.5 font-bold text-[var(--accent-strong)] bg-[var(--accent-soft)]">{token.text}</span>;
        return <Fragment key={`${token.text}-${index}`}>{token.text}</Fragment>;
      })}
    </p>
  );
}

function LinkPreviewCard({ url, workspaceId, theme }: { url: string; workspaceId: string; theme: 'light' | 'dark' }) {
  const [preview, setPreview] = useState<AppLinkPreview | null>(() => linkPreviewCache.get(url) ?? null);

  useEffect(() => {
    if (!supabase || preview) return;
    let active = true;
    void supabase.functions.invoke<AppLinkPreview>('link-preview', { body: { url, workspaceId } }).then(({ data, error }) => {
      if (!active || error || !data?.title) return;
      linkPreviewCache.set(url, data);
      setPreview(data);
    });
    return () => { active = false; };
  }, [preview, url, workspaceId]);

  if (!preview) return null;
  return (
    <a href={preview.url} target="_blank" rel="noreferrer" className={cn('grid overflow-hidden rounded-lg border transition hover:border-[var(--accent)]', preview.image && 'grid-cols-[96px_minmax(0,1fr)]', subtleButton(theme))}>
      {preview.image && <img src={preview.image} alt="" className="h-full min-h-24 w-24 object-cover" />}
      <span className="min-w-0 p-3">
        <span className={cn('flex items-center gap-1.5 text-xs font-semibold', muted(theme))}><Globe2 className="h-3.5 w-3.5" />{preview.site_name}</span>
        <span className="mt-1 block line-clamp-2 text-sm font-bold">{preview.title}</span>
        {preview.description && <span className={cn('mt-1 block line-clamp-2 text-xs leading-5', muted(theme))}>{preview.description}</span>}
      </span>
    </a>
  );
}

function AttachmentPreview({ attachment, theme }: { attachment: AppAttachment; theme: 'light' | 'dark' }) {
  const externalUrl = getExternalAttachmentUrl(attachment);
  if (externalUrl) {
    const provider = getAttachmentProviderLabel(attachment);
    return (
      <a href={externalUrl} target="_blank" rel="noreferrer" className={cn('flex items-center gap-3 rounded-lg border p-3 text-sm transition hover:border-[var(--accent)]', subtleButton(theme))}>
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[var(--accent-soft)] text-[var(--accent-strong)]">
          {typeof attachment.metadata?.icon_url === 'string' ? <img src={attachment.metadata.icon_url} alt="" className="h-5 w-5" /> : <Link2 className="h-5 w-5" />}
        </span>
        <span className="min-w-0 flex-1"><span className="block truncate font-semibold">{attachment.filename}</span><span className={cn('block text-xs', muted(theme))}>{provider} link</span></span>
        <Download className="h-4 w-4 shrink-0" />
      </a>
    );
  }
  if (!attachment.signed_url) return null;
  if (attachment.mime_type.startsWith('image/')) {
    return <a href={attachment.signed_url} target="_blank" rel="noreferrer"><img src={attachment.signed_url} alt={attachment.filename} className="max-h-64 w-full rounded-lg border object-contain" /></a>;
  }
  if (attachment.mime_type.startsWith('video/')) {
    return <video src={attachment.signed_url} controls preload="metadata" className="max-h-64 w-full rounded-lg border" />;
  }
  if (attachment.mime_type.startsWith('audio/')) {
    return <audio src={attachment.signed_url} controls preload="metadata" className="w-full" />;
  }
  return (
    <a href={attachment.signed_url} target="_blank" rel="noreferrer" className={cn('flex items-center gap-3 rounded-lg border p-3 text-sm', subtleButton(theme))}>
      <FileIcon className="h-5 w-5 shrink-0" />
      <span className="min-w-0 flex-1 truncate font-semibold">{attachment.filename}</span>
      <span className={cn('shrink-0 text-xs', muted(theme))}>{formatFileSize(attachment.byte_size)}</span>
      <Download className="h-4 w-4 shrink-0" />
    </a>
  );
}

function TasksView({
  tasks,
  profiles,
  theme,
  canManageTaskActions,
  onCreateTask,
  onEditTask,
  onDeleteTask,
  onStatusChange,
  onArchiveTask,
}: {
  tasks: AppTask[];
  profiles: Record<string, AppProfile>;
  theme: 'light' | 'dark';
  canManageTaskActions: boolean;
  onCreateTask: () => void;
  onEditTask: (task: AppTask) => void;
  onDeleteTask: (task: AppTask) => Promise<void>;
  onStatusChange: (taskId: string, status: TaskStatus) => Promise<void>;
  onArchiveTask: (task: AppTask) => Promise<void>;
}) {
  const [mode, setMode] = useState<'board' | 'list' | 'calendar'>('board');
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<TaskStatus | 'all'>('all');
  const [priorityFilter, setPriorityFilter] = useState<TaskPriority | 'all'>('all');
  const filteredTasks = tasks.filter((task) => {
    if (statusFilter !== 'all' && task.status !== statusFilter) return false;
    if (priorityFilter !== 'all' && (task.priority ?? 'medium') !== priorityFilter) return false;
    const normalizedQuery = query.trim().toLowerCase();
    return !normalizedQuery || `${task.title} ${task.description ?? ''} ${task.project_name ?? ''} ${(task.tags ?? []).join(' ')}`.toLowerCase().includes(normalizedQuery);
  });
  const tabs: { value: typeof mode; label: string; icon: LucideIcon }[] = [
    { value: 'board', label: 'Board', icon: LayoutGrid },
    { value: 'list', label: 'List', icon: List },
    { value: 'calendar', label: 'Calendar', icon: CalendarDays },
  ];
  return (
    <StaticPanel theme={theme} title="Tasks" icon={ClipboardList}>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div className={cn('inline-flex rounded-lg border p-1', surface(theme))}>
          {tabs.map(({ value, label, icon: Icon }) => <button key={value} onClick={() => setMode(value)} className={cn('inline-flex h-9 items-center gap-2 rounded-md px-3 text-sm font-semibold transition', mode === value ? 'bg-[var(--accent)] text-[var(--accent-ink)] shadow-sm' : muted(theme))}><Icon className="h-4 w-4" />{label}</button>)}
        </div>
        <button onClick={onCreateTask} className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-[var(--accent-strong)] px-4 text-sm font-semibold text-white"><Plus className="h-4 w-4" />New task</button>
      </div>
      {tasks.length === 0 ? <EmptyState theme={theme} icon={ClipboardList} title="No tasks yet" body="Create the first task to start planning hub projects." actionLabel="Create task" onAction={onCreateTask} /> : mode === 'board' ? (
        <TaskBoard tasks={filteredTasks} profiles={profiles} theme={theme} onCreateTask={onCreateTask} onStatusChange={onStatusChange} />
      ) : mode === 'list' ? (
        <TaskList tasks={filteredTasks} profiles={profiles} theme={theme} query={query} setQuery={setQuery} statusFilter={statusFilter} setStatusFilter={setStatusFilter} priorityFilter={priorityFilter} setPriorityFilter={setPriorityFilter} canManageTaskActions={canManageTaskActions} onStatusChange={onStatusChange} onEditTask={onEditTask} onDeleteTask={onDeleteTask} onArchiveTask={onArchiveTask} />
      ) : (
        <TaskCalendar tasks={filteredTasks} profiles={profiles} theme={theme} />
      )}
    </StaticPanel>
  );
}

const taskColumns: { status: TaskStatus; label: string; dot: string }[] = [
  { status: 'todo', label: 'To do', dot: 'bg-[#94A3B8]' },
  { status: 'in_progress', label: 'In progress', dot: 'bg-[#3B82F6]' },
  { status: 'blocked', label: 'Blocked', dot: 'bg-[#F59E0B]' },
  { status: 'done', label: 'Done', dot: 'bg-[#10B981]' },
  { status: 'canceled', label: 'Canceled', dot: 'bg-[#EF4444]' },
];

function TaskBoard({ tasks, profiles, theme, onCreateTask, onStatusChange }: { tasks: AppTask[]; profiles: Record<string, AppProfile>; theme: 'light' | 'dark'; onCreateTask: () => void; onStatusChange: (taskId: string, status: TaskStatus) => Promise<void> }) {
  return (
    <div className="min-h-0 overflow-x-auto pb-3 scroll-area">
      <div className="grid min-w-max grid-flow-col auto-cols-[280px] gap-4">
        {taskColumns.map((column) => {
          const columnTasks = tasks.filter((task) => task.status === column.status);
          return <section key={column.status} onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); const taskId = event.dataTransfer.getData('text/tricord-task'); if (taskId) void onStatusChange(taskId, column.status); }}>
            <div className="mb-3 flex items-center gap-2 px-1"><span className={cn('h-2.5 w-2.5 rounded-full', column.dot)} /><h3 className="text-sm font-bold">{column.label}</h3><span className={cn('ml-auto rounded-full px-2 py-0.5 text-xs', theme === 'dark' ? 'bg-white/10' : 'bg-[#EDF2F7]', muted(theme))}>{columnTasks.length}</span></div>
            <div className="space-y-3">
              {columnTasks.map((task) => <div key={task.id} draggable onDragStart={(event) => { event.dataTransfer.effectAllowed = 'move'; event.dataTransfer.setData('text/tricord-task', task.id); }} className={cn('cursor-grab rounded-lg border p-4 shadow-sm active:cursor-grabbing', surface(theme))}>
                <p className="font-semibold">{task.title}</p>{task.description && <p className={cn('mt-1 line-clamp-2 text-xs leading-5', muted(theme))}>{task.description}</p>}
                <div className="mt-3 flex flex-wrap gap-1.5"><PriorityPill priority={task.priority ?? 'medium'} />{(task.tags ?? []).slice(0, 2).map((tag) => <span key={tag} className={cn('rounded-full px-2 py-1 text-[11px]', theme === 'dark' ? 'bg-white/10' : 'bg-[#EDF2F7]')}>{tag}</span>)}</div>
                <div className="mt-4 flex items-center gap-2"><Avatar profile={task.assignee_id ? profiles[task.assignee_id] : undefined} /><span className={cn('min-w-0 flex-1 truncate text-xs', muted(theme))}>{task.project_name || 'General project'}</span>{task.due_at && <span className={cn('text-[11px]', muted(theme))}>{formatTaskDate(task.due_at)}</span>}</div>
              </div>)}
              <button onClick={onCreateTask} className={cn('inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg border border-dashed text-sm', muted(theme))}><Plus className="h-4 w-4" />Add task</button>
            </div>
          </section>;
        })}
      </div>
    </div>
  );
}

function TaskList({ tasks, profiles, theme, query, setQuery, statusFilter, setStatusFilter, priorityFilter, setPriorityFilter, canManageTaskActions, onStatusChange, onEditTask, onDeleteTask, onArchiveTask }: { tasks: AppTask[]; profiles: Record<string, AppProfile>; theme: 'light' | 'dark'; query: string; setQuery: (value: string) => void; statusFilter: TaskStatus | 'all'; setStatusFilter: (value: TaskStatus | 'all') => void; priorityFilter: TaskPriority | 'all'; setPriorityFilter: (value: TaskPriority | 'all') => void; canManageTaskActions: boolean; onStatusChange: (taskId: string, status: TaskStatus) => Promise<void>; onEditTask: (task: AppTask) => void; onDeleteTask: (task: AppTask) => Promise<void>; onArchiveTask: (task: AppTask) => Promise<void> }) {
  return <div><div className="mb-4 flex flex-wrap items-center gap-2"><Filter className={cn('h-4 w-4', muted(theme))} /><select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as TaskStatus | 'all')} className={cn('h-10 rounded-lg border bg-transparent px-3 text-sm outline-none', subtleButton(theme))}><option value="all">All statuses</option>{taskColumns.map((column) => <option key={column.status} value={column.status}>{column.label}</option>)}</select><select value={priorityFilter} onChange={(event) => setPriorityFilter(event.target.value as TaskPriority | 'all')} className={cn('h-10 rounded-lg border bg-transparent px-3 text-sm outline-none', subtleButton(theme))}><option value="all">All priorities</option><option value="urgent">Urgent</option><option value="high">High</option><option value="medium">Medium</option><option value="low">Low</option></select><label className={cn('ml-auto flex h-10 min-w-56 items-center gap-2 rounded-lg border px-3', surface(theme))}><Search className="h-4 w-4" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search tasks" className="min-w-0 flex-1 bg-transparent text-sm outline-none" /></label></div>
    <div className={cn('overflow-x-auto rounded-lg border', surface(theme))}><table className="w-full min-w-[900px] border-collapse text-left"><thead><tr className="border-b border-inherit">{['Task', 'Project', 'Assignee', 'Status', 'Priority', 'Due date', 'Actions'].map((heading) => <th key={heading} className={cn('px-4 py-3 text-xs uppercase tracking-[0.12em]', muted(theme))}>{heading}</th>)}</tr></thead><tbody>{tasks.map((task) => <tr key={task.id} className="border-b border-inherit last:border-0"><td className="px-4 py-3"><p className="text-sm font-semibold">{task.title}</p><p className={cn('max-w-64 truncate text-xs', muted(theme))}>{task.description}</p></td><td className={cn('px-4 py-3 text-sm', muted(theme))}>{task.project_name || 'General'}</td><td className="px-4 py-3"><div className="flex items-center gap-2"><Avatar profile={task.assignee_id ? profiles[task.assignee_id] : undefined} /><span className="text-sm">{task.assignee_id ? profiles[task.assignee_id]?.display_name ?? 'Assigned' : 'Unassigned'}</span></div></td><td className="px-4 py-3"><select aria-label={`Status for ${task.title}`} value={task.status} onChange={(event) => void onStatusChange(task.id, event.target.value as TaskStatus)} className={cn('h-9 rounded-lg border bg-transparent px-2 text-xs font-semibold outline-none', subtleButton(theme))}>{taskColumns.map((column) => <option key={column.status} value={column.status}>{column.label}</option>)}</select></td><td className="px-4 py-3"><PriorityPill priority={task.priority ?? 'medium'} /></td><td className={cn('px-4 py-3 text-sm', muted(theme))}>{task.due_at ? formatTaskDate(task.due_at) : 'No date'}</td><td className="px-4 py-3"><div className="flex gap-2">{canManageTaskActions && <button aria-label="Edit task" title="Edit task" onClick={() => onEditTask(task)} className={cn('inline-flex h-8 w-8 items-center justify-center rounded-md border', subtleButton(theme))}><Pencil className="h-3.5 w-3.5" /></button>}{canManageTaskActions && <button aria-label="Delete task" title="Delete task" onClick={() => void onDeleteTask(task)} className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-[#FCA5A5] text-[#B91C1C]"><Trash2 className="h-3.5 w-3.5" /></button>}{(task.status === 'done' || task.status === 'canceled') && <button aria-label="Archive task" title="Archive task" onClick={() => void onArchiveTask(task)} className={cn('inline-flex h-8 w-8 items-center justify-center rounded-md border', subtleButton(theme))}><Archive className="h-3.5 w-3.5" /></button>}</div></td></tr>)}</tbody></table>{tasks.length === 0 && <p className={cn('p-8 text-center text-sm', muted(theme))}>No tasks match these filters.</p>}</div>
  </div>;
}

function TaskCalendar({ tasks, profiles, theme }: { tasks: AppTask[]; profiles: Record<string, AppProfile>; theme: 'light' | 'dark' }) {
  const [month, setMonth] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  const [selectedDate, setSelectedDate] = useState(() => toDateKey(new Date()));
  const days = buildCalendarDays(month);
  const selectedTasks = tasks.filter((task) => task.due_at && toTaskDateKey(task.due_at) === selectedDate);
  return <div><div className="mb-4 flex items-center justify-between"><button aria-label="Previous month" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))} className={cn('inline-flex h-9 w-9 items-center justify-center rounded-lg border', subtleButton(theme))}><ChevronLeft className="h-4 w-4" /></button><h3 className="font-bold">{month.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}</h3><button aria-label="Next month" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))} className={cn('inline-flex h-9 w-9 items-center justify-center rounded-lg border', subtleButton(theme))}><ChevronRight className="h-4 w-4" /></button></div><div className="grid gap-4 xl:grid-cols-[minmax(0,1.5fr)_minmax(260px,0.7fr)]"><div className={cn('overflow-hidden rounded-lg border', surface(theme))}><div className="grid grid-cols-7 border-b border-inherit">{['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map((day) => <div key={day} className={cn('p-2 text-center text-xs font-semibold', muted(theme))}>{day}</div>)}</div><div className="grid grid-cols-7">{days.map((day) => { const key = toDateKey(day); const dayTasks = tasks.filter((task) => task.due_at && toTaskDateKey(task.due_at) === key); const inMonth = day.getMonth() === month.getMonth(); return <button key={key} onClick={() => setSelectedDate(key)} className={cn('relative min-h-24 border-b border-r border-inherit p-2 text-left align-top transition', !inMonth && 'opacity-40', selectedDate === key && 'ring-2 ring-inset ring-[var(--accent)]')}><span className="text-xs font-semibold">{day.getDate()}</span><div className="mt-2 space-y-1">{dayTasks.slice(0, 2).map((task) => <span key={task.id} className="block truncate rounded bg-[var(--accent-soft)] px-1.5 py-1 text-[10px] text-[var(--accent-strong)]">{task.title}</span>)}{dayTasks.length > 2 && <span className={cn('text-[10px]', muted(theme))}>+{dayTasks.length - 2} more</span>}</div></button>; })}</div></div><aside className={cn('rounded-lg border p-4', surface(theme))}><h3 className="font-bold">{new Date(`${selectedDate}T12:00:00`).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}</h3><p className={cn('mt-1 text-xs', muted(theme))}>{selectedTasks.length} task{selectedTasks.length === 1 ? '' : 's'}</p><div className="mt-4 space-y-3">{selectedTasks.map((task) => <div key={task.id} className="border-l-2 border-[var(--accent)] pl-3"><p className="text-sm font-semibold">{task.title}</p><p className={cn('text-xs', muted(theme))}>{task.project_name || 'General'} · {task.assignee_id ? profiles[task.assignee_id]?.display_name ?? 'Assigned' : 'Unassigned'}</p></div>)}{selectedTasks.length === 0 && <p className={cn('py-10 text-center text-sm', muted(theme))}>No tasks for this date.</p>}</div></aside></div></div>;
}

function PriorityPill({ priority }: { priority: TaskPriority }) {
  const styles: Record<TaskPriority, string> = { low: 'bg-[#EDF2F7] text-[#475569]', medium: 'bg-[#DBEAFE] text-[#1D4ED8]', high: 'bg-[#FEF3C7] text-[#B45309]', urgent: 'bg-[#FEE2E2] text-[#B91C1C]' };
  return <span className={cn('rounded-full px-2 py-1 text-[11px] font-semibold capitalize', styles[priority])}>{priority}</span>;
}

function KnowledgeView({
  articles,
  profiles,
  theme,
  canManage,
  onCreate,
  onEdit,
  onDelete,
}: {
  articles: KnowledgeArticle[];
  profiles: Record<string, AppProfile>;
  theme: 'light' | 'dark';
  canManage: boolean;
  onCreate: () => void;
  onEdit: (article: KnowledgeArticle) => void;
  onDelete: (article: KnowledgeArticle) => Promise<void>;
}) {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<KnowledgeCategory | 'all'>('all');
  const [selectedArticleId, setSelectedArticleId] = useState(articles[0]?.id ?? '');
  const normalizedQuery = query.trim().toLowerCase();
  const visibleArticles = articles.filter((article) => {
    if (category !== 'all' && article.category !== category) return false;
    if (!normalizedQuery) return true;
    return `${article.title} ${article.summary ?? ''} ${article.content}`.toLowerCase().includes(normalizedQuery);
  });
  const userGuide = { id: 'tricord-user-guide', title: 'TriCord User Guide', summary: 'Complete PDF guide for TriCord trial and subscribed Hubs.', category: 'documentation' as KnowledgeCategory };
  const selectedArticle = visibleArticles.find((article) => article.id === selectedArticleId) ?? visibleArticles[0];

  return (
    <StaticPanel theme={theme} title="Knowledge base" icon={FileText}>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <label className={cn('flex h-11 min-w-60 flex-1 items-center gap-2 rounded-lg border px-3', surface(theme))}>
          <Search className="h-4 w-4" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search guides, FAQs, and procedures" className="min-w-0 flex-1 bg-transparent text-sm outline-none" />
        </label>
        <select value={category} onChange={(event) => setCategory(event.target.value as KnowledgeCategory | 'all')} className={cn('h-11 rounded-lg border bg-transparent px-3 text-sm font-semibold outline-none', subtleButton(theme))}>
          <option value="all">All categories</option>
          {knowledgeCategories.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
        </select>
        <button onClick={onCreate} className="inline-flex h-11 items-center gap-2 rounded-lg bg-[var(--accent-strong)] px-4 text-sm font-semibold text-white"><Plus className="h-4 w-4" />New article</button>
      </div>
      {visibleArticles.length === 0 ? (
        <div className={cn('rounded-lg border p-6', surface(theme))}><h3 className="font-bold">Start with the TriCord User Guide</h3><p className={cn('mt-2 text-sm leading-6', muted(theme))}>The complete PDF guide is available to every user. Create additional articles for your own guides, FAQs, best practices, troubleshooting steps, and procedures.</p><div className="mt-4 flex flex-wrap gap-2"><a href={USER_GUIDE_URL} target="_blank" rel="noreferrer" className="inline-flex h-10 items-center justify-center rounded-lg bg-[var(--accent)] px-4 text-sm font-bold text-[var(--accent-ink)]">Open PDF</a><button onClick={onCreate} className={cn('inline-flex h-10 items-center justify-center rounded-lg border px-4 text-sm font-semibold', subtleButton(theme))}>Create article</button></div></div>
      ) : (
        <div className="grid min-h-0 gap-4 xl:grid-cols-[minmax(240px,0.8fr)_minmax(0,1.5fr)]">
          <div className="max-h-[62vh] space-y-2 overflow-y-auto pr-1 scroll-area">
            <a href={USER_GUIDE_URL} target="_blank" rel="noreferrer" className={cn('block w-full rounded-lg border p-4 text-left transition', surface(theme))}>
              <span className={cn('text-xs font-semibold uppercase tracking-[0.12em]', muted(theme))}>{getKnowledgeCategoryLabel(userGuide.category)}</span>
              <span className="mt-2 block font-bold">{userGuide.title}</span>
              <span className={cn('mt-1 block line-clamp-2 text-sm', muted(theme))}>{userGuide.summary}</span>
            </a>
            {visibleArticles.map((article) => (
              <button key={article.id} onClick={() => setSelectedArticleId(article.id)} className={cn('w-full rounded-lg border p-4 text-left transition', selectedArticle?.id === article.id ? 'border-[var(--accent)] bg-[var(--accent-soft)]/60' : surface(theme))}>
                <span className={cn('text-xs font-semibold uppercase tracking-[0.12em]', muted(theme))}>{getKnowledgeCategoryLabel(article.category)}</span>
                <span className="mt-2 block font-bold">{article.title}</span>
                {article.summary && <span className={cn('mt-1 block line-clamp-2 text-sm', muted(theme))}>{article.summary}</span>}
              </button>
            ))}
          </div>
          {selectedArticle && (
            <article className={cn('max-h-[62vh] overflow-y-auto rounded-lg border p-6 scroll-area', surface(theme))}>
              <div className="flex flex-wrap items-start gap-3">
                <div className="min-w-0 flex-1"><p className={cn('text-xs font-semibold uppercase tracking-[0.14em]', muted(theme))}>{getKnowledgeCategoryLabel(selectedArticle.category)}</p><h2 className="mt-2 text-2xl font-bold">{selectedArticle.title}</h2></div>
                {canManage && <div className="flex gap-2"><button aria-label="Edit article" title="Edit article" onClick={() => onEdit(selectedArticle)} className={cn('inline-flex h-9 w-9 items-center justify-center rounded-lg border', subtleButton(theme))}><Pencil className="h-4 w-4" /></button><button aria-label="Delete article" title="Delete article" onClick={() => void onDelete(selectedArticle)} className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-[#FCA5A5] bg-[#FEF2F2] text-[#B91C1C]"><Trash2 className="h-4 w-4" /></button></div>}
              </div>
              {selectedArticle.summary && <p className={cn('mt-4 border-l-2 border-[var(--accent)] pl-4 text-sm leading-6', muted(theme))}>{selectedArticle.summary}</p>}
              <div className={cn('mt-6 whitespace-pre-wrap text-sm leading-7', muted(theme))}>{selectedArticle.content}</div>
              <div className="mt-8 flex items-center gap-3 border-t border-inherit pt-4"><Avatar profile={profiles[selectedArticle.created_by]} /><div><p className="text-sm font-semibold">{profiles[selectedArticle.created_by]?.display_name ?? 'Hub member'}</p><p className={cn('text-xs', muted(theme))}>Updated {formatTimeAgo(selectedArticle.updated_at)}</p></div></div>
            </article>
          )}
        </div>
      )}
    </StaticPanel>
  );
}

function AdminView({
  workspace,
  currentRole,
  currentCapabilities,
  theme,
  memberships,
  profiles,
  spaces,
  businessModules,
  onInvite,
  onRoleChange,
}: {
  workspace?: AppWorkspace;
  currentRole: WorkspaceRole;
  currentCapabilities: WorkspaceCapabilities | null;
  theme: 'light' | 'dark';
  memberships: AppMembership[];
  profiles: Record<string, AppProfile>;
  spaces: AppSpace[];
  businessModules: BusinessModules;
  onInvite: (email: string, role: WorkspaceRole) => Promise<string>;
  onRoleChange: (membershipId: string, role: WorkspaceRole) => Promise<void>;
}) {
  const [permissionsHelpOpen, setPermissionsHelpOpen] = useState(false);
  const [roleError, setRoleError] = useState('');
  const [capabilityRows, setCapabilityRows] = useState<Record<string, WorkspaceCapabilities>>({});
  const [guestRoomAccess, setGuestRoomAccess] = useState<Record<string, string[]>>({});
  const canManagePeople = currentRole === 'owner' || Boolean(currentCapabilities?.manage_members);
  const canManageRoomAccess = currentRole === 'owner' || Boolean(currentCapabilities?.manage_members || currentCapabilities?.manage_rooms);
  const capabilityOptions: { key: keyof Omit<WorkspaceCapabilities, 'workspace_id' | 'user_id'>; label: string }[] = [
    { key: 'manage_members', label: 'People and Roles' },
    { key: 'manage_rooms', label: 'Rooms' },
    { key: 'manage_knowledge', label: 'Knowledge' },
    ...(businessModules.employee_records ? [{ key: 'manage_hr' as const, label: 'Employee Records' }, { key: 'approve_leave' as const, label: 'Leave Approvals' }] : []),
    ...(businessModules.attendance_tracking ? [{ key: 'manage_timekeeping' as const, label: 'Attendance Settings' }, { key: 'correct_attendance' as const, label: 'Attendance Corrections' }] : []),
    ...(businessModules.payroll_preparation ? [{ key: 'manage_payroll' as const, label: 'Payroll Preparation' }, { key: 'approve_payroll' as const, label: 'Approve Preparation Drafts' }] : []),
    ...((businessModules.attendance_tracking || businessModules.employee_records || businessModules.payroll_preparation) ? [{ key: 'view_reports' as const, label: 'Attendance Reports' }] : []),
    { key: 'view_audit', label: 'Audit history' },
  ];
  const groups: { title: string; roles: WorkspaceRole[] }[] = [
    { title: 'Admins', roles: ['owner', 'admin'] },
    { title: 'Members', roles: ['member'] },
    { title: 'Guests', roles: ['guest'] },
  ];

  useEffect(() => {
    if (!supabase || !workspace?.id) return;
    const guestIds = memberships.filter((membership) => membership.role === 'guest').map((membership) => membership.user_id);
    void Promise.all([
      supabase.from('workspace_capabilities').select('*').eq('workspace_id', workspace.id),
      guestIds.length ? supabase.from('space_memberships').select('space_id, user_id').in('user_id', guestIds) : Promise.resolve({ data: [], error: null }),
    ]).then(([capabilityResult, roomResult]) => {
      const error = capabilityResult.error ?? roomResult.error;
      if (error) { setRoleError(error.message); return; }
      setCapabilityRows(Object.fromEntries(((capabilityResult.data ?? []) as WorkspaceCapabilities[]).map((row) => [row.user_id, row])));
      const nextAccess: Record<string, string[]> = {};
      for (const row of (roomResult.data ?? []) as { space_id: string; user_id: string }[]) {
        nextAccess[row.user_id] = [...(nextAccess[row.user_id] ?? []), row.space_id];
      }
      setGuestRoomAccess(nextAccess);
    });
  }, [memberships, workspace?.id]);

  const setCapability = async (targetUserId: string, key: keyof Omit<WorkspaceCapabilities, 'workspace_id' | 'user_id'>, enabled: boolean) => {
    if (!supabase || !workspace?.id || currentRole !== 'owner') return;
    setRoleError('');
    const { error } = await supabase.from('workspace_capabilities').upsert({
      workspace_id: workspace.id, user_id: targetUserId, [key]: enabled,
      granted_by: workspace.owner_id, updated_at: new Date().toISOString(),
    }, { onConflict: 'workspace_id,user_id' });
    if (error) setRoleError(error.message);
    else setCapabilityRows((current) => ({
      ...current,
      [targetUserId]: {
        workspace_id: workspace.id,
        user_id: targetUserId,
        manage_members: false,
        manage_rooms: false,
        manage_knowledge: false,
        manage_hr: false,
        approve_leave: false,
        manage_timekeeping: false,
        correct_attendance: false,
        manage_payroll: false,
        approve_payroll: false,
        view_reports: false,
        view_audit: false,
        ...current[targetUserId],
        [key]: enabled,
      },
    }));
  };

  const toggleGuestRoom = async (userId: string, spaceId: string, enabled: boolean) => {
    if (!supabase || !canManageRoomAccess) return;
    setRoleError('');
    const result = enabled
      ? await supabase.from('space_memberships').insert({ space_id: spaceId, user_id: userId })
      : await supabase.from('space_memberships').delete().eq('space_id', spaceId).eq('user_id', userId);
    if (result.error) { setRoleError(result.error.message); return; }
    setGuestRoomAccess((current) => ({
      ...current,
      [userId]: enabled
        ? [...new Set([...(current[userId] ?? []), spaceId])]
        : (current[userId] ?? []).filter((id) => id !== spaceId),
    }));
  };

  return (
    <StaticPanel theme={theme} title="Admin" icon={ShieldCheck}>
      <div className="grid gap-4 xl:grid-cols-2">
        <div className={cn('rounded-lg border p-4', surface(theme))}>
          <p className={cn('text-xs font-semibold uppercase tracking-[0.18em]', muted(theme))}>Hub</p>
          <h2 className="mt-2 text-xl font-bold">{workspace?.name}</h2>
          <p className={cn('mt-1 text-sm capitalize', muted(theme))}>{workspace?.plan ?? 'free'} plan</p>
        </div>
        <div className={cn('relative rounded-lg border p-4', surface(theme))}>
          <div className="flex items-center justify-between gap-3">
            <p className={cn('text-xs font-semibold uppercase tracking-[0.18em]', muted(theme))}>Permissions</p>
            <button type="button" aria-label="How permissions work" title="How permissions work" onClick={() => setPermissionsHelpOpen((open) => !open)} className={cn('inline-flex h-8 w-8 items-center justify-center rounded-lg border', subtleButton(theme))}>
              <CircleHelp className="h-4 w-4" />
            </button>
          </div>
          {permissionsHelpOpen && (
            <div className={cn('absolute right-4 top-14 z-30 w-[min(340px,calc(100%_-_32px))] rounded-lg border p-4 shadow-2xl', theme === 'dark' ? 'border-white/10 bg-[#17151D]' : 'border-[#E7E3EA] bg-[#FFFFFF]')}>
              <div className="space-y-3">
                {workspaceRoles.map(({ role, detail }) => <div key={role}><p className="text-sm font-semibold">{getRoleLabel(role)}</p><p className={cn('text-xs leading-5', muted(theme))}>{detail}</p></div>)}
                <div><p className="text-sm font-semibold">Delegated capabilities</p><p className={cn('text-xs leading-5', muted(theme))}>Admins receive only the workforce capabilities the Owner enables. Every capability is enforced in both the interface and database.</p></div>
              </div>
            </div>
          )}
          {canManagePeople && <InvitePanel theme={theme} onInvite={onInvite} />}
        </div>

        <section className="xl:col-span-2">
          <div className="mb-3 flex items-center justify-between">
            <div><h3 className="font-bold">People and roles</h3><p className={cn('text-sm', muted(theme))}>Manage hub access without opening individual profiles.</p></div>
          </div>
          <div className="grid gap-4 lg:grid-cols-3">
            {groups.map((group) => {
              const groupMemberships = memberships.filter((membership) => group.roles.includes(membership.role));
              return (
                <div key={group.title} className={cn('rounded-lg border p-3', surface(theme))}>
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <p className={cn('text-xs font-semibold uppercase tracking-[0.16em]', muted(theme))}>{group.title}</p>
                    <span className="rounded-full bg-[var(--accent-soft)] px-2.5 py-1 text-xs font-bold text-[var(--accent-strong)]">{groupMemberships.length}</span>
                  </div>
                  <div className="grid max-h-[54vh] gap-2 overflow-y-auto pr-1 scroll-area">
                    {groupMemberships.map((membership) => {
                      const member = profiles[membership.user_id];
                      const memberName = getProfileFullName(member, 'Hub member');
                      return (
                        <div key={membership.id} className={cn('rounded-lg border p-3', theme === 'dark' ? 'border-white/10 bg-white/[0.03]' : 'border-[#E7E3EA] bg-white/70')}>
                          <div className="flex items-center gap-3">
                            <Avatar profile={member} />
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm font-bold">{memberName}</p>
                              <p className={cn('text-xs', muted(theme))}>{getRoleLabel(membership.role)}</p>
                            </div>
                            <select
                              value={membership.role}
                              disabled={membership.role === 'owner' || !canManagePeople}
                              aria-label={`Role for ${memberName}`}
                              onChange={async (event) => {
                                setRoleError('');
                                try { await onRoleChange(membership.id, event.target.value as WorkspaceRole); }
                                catch (caughtError) { setRoleError(getErrorMessage(caughtError)); }
                              }}
                              className={cn('h-9 w-28 rounded-lg border bg-transparent px-2 text-xs font-semibold outline-none disabled:cursor-not-allowed disabled:opacity-70', subtleButton(theme))}
                            >
                              {membership.role === 'owner' && <option value="owner">Owner</option>}
                              <option value="admin">Admin</option>
                              <option value="member">Member</option>
                              <option value="guest">Guest</option>
                            </select>
                          </div>
                          {membership.role === 'admin' && (
                            <AdminAccessDetails title="Capabilities" theme={theme}>
                              {capabilityOptions.map((option) => (
                                <label key={option.key} className="flex items-center justify-between gap-3 text-xs">
                                  <span>{option.label}</span>
                                  <input
                                    type="checkbox"
                                    checked={Boolean(capabilityRows[membership.user_id]?.[option.key])}
                                    disabled={currentRole !== 'owner'}
                                    onChange={(event) => void setCapability(membership.user_id, option.key, event.target.checked)}
                                    className="h-4 w-4 accent-[var(--accent)] disabled:opacity-60"
                                  />
                                </label>
                              ))}
                            </AdminAccessDetails>
                          )}
                          {membership.role === 'guest' && canManageRoomAccess && (
                            <AdminAccessDetails title="Room access" theme={theme}>
                              {spaces.map((space) => (
                                <label key={space.id} className="flex items-center justify-between gap-3 text-xs">
                                  <span className="truncate">{space.name}</span>
                                  <input
                                    type="checkbox"
                                    checked={Boolean(guestRoomAccess[membership.user_id]?.includes(space.id))}
                                    onChange={(event) => void toggleGuestRoom(membership.user_id, space.id, event.target.checked)}
                                    className="h-4 w-4 accent-[var(--accent)]"
                                  />
                                </label>
                              ))}
                              {spaces.length === 0 && <span className={cn('text-xs', muted(theme))}>No Rooms available.</span>}
                            </AdminAccessDetails>
                          )}
                        </div>
                      );
                    })}
                    {groupMemberships.length === 0 && <div className={cn('rounded-lg border border-dashed p-4 text-center text-sm', muted(theme))}>No {group.title.toLowerCase()} yet.</div>}
                  </div>
                </div>
              );
            })}
          </div>
          {roleError && <p className="mt-3 text-sm font-semibold text-[#B91C1C]">{roleError}</p>}
        </section>
      </div>
    </StaticPanel>
  );
}

function AdminAccessDetails({ title, theme, children }: { title: string; theme: 'light' | 'dark'; children: ReactNode }) {
  return (
    <details className={cn('mt-3 rounded-md border px-2 py-1.5', subtleButton(theme))}>
      <summary className="cursor-pointer text-xs font-semibold">{title}</summary>
      <div className="mt-2 grid max-h-56 gap-2 overflow-y-auto pr-1 scroll-area">
        {children}
      </div>
    </details>
  );
}

function InvitePanel({ theme, onInvite }: { theme: 'light' | 'dark'; onInvite: (email: string, role: WorkspaceRole) => Promise<string> }) {
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<WorkspaceRole>('member');
  const [inviteLink, setInviteLink] = useState('');
  const [sentTo, setSentTo] = useState('');
  const [copied, setCopied] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  return (
    <div className="mt-5 border-t border-inherit pt-4">
      <div className="mb-4 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[var(--accent-soft)] text-[var(--accent-strong)]">
          <UserPlus className="h-5 w-5" />
        </div>
        <div>
          <h3 className="font-bold">Invite by role</h3>
          <p className={cn('text-sm', muted(theme))}>Invite an Admin, Member, or Guest using their hub email.</p>
        </div>
      </div>
      <form
        className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_140px]"
        onSubmit={async (event) => {
          event.preventDefault();
          if (!email.trim()) return;
          setSubmitting(true);
          setError('');
          setCopied(false);
          setSentTo('');
          try {
            const inviteeEmail = email.trim();
            const link = await onInvite(inviteeEmail, role);
            setInviteLink(link);
            setSentTo(inviteeEmail);
          } catch (caughtError) {
            setError(getErrorMessage(caughtError));
          } finally {
            setSubmitting(false);
          }
        }}
      >
        <input
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          type="email"
          placeholder="person@company.com"
          className={cn('h-11 rounded-lg border bg-transparent px-3 outline-none', subtleButton(theme))}
        />
        <select value={role} onChange={(event) => setRole(event.target.value as WorkspaceRole)} className={cn('h-11 rounded-lg border bg-transparent px-3 outline-none', subtleButton(theme))}>
          <option value="admin">Admin</option>
          <option value="member">Member</option>
          <option value="guest">Guest</option>
        </select>
        <button disabled={submitting || !email.trim()} className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-[var(--accent-strong)] px-4 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50 sm:col-span-2">
          {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
          Invite
        </button>
      </form>
      {inviteLink && (
        <div className={cn('mt-4 rounded-lg border p-3 text-sm', subtleButton(theme))}>
          <p className="font-semibold text-[#0F766E]">Invitation emailed to {sentTo}.</p>
          <p className={cn('mb-2 mt-1 text-xs', muted(theme))}>Keep this backup link in case their email provider delays delivery.</p>
          <div className="flex gap-2">
            <input readOnly value={inviteLink} className="min-w-0 flex-1 bg-transparent outline-none" />
            <button
              className="inline-flex items-center gap-2 rounded-md bg-[var(--accent-strong)] px-3 py-2 text-xs font-semibold text-white"
              onClick={async () => {
                await navigator.clipboard.writeText(inviteLink);
                setCopied(true);
              }}
              type="button"
            >
              <Copy className="h-3.5 w-3.5" />
              {copied ? 'Copied' : 'Copy'}
            </button>
          </div>
        </div>
      )}
      {error && <p className="mt-3 text-sm font-semibold text-[#B91C1C]">{error}</p>}
    </div>
  );
}

function StaticPanel({ theme, title, icon: Icon, children }: { theme: 'light' | 'dark'; title: string; icon: LucideIcon; children: ReactNode }) {
  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <div className="mb-5 flex shrink-0 items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-[#17151D] text-[#FAF9FC]">
          <Icon className="h-5 w-5" />
        </div>
        <h2 className="text-2xl font-bold tracking-tight">{title}</h2>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto pb-8 pr-1 scroll-area">
        {children}
      </div>
    </div>
  );
}

function PostComposer({
  theme,
  spaces,
  defaultSpaceId,
  initialPost,
  draftKey,
  onClose,
  onCreate,
}: {
  theme: 'light' | 'dark';
  spaces: AppSpace[];
  defaultSpaceId: string;
  initialPost?: AppPost;
  draftKey: string;
  onClose: () => void;
  onCreate: (input: { title: string; body: string; spaceId: string }) => Promise<void>;
}) {
  const initialDraft = useMemo(() => ({
    title: initialPost?.title ?? '',
    body: initialPost?.body ?? '',
    spaceId: initialPost?.space_id ?? defaultSpaceId,
  }), [defaultSpaceId, initialPost?.body, initialPost?.space_id, initialPost?.title]);
  const [draft, setDraft, clearDraft] = usePersistentDraft(draftKey, initialDraft);
  const [submitting, setSubmitting] = useState(false);
  const title = draft.title;
  const body = draft.body;
  const spaceId = draft.spaceId;

  return (
    <ModalShell theme={theme} title={initialPost ? 'Edit post' : 'New post'} onClose={onClose}>
      <form
        className="grid gap-4"
        onSubmit={async (event) => {
          event.preventDefault();
          if (!title.trim() || !body.trim() || !spaceId) return;
          setSubmitting(true);
          try {
            await onCreate({ title: title.trim(), body: body.trim(), spaceId });
            clearDraft();
          } finally {
            setSubmitting(false);
          }
        }}
      >
        <label className="grid gap-2 text-sm font-semibold">
          Room
          <select value={spaceId} onChange={(event) => setDraft((current) => ({ ...current, spaceId: event.target.value }))} className={cn('h-11 rounded-lg border bg-transparent px-3 outline-none', subtleButton(theme))}>
            {spaces.map((space) => (
              <option key={space.id} value={space.id}>
                {space.name}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-2 text-sm font-semibold">
          Title
          <input value={title} onChange={(event) => setDraft((current) => ({ ...current, title: event.target.value }))} className={cn('h-11 rounded-lg border bg-transparent px-3 outline-none', subtleButton(theme))} />
        </label>
        <label className="grid gap-2 text-sm font-semibold">
          Body
          <textarea value={body} onChange={(event) => setDraft((current) => ({ ...current, body: event.target.value }))} className={cn('h-36 resize-none rounded-lg border bg-transparent p-3 outline-none', subtleButton(theme))} />
        </label>
        <button disabled={submitting || !title.trim() || !body.trim() || !spaceId} className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-[var(--accent-strong)] px-4 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50">
          {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
          {initialPost ? 'Save post' : 'Publish'}
        </button>
      </form>
    </ModalShell>
  );
}

function KnowledgeArticleModal({ theme, article, draftKey, onClose, onSave }: { theme: 'light' | 'dark'; article?: KnowledgeArticle; draftKey: string; onClose: () => void; onSave: (input: { category: KnowledgeCategory; title: string; summary: string; content: string }) => Promise<void> }) {
  const initialDraft = useMemo(() => ({
    category: article?.category ?? ('documentation' as KnowledgeCategory),
    title: article?.title ?? '',
    summary: article?.summary ?? '',
    content: article?.content ?? '',
  }), [article?.category, article?.content, article?.summary, article?.title]);
  const [draft, setDraft, clearDraft] = usePersistentDraft(draftKey, initialDraft);
  const category = draft.category;
  const title = draft.title;
  const summary = draft.summary;
  const content = draft.content;
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  return (
    <ModalShell theme={theme} title={article ? 'Edit knowledge article' : 'New knowledge article'} onClose={onClose}>
      <form className="grid gap-4" onSubmit={async (event) => {
        event.preventDefault();
        if (!title.trim() || !content.trim()) return;
        setSubmitting(true); setError('');
        try { await onSave({ category, title: title.trim(), summary: summary.trim(), content: content.trim() }); clearDraft(); }
        catch (caughtError) { setError(getErrorMessage(caughtError)); setSubmitting(false); }
      }}>
        <label className="grid gap-2 text-sm font-semibold">Category<select value={category} onChange={(event) => setDraft((current) => ({ ...current, category: event.target.value as KnowledgeCategory }))} className={cn('h-11 rounded-lg border bg-transparent px-3 outline-none', subtleButton(theme))}>{knowledgeCategories.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label>
        <label className="grid gap-2 text-sm font-semibold">Title<input value={title} onChange={(event) => setDraft((current) => ({ ...current, title: event.target.value }))} className={cn('h-11 rounded-lg border bg-transparent px-3 outline-none', subtleButton(theme))} /></label>
        <label className="grid gap-2 text-sm font-semibold">Summary<input value={summary} onChange={(event) => setDraft((current) => ({ ...current, summary: event.target.value }))} placeholder="A short description for search results" className={cn('h-11 rounded-lg border bg-transparent px-3 outline-none', subtleButton(theme))} /></label>
        <label className="grid gap-2 text-sm font-semibold">Article content<textarea value={content} onChange={(event) => setDraft((current) => ({ ...current, content: event.target.value }))} placeholder="Write clear steps, answers, or procedures..." className={cn('h-64 resize-y rounded-lg border bg-transparent p-3 leading-6 outline-none', subtleButton(theme))} /></label>
        <button disabled={submitting || !title.trim() || !content.trim()} className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-[var(--accent-strong)] px-4 text-sm font-semibold text-white disabled:opacity-50">{submitting && <Loader2 className="h-4 w-4 animate-spin" />}{article ? 'Save article' : 'Publish article'}</button>
        {error && <p className="text-sm font-semibold text-[#B91C1C]">{error}</p>}
      </form>
    </ModalShell>
  );
}

function SpaceModal({
  theme,
  draftKey,
  onClose,
  onCreate,
}: {
  theme: 'light' | 'dark';
  draftKey: string;
  onClose: () => void;
  onCreate: (input: { name: string; access: SpaceAccess }) => Promise<void>;
}) {
  const initialDraft = useMemo(() => ({ name: '', access: 'public' as SpaceAccess }), []);
  const [draft, setDraft, clearDraft] = usePersistentDraft(draftKey, initialDraft);
  const name = draft.name;
  const access = draft.access;
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  return (
    <ModalShell theme={theme} title="Create room" onClose={onClose}>
      <form
        className="grid gap-4"
        onSubmit={async (event) => {
          event.preventDefault();
          if (!name.trim()) return;
          setSubmitting(true);
          setError('');
          try {
            await onCreate({ name: name.trim(), access });
            clearDraft();
          } catch (caughtError) {
            setError(getErrorMessage(caughtError));
          } finally {
            setSubmitting(false);
          }
        }}
      >
        <label className="grid gap-2 text-sm font-semibold">
          Room name
          <input value={name} onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))} className={cn('h-11 rounded-lg border bg-transparent px-3 outline-none', subtleButton(theme))} />
        </label>
        <label className="grid gap-2 text-sm font-semibold">
          Access
          <select value={access} onChange={(event) => setDraft((current) => ({ ...current, access: event.target.value as SpaceAccess }))} className={cn('h-11 rounded-lg border bg-transparent px-3 outline-none', subtleButton(theme))}>
            <option value="public">Public room</option>
            <option value="private">Private room</option>
            <option value="invite_only">Invite-only room</option>
          </select>
        </label>
        <button disabled={submitting || !name.trim()} className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-[var(--accent-strong)] px-4 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50">
          {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
          Create room
        </button>
        {error && <p className="text-sm font-semibold text-[#B91C1C]">{error}</p>}
      </form>
    </ModalShell>
  );
}

function RoomEmailForwardingModal({ theme, room, premiumEmail, onUpgrade, onClose }: { theme: 'light' | 'dark'; room: AppSpace; premiumEmail: boolean; onUpgrade: () => void; onClose: () => void }) {
  const address = getRoomForwardingAddress(room);
  const enabled = room.email_forwarding_enabled !== false;
  const [copied, setCopied] = useState(false);

  const copyAddress = async () => {
    await navigator.clipboard.writeText(address);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  };

  return (
    <ModalShell theme={theme} title="Room Email" onClose={onClose}>
      <div className="grid gap-4">
        {!premiumEmail && <div className="rounded-lg border border-[#FDBA74] bg-[#FFF7ED] p-4 text-sm text-[#9A3412]"><p className="font-bold">Room Email</p><p className="mt-1 leading-6">Room email routing is available on active Standard Hub subscriptions. Forward email into Rooms and send outbound email from discussions without connecting personal mailboxes.</p><button type="button" onClick={onUpgrade} className="mt-3 inline-flex h-10 items-center justify-center rounded-lg bg-[var(--accent)] px-4 text-sm font-bold text-[var(--accent-ink)]">Manage billing</button></div>}
        <div>
          <p className="font-bold">Room Email Context For {room.name}</p>
          <p className={cn('mt-1 text-sm leading-6', muted(theme))}>
            Use this Room address to forward email into TriCord. Outbound email can be sent from the discussion by adding recipient metadata lines at the top of your reply, and TriCord keeps the sent message attached to the same post.
          </p>
        </div>
        <div className={cn('rounded-lg border p-3', subtleButton(theme))}>
          <p className={cn('text-xs font-semibold uppercase tracking-[0.16em]', muted(theme))}>Room Email Address</p>
          <div className="mt-2 flex items-center gap-2">
            <code className={cn('min-w-0 flex-1 overflow-hidden text-ellipsis whitespace-nowrap rounded-md bg-black/5 px-3 py-2 text-sm font-semibold dark:bg-white/10', !premiumEmail && 'opacity-50')}>{premiumEmail ? address : 'Email integration requires an active subscription'}</code>
            <button type="button" disabled={!premiumEmail} onClick={() => void copyAddress()} className={cn('inline-flex h-10 items-center gap-2 rounded-lg border px-3 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50', subtleButton(theme))}>
              <Copy className="h-4 w-4" />
              {copied ? 'Copied' : 'Copy'}
            </button>
          </div>
        </div>
        {!enabled && <p className="rounded-lg border border-[#FCA5A5] bg-[#FEF2F2] px-3 py-2 text-sm font-semibold text-[#B91C1C]">Email integration is disabled for this Room.</p>}
        <div className={cn('rounded-lg border p-3 text-sm leading-6', surface(theme))}>
          <p className="font-semibold">Send Email From A Discussion</p>
          <ol className={cn('mt-2 list-decimal space-y-1 pl-5', muted(theme))}>
            <li>Write recipient metadata lines at the top of your reply, such as <code>to:</code>, optional <code>cc:</code>, optional <code>bcc:</code>, and optional <code>subj:</code>.</li>
            <li>TriCord sends the message through the Room email identity and keeps the sent email attached to the discussion.</li>
            <li>Forward external email to the Room address when you want new customer or vendor context to become a TriCord post.</li>
          </ol>
        </div>
        <p className={cn('text-xs leading-5', muted(theme))}>
          The @ symbol is reserved for tagging Hub members. Email recipients are declared with <code>to:</code>, optional <code>cc:</code>, optional <code>bcc:</code>, and optional <code>subj:</code> lines.
        </p>
      </div>
    </ModalShell>
  );
}

function RenameRoomModal({ theme, room, onClose, onRename }: { theme: 'light' | 'dark'; room: AppSpace; onClose: () => void; onRename: (name: string) => Promise<void> }) {
  const [name, setName] = useState(room.name);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  return (
    <ModalShell theme={theme} title="Rename room" onClose={onClose}>
      <form className="grid gap-4" onSubmit={async (event) => {
        event.preventDefault();
        if (!name.trim()) return;
        setSubmitting(true);
        setError('');
        try { await onRename(name.trim()); }
        catch (caughtError) { setError(getErrorMessage(caughtError)); setSubmitting(false); }
      }}>
        <label className="grid gap-2 text-sm font-semibold">
          Room name
          <input autoFocus value={name} onChange={(event) => setName(event.target.value)} className={cn('h-11 rounded-lg border bg-transparent px-3 outline-none', subtleButton(theme))} />
        </label>
        <button disabled={submitting || !name.trim() || name.trim() === room.name} className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-[var(--accent-strong)] px-4 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50">
          {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
          Save name
        </button>
        {error && <p className="text-sm font-semibold text-[#B91C1C]">{error}</p>}
      </form>
    </ModalShell>
  );
}

function TaskModal({
  theme,
  profiles,
  task,
  draftKey,
  onClose,
  onCreate,
}: {
  theme: 'light' | 'dark';
  profiles: AppProfile[];
  task?: AppTask;
  draftKey: string;
  onClose: () => void;
  onCreate: (input: { title: string; description: string; projectName: string; priority: TaskPriority; tags: string[]; assigneeId: string; dueAt: string }) => Promise<void>;
}) {
  const initialDraft = useMemo(() => ({
    title: task?.title ?? '',
    description: task?.description ?? '',
    projectName: task?.project_name ?? '',
    priority: task?.priority ?? ('medium' as TaskPriority),
    tags: (task?.tags ?? []).join(', '),
    assigneeId: task?.assignee_id ?? '',
    dueAt: task?.due_at ? task.due_at.slice(0, 10) : '',
  }), [task?.assignee_id, task?.description, task?.due_at, task?.priority, task?.project_name, task?.tags, task?.title]);
  const [draft, setDraft, clearDraft] = usePersistentDraft(draftKey, initialDraft);
  const title = draft.title;
  const description = draft.description;
  const projectName = draft.projectName;
  const priority = draft.priority;
  const tags = draft.tags;
  const assigneeId = draft.assigneeId;
  const dueAt = draft.dueAt;
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  return (
    <ModalShell theme={theme} title={task ? 'Edit task' : 'New task'} onClose={onClose}>
      <form
        className="grid gap-4"
        onSubmit={async (event) => {
          event.preventDefault();
          if (!title.trim()) return;
          setSubmitting(true);
          setError('');
          try {
            await onCreate({ title: title.trim(), description: description.trim(), projectName: projectName.trim(), priority, tags: tags.split(',').map((tag) => tag.trim()).filter(Boolean).slice(0, 8), assigneeId, dueAt });
            clearDraft();
          } catch (caughtError) {
            setError(getErrorMessage(caughtError));
          } finally {
            setSubmitting(false);
          }
        }}
      >
        <label className="grid gap-2 text-sm font-semibold">
          Task title
          <input value={title} onChange={(event) => setDraft((current) => ({ ...current, title: event.target.value }))} className={cn('h-11 rounded-lg border bg-transparent px-3 outline-none', subtleButton(theme))} />
        </label>
        <label className="grid gap-2 text-sm font-semibold">
          Description
          <textarea value={description} onChange={(event) => setDraft((current) => ({ ...current, description: event.target.value }))} className={cn('h-28 resize-none rounded-lg border bg-transparent p-3 outline-none', subtleButton(theme))} />
        </label>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="grid gap-2 text-sm font-semibold">Project<input value={projectName} onChange={(event) => setDraft((current) => ({ ...current, projectName: event.target.value }))} placeholder="e.g. Website redesign" className={cn('h-11 rounded-lg border bg-transparent px-3 outline-none', subtleButton(theme))} /></label>
          <label className="grid gap-2 text-sm font-semibold">Priority<select value={priority} onChange={(event) => setDraft((current) => ({ ...current, priority: event.target.value as TaskPriority }))} className={cn('h-11 rounded-lg border bg-transparent px-3 outline-none', subtleButton(theme))}><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option><option value="urgent">Urgent</option></select></label>
        </div>
        <label className="grid gap-2 text-sm font-semibold">Tags<input value={tags} onChange={(event) => setDraft((current) => ({ ...current, tags: event.target.value }))} placeholder="design, onboarding, client" className={cn('h-11 rounded-lg border bg-transparent px-3 outline-none', subtleButton(theme))} /><span className={cn('text-xs font-normal', muted(theme))}>Separate tags with commas.</span></label>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="grid gap-2 text-sm font-semibold">
            Assignee
            <select value={assigneeId} onChange={(event) => setDraft((current) => ({ ...current, assigneeId: event.target.value }))} className={cn('h-11 rounded-lg border bg-transparent px-3 outline-none', subtleButton(theme))}>
              <option value="">Unassigned</option>
              {profiles.map((profile) => (
                <option key={profile.id} value={profile.id}>
                  {profile.display_name}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-2 text-sm font-semibold">
            Due date
            <input type="date" value={dueAt} onChange={(event) => setDraft((current) => ({ ...current, dueAt: event.target.value }))} className={cn('h-11 rounded-lg border bg-transparent px-3 outline-none', subtleButton(theme))} />
          </label>
        </div>
        <button disabled={submitting || !title.trim()} className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-[var(--accent-strong)] px-4 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50">
          {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
          {task ? 'Save task' : 'Create task'}
        </button>
        {error && <p className="text-sm font-semibold text-[#B91C1C]">{error}</p>}
      </form>
    </ModalShell>
  );
}


function BillingPlansModal({ theme, currentPlan, billableSeatCount, error, canManageBilling, onClose, onCheckout, onManageBilling }: { theme: 'light' | 'dark'; currentPlan: string; billableSeatCount: number; error: string; canManageBilling: boolean; onClose: () => void; onCheckout: (plan: PaidPlan, interval: BillingInterval) => Promise<void>; onManageBilling: () => Promise<void> }) {
  const [interval, setInterval] = useState<BillingInterval>('yearly');
  const [submitting, setSubmitting] = useState(false);
  const status = currentPlan || 'trial';
  const isActive = status === 'active';
  const isExpired = status === 'expired' || status === 'cancelled';
  const overIncludedEmployeeLimit = billableSeatCount > STANDARD_HUB_EMPLOYEE_LIMIT;
  const price = interval === 'monthly' ? STANDARD_HUB_MONTHLY_PRICE : STANDARD_HUB_YEARLY_PRICE;
  const priceLabel = interval === 'monthly' ? '/month' : '/year';

  const handlePrimary = async () => {
    if (!canManageBilling) return;
    if (isActive) {
      setSubmitting(true);
      try { await onManageBilling(); } finally { setSubmitting(false); }
      return;
    }
    if (overIncludedEmployeeLimit) {
      window.location.href = 'mailto:hello@tricord.cc?subject=TriCord%20custom%20plan&body=' + encodeURIComponent(`Hub employee count: ${billableSeatCount}

Please tell us about your team size and custom plan needs.`);
      return;
    }
    setSubmitting(true);
    try {
      await onCheckout('tricord', interval);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ModalShell theme={theme} title="Subscription" onClose={onClose} wide>
      <div className="grid gap-5 lg:grid-cols-[1.05fr_0.95fr]">
        <section className={cn('rounded-xl border p-5', surface(theme))}>
          <p className="text-lg font-bold">Standard Hub</p>
          <p className={cn('mt-2 text-sm leading-6', muted(theme))}>
            One flat subscription for a complete TriCord Hub. The Standard Hub includes up to {STANDARD_HUB_EMPLOYEE_LIMIT} employees, 25 mailboxes, 25 GB of storage, and unlimited rooms, messages, tasks, CRM, recruitment, knowledge base, and attendance. Shared mailboxes are not included.
          </p>
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            {launchPlans[0].highlights.map((item) => (
              <div key={item} className={cn('rounded-lg border px-3 py-3 text-sm font-semibold', subtleButton(theme))}>{item}</div>
            ))}
          </div>
          <p className={cn('mt-5 text-xs leading-5', muted(theme))}>
            Current employees: {billableSeatCount} of {STANDARD_HUB_EMPLOYEE_LIMIT} included. If this Hub needs more than {STANDARD_HUB_EMPLOYEE_LIMIT} employees, contact us for a custom plan. Promo codes can be entered in Stripe Checkout.
          </p>
        </section>
        <section className={cn('flex flex-col rounded-xl border p-5', surface(theme))}>
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[var(--accent-strong)]">Hub subscription</p>
              <h3 className="mt-2 text-2xl font-black capitalize">{status.replace(/_/g, ' ')}</h3>
            </div>
            <StatusBadge label={isActive ? 'Active' : isExpired ? 'Action needed' : 'Trial'} tone={isActive ? 'success' : isExpired ? 'accent' : 'neutral'} />
          </div>
          <div className={cn('mt-6 inline-flex w-fit rounded-lg border p-1', subtleButton(theme))}>
            <button type="button" onClick={() => setInterval('monthly')} className={cn('h-9 rounded-md px-3 text-sm font-semibold', interval === 'monthly' ? 'bg-[var(--accent)] text-[var(--accent-ink)]' : muted(theme))}>Monthly</button>
            <button type="button" onClick={() => setInterval('yearly')} className={cn('h-9 rounded-md px-3 text-sm font-semibold', interval === 'yearly' ? 'bg-[var(--accent)] text-[var(--accent-ink)]' : muted(theme))}>Yearly</button>
          </div>
          <div className="mt-6">
            <div className="flex items-end gap-2"><strong className="text-4xl font-black">${price}</strong><span className={cn('pb-1 text-sm font-semibold', muted(theme))}>{priceLabel}</span></div>
            {interval === 'yearly' && <p className={cn('mt-1 text-sm', muted(theme))}>Two months free compared with monthly billing.</p>}
          </div>
          {overIncludedEmployeeLimit && !isActive && <div className="mt-4 rounded-lg border border-[#FDBA74] bg-[#FFF7ED] px-3 py-2 text-sm font-semibold text-[#9A3412]">This Hub has more than {STANDARD_HUB_EMPLOYEE_LIMIT} employees. Please contact us for a custom plan.</div>}
          {error && <div className="mt-4 rounded-lg border border-[#FCA5A5] bg-[#FEF2F2] px-3 py-2 text-sm font-semibold text-[#B91C1C]">{error}</div>}
          {!canManageBilling && <p className="mt-4 text-sm font-semibold text-[#B91C1C]">Only the Hub Owner can manage billing.</p>}
          <button
            type="button"
            disabled={!canManageBilling || submitting}
            onClick={() => void handlePrimary()}
            className="mt-auto inline-flex h-11 w-full items-center justify-center rounded-lg bg-[var(--accent)] px-4 text-sm font-bold text-[var(--accent-ink)] disabled:cursor-not-allowed disabled:opacity-55"
          >
            {submitting ? 'Opening...' : isActive ? 'Manage billing' : overIncludedEmployeeLimit ? 'Contact us for custom plan' : 'Subscribe'}
          </button>
          <p className={cn('mt-4 text-xs leading-5', muted(theme))}>Stripe Checkout and Customer Portal handle payment details securely. TriCord never stores card numbers.</p>
        </section>
      </div>
    </ModalShell>
  );
}

function SettingsModal({
  section,
  theme,
  setTheme,
  accentColor,
  setAccentColor,
  chatOpen,
  setChatOpen,
  profile,
  email,
  workspace,
  role,
  ownerEmail,
  premiumEmail,
  businessModules,
  notificationPreferences,
  onNotificationPreferencesChange,
  onBusinessModulesChange,
  onUpgrade,
  onClose,
  onOpenSection,
  onSaveProfile,
  onUploadAvatar,
}: {
  section: AccountModalView;
  theme: 'light' | 'dark';
  setTheme: (theme: 'light' | 'dark') => void;
  accentColor: AccentColor;
  setAccentColor: (accent: AccentColor) => void;
  chatOpen: boolean;
  setChatOpen: (open: boolean) => void;
  profile?: AppProfile;
  email: string;
  workspace?: AppWorkspace;
  role?: WorkspaceRole;
  ownerEmail: string;
  premiumEmail: boolean;
  businessModules: BusinessModules;
  notificationPreferences: NotificationPreferences;
  onNotificationPreferencesChange: (preferences: NotificationPreferences) => void;
  onBusinessModulesChange: (modules: BusinessModules) => Promise<void>;
  onUpgrade: () => void;
  onClose: () => void;
  onOpenSection: (section: AccountModalView) => void;
  onSaveProfile: (input: { fullName: string; nickname: string; avatarUrl: string; phone: string; address: string; timezone: string; bio: string }) => Promise<void>;
  onUploadAvatar: (file: File) => Promise<string>;
}) {
  const [fullName, setFullName] = useState(profile?.full_name ?? profile?.display_name ?? '');
  const [nickname, setNickname] = useState(profile?.nickname ?? profile?.display_name ?? email.split('@')[0] ?? '');
  const [avatarUrl, setAvatarUrl] = useState(profile?.avatar_url ?? '');
  const [phone, setPhone] = useState(profile?.phone ?? '');
  const [address, setAddress] = useState(profile?.address ?? '');
  const [timezone, setTimezone] = useState(profile?.timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone);
  const [bio, setBio] = useState(profile?.bio ?? '');
  const [submitting, setSubmitting] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [concernType, setConcernType] = useState('Technical issue');
  const [concernDetails, setConcernDetails] = useState('');
  const [reportError, setReportError] = useState('');
  const [emailAccounts, setEmailAccounts] = useState<UserEmailAccount[]>([]);
  const [emailAccountNotice, setEmailAccountNotice] = useState('');
  const [emailAccountsLoading, setEmailAccountsLoading] = useState(false);
  const [moduleSavingKey, setModuleSavingKey] = useState<BusinessModuleKey | ''>('');
  const [moduleError, setModuleError] = useState('');
  const avatarInputRef = useRef<HTMLInputElement | null>(null);
  const modalTitles: Record<AccountModalView, string> = {
    personalization: 'Personalization',
    profile: 'Profile',
    settings: 'Settings',
    subscription: 'Subscription',
    notifications: 'Notifications',
    help: 'Help center',
    about: 'About TriCord',
    report: 'Report a problem',
  };

  const loadEmailAccounts = useCallback(async () => {
    if (!supabase || !workspace?.id || !profile?.id) return;
    setEmailAccountsLoading(true);
    const { data, error } = await supabase
      .from('user_email_accounts')
      .select('id, workspace_id, user_id, provider, email_address, display_name, token_expiry, provider_account_id, scopes, last_sync_at, sync_cursor, revoked_at, is_default, is_connected, last_error, created_at, updated_at')
      .eq('workspace_id', workspace.id)
      .eq('user_id', profile.id)
      .order('is_default', { ascending: false })
      .order('created_at', { ascending: true });
    setEmailAccountsLoading(false);
    if (error) setEmailAccountNotice(error.message);
    else setEmailAccounts((data ?? []) as UserEmailAccount[]);
  }, [profile?.id, workspace?.id]);

  useEffect(() => {
    if (section === 'profile') void loadEmailAccounts();
  }, [loadEmailAccounts, section]);

  const updateNotificationPreference = (key: keyof NotificationPreferences, value: boolean) => {
    if (key === 'desktop' && value && 'Notification' in window && Notification.permission === 'default') {
      void Notification.requestPermission();
    }
    onNotificationPreferencesChange({ ...notificationPreferences, [key]: value });
  };

  const setDefaultEmailAccount = async (accountId: string) => {
    if (!supabase) return;
    setEmailAccountNotice('');
    const { error } = await supabase.rpc('set_default_email_account', { target_account_id: accountId });
    if (error) setEmailAccountNotice(error.message); else { setEmailAccountNotice('Default sending identity updated.'); await loadEmailAccounts(); }
  };

  const disconnectEmailAccount = async (accountId: string) => {
    if (!supabase) return;
    setEmailAccountNotice('');
    const { error } = await supabase.rpc('disconnect_email_account', { target_account_id: accountId });
    if (error) setEmailAccountNotice(error.message); else { setEmailAccountNotice('Email account disconnected.'); await loadEmailAccounts(); }
  };

  const connectEmailProvider = async (provider: string) => {
    if (!supabase || !workspace?.id) return;
    setEmailAccountNotice('');
    const normalizedProvider = provider.toLowerCase().includes('gmail')
      ? 'gmail'
      : provider.toLowerCase().includes('microsoft') || provider.toLowerCase().includes('outlook')
        ? 'microsoft365'
        : '';
    if (!normalizedProvider) {
      setEmailAccountNotice('Choose Google Workspace/Gmail or Microsoft 365/Outlook to connect email.');
      return;
    }
    const { data, error } = await supabase.functions.invoke('email-oauth-start', { body: { workspaceId: workspace.id, provider: normalizedProvider } });
    if (error) {
      setEmailAccountNotice(await getFunctionErrorMessage(error));
      return;
    }
    const authUrl = (data as { authUrl?: string } | null)?.authUrl;
    if (!authUrl) {
      setEmailAccountNotice('Email connection could not start.');
      return;
    }
    window.location.href = authUrl;
  };

  return (
    <ModalShell theme={theme} title={modalTitles[section]} onClose={onClose} wide={section === 'profile' || section === 'help'} full={section === 'help'}>
      <div className="grid gap-5">
        {section === 'profile' && <section className={cn('rounded-lg border p-4', surface(theme))}>
          <div className="mb-4 flex items-center gap-3">
            <Avatar profile={{ id: profile?.id ?? '', email, display_name: nickname || 'Member', full_name: fullName, nickname, avatar_url: avatarUrl || null, timezone }} />
            <div className="min-w-0">
              <p className="truncate font-bold">{nickname || 'Hub member'}</p>
              <p className={cn('truncate text-sm', muted(theme))}>{workspace?.name ?? 'Hub'} · {role ? getRoleLabel(role) : 'Member'}</p>
            </div>
          </div>
          <form
            className="grid gap-3 md:grid-cols-2"
            onSubmit={async (event) => {
              event.preventDefault();
              if (!fullName.trim() || !nickname.trim()) return;
              setSubmitting(true);
              setSaved(false);
              setError('');
              try {
                await onSaveProfile({
                  fullName: fullName.trim(),
                  nickname: nickname.trim(),
                  avatarUrl: avatarUrl.trim(),
                  phone: phone.trim(),
                  address: address.trim(),
                  timezone: timezone.trim(),
                  bio: bio.trim(),
                });
                setSaved(true);
              } catch (caughtError) {
                setError(getErrorMessage(caughtError));
              } finally {
                setSubmitting(false);
              }
            }}
          >
            <label className="grid gap-2 text-sm font-semibold">
              <span className="inline-flex items-center gap-2"><User className="h-4 w-4" /> Full name</span>
              <input value={fullName} onChange={(event) => setFullName(event.target.value)} autoComplete="name" className={cn('h-11 rounded-lg border bg-transparent px-3 outline-none', subtleButton(theme))} />
            </label>
            <label className="grid gap-2 text-sm font-semibold">
              <span className="inline-flex items-start gap-1">
                Nickname
                <span className="group relative inline-flex" tabIndex={0}>
                  <CircleHelp className="mt-0.5 h-3 w-3" aria-label="About nicknames" />
                  <span role="tooltip" className={cn('pointer-events-none absolute bottom-[calc(100%+0.4rem)] left-1/2 z-30 w-48 -translate-x-1/2 rounded-md border px-2.5 py-2 text-center text-xs font-normal opacity-0 shadow-lg transition group-hover:opacity-100 group-focus:opacity-100', theme === 'dark' ? 'border-white/10 bg-[#17151D] text-white' : 'border-[#E7E3EA] bg-white text-[#3D3744]')}>
                    Shown in chat, posts, and your profile.
                  </span>
                </span>
              </span>
              <input value={nickname} onChange={(event) => setNickname(event.target.value)} className={cn('h-11 rounded-lg border bg-transparent px-3 outline-none', subtleButton(theme))} />
            </label>
            <label className="grid gap-2 text-sm font-semibold">
              <span className="inline-flex items-center gap-2"><Mail className="h-4 w-4" /> TriCord email</span>
              <input readOnly value={email} className={cn('h-11 cursor-not-allowed rounded-lg border bg-transparent px-3 opacity-75 outline-none', subtleButton(theme))} />
            </label>
            <label className="grid gap-2 text-sm font-semibold">
              <span className="inline-flex items-center gap-2"><Phone className="h-4 w-4" /> Contact number</span>
              <input value={phone} onChange={(event) => setPhone(event.target.value)} className={cn('h-11 rounded-lg border bg-transparent px-3 outline-none', subtleButton(theme))} />
            </label>
            <label className="grid gap-2 text-sm font-semibold md:col-span-2">
              Address
              <input value={address} onChange={(event) => setAddress(event.target.value)} className={cn('h-11 rounded-lg border bg-transparent px-3 outline-none', subtleButton(theme))} />
            </label>
            <label className="grid gap-2 text-sm font-semibold md:col-span-2">
              <span className="inline-flex items-center gap-2"><Camera className="h-4 w-4" /> Photo URL</span>
              <input value={avatarUrl} onChange={(event) => setAvatarUrl(event.target.value)} placeholder="https://..." className={cn('h-11 rounded-lg border bg-transparent px-3 outline-none', subtleButton(theme))} />
            </label>
            <div className="grid gap-2 text-sm font-semibold md:col-span-2">
              <span>Or upload a photo</span>
              <input
                ref={avatarInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={async (event) => {
                  const file = event.target.files?.[0];
                  event.target.value = '';
                  if (!file) return;
                  setUploadingAvatar(true);
                  setError('');
                  try {
                    setAvatarUrl(await onUploadAvatar(file));
                  } catch (caughtError) {
                    setError(getErrorMessage(caughtError));
                  } finally {
                    setUploadingAvatar(false);
                  }
                }}
              />
              <button
                type="button"
                disabled={uploadingAvatar}
                onClick={() => avatarInputRef.current?.click()}
                className={cn('inline-flex h-11 items-center justify-center gap-2 rounded-lg border px-4', subtleButton(theme))}
              >
                {uploadingAvatar ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}
                {uploadingAvatar ? 'Uploading...' : 'Choose image'}
              </button>
            </div>
            <label className="grid gap-2 text-sm font-semibold">
              Time zone
              <input value={timezone} onChange={(event) => setTimezone(event.target.value)} className={cn('h-11 rounded-lg border bg-transparent px-3 outline-none', subtleButton(theme))} />
            </label>
            <label className="grid gap-2 text-sm font-semibold md:col-span-2">
              About
              <textarea value={bio} onChange={(event) => setBio(event.target.value)} className={cn('h-24 resize-none rounded-lg border bg-transparent p-3 outline-none', subtleButton(theme))} />
            </label>
            <button disabled={submitting || !fullName.trim() || !nickname.trim()} className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-[var(--accent-strong)] px-4 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50 md:col-span-2">
              {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
              Save profile
            </button>
            {saved && <p className="text-sm font-semibold text-[#0F766E] md:col-span-2">Profile saved.</p>}
            {error && <p className="text-sm font-semibold text-[#B91C1C] md:col-span-2">{error}</p>}
          </form>
        </section>}

        {section === 'personalization' && <section className={cn('rounded-lg border p-4', surface(theme))}>
          <p className="font-bold">Appearance</p>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <button type="button" onClick={() => setTheme('light')} className={cn('inline-flex h-10 items-center justify-center gap-2 rounded-lg border text-sm font-semibold', theme === 'light' ? 'border-[var(--accent)] bg-[var(--accent)] text-[var(--accent-ink)]' : subtleButton(theme))}>
              <Sun className="h-4 w-4" />
              Light
            </button>
            <button type="button" onClick={() => setTheme('dark')} className={cn('inline-flex h-10 items-center justify-center gap-2 rounded-lg border text-sm font-semibold', theme === 'dark' ? 'border-[var(--accent)] bg-[var(--accent)] text-[var(--accent-ink)]' : subtleButton(theme))}>
              <Moon className="h-4 w-4" />
              Dark
            </button>
          </div>
          <div className="mt-5 border-t border-inherit pt-4">
            <p className="font-bold">Accent color</p>
            <p className={cn('mt-1 text-xs', muted(theme))}>Choose the color used for selected items, controls, and highlights.</p>
            <div className="mt-3 flex flex-wrap gap-2" role="radiogroup" aria-label="Accent color">
              {(Object.entries(accentPalettes) as [AccentColor, (typeof accentPalettes)[AccentColor]][]).map(([value, palette]) => (
                <button
                  key={value}
                  type="button"
                  role="radio"
                  aria-checked={accentColor === value}
                  aria-label={palette.label}
                  title={palette.label}
                  onClick={() => setAccentColor(value)}
                  className={cn(
                    'flex h-10 w-10 items-center justify-center rounded-lg border transition',
                    accentColor === value ? 'border-current ring-2 ring-[var(--accent)] ring-offset-2 ring-offset-transparent' : 'border-transparent',
                  )}
                >
                  <span className="h-6 w-6 rounded-md" style={{ backgroundColor: palette.accent }} />
                </button>
              ))}
            </div>
          </div>
          <div className="mt-5 border-t border-inherit pt-4">
            <p className="font-bold">Workspace layout</p>
            <label className="mt-3 flex items-center justify-between gap-4 text-sm">
              <span><span className="block font-semibold">Discussion side panel</span><span className={cn('mt-1 block text-xs', muted(theme))}>Show chat on Tasks, Knowledge, and Admin. Toggle it anytime with Ctrl/⌘ + \.</span></span>
              <input type="checkbox" checked={chatOpen} onChange={(event) => setChatOpen(event.target.checked)} className="h-4 w-4 accent-[var(--accent-strong)]" />
            </label>
          </div>
        </section>}

        {section === 'notifications' && <section className={cn('rounded-lg border p-4', surface(theme))}>
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[var(--accent-soft)] text-[var(--accent-strong)]"><Bell className="h-4 w-4" /></div>
            <div>
              <p className="font-bold">Notification preferences</p>
              <p className={cn('mt-1 text-sm leading-6', muted(theme))}>Choose how TriCord alerts you about important Hub activity on this browser.</p>
            </div>
          </div>
          <div className="mt-5 grid gap-3">
            <NotificationToggle theme={theme} title="Desktop notifications" body="Show system notifications when new activity arrives while TriCord is in the background." checked={notificationPreferences.desktop} onChange={(checked) => updateNotificationPreference('desktop', checked)} />
            <NotificationToggle theme={theme} title="Sound alerts" body="Play a short sound for new background activity." checked={notificationPreferences.sound} onChange={(checked) => updateNotificationPreference('sound', checked)} />
            <NotificationToggle theme={theme} title="Browser tab badge" body="Show unread counts in the browser title and favicon." checked={notificationPreferences.tabBadges} onChange={(checked) => updateNotificationPreference('tabBadges', checked)} />
            <NotificationToggle theme={theme} title="Mentions" body="Count messages that mention your name or email address." checked={notificationPreferences.mentions} onChange={(checked) => updateNotificationPreference('mentions', checked)} />
            <NotificationToggle theme={theme} title="Direct messages and replies" body="Count new discussion replies from other Hub members." checked={notificationPreferences.directMessages} onChange={(checked) => updateNotificationPreference('directMessages', checked)} />
            <NotificationToggle theme={theme} title="Task assignments" body="Count newly assigned tasks." checked={notificationPreferences.taskAssignments} onChange={(checked) => updateNotificationPreference('taskAssignments', checked)} />
            <NotificationToggle theme={theme} title="Announcements and posts" body="Count new posts in the Hub." checked={notificationPreferences.announcements} onChange={(checked) => updateNotificationPreference('announcements', checked)} />
            <NotificationToggle theme={theme} title="Email notifications" body="Reserve email notifications for important updates when email delivery is enabled for your Hub." checked={notificationPreferences.email} onChange={(checked) => updateNotificationPreference('email', checked)} />
          </div>
        </section>}

        {section === 'settings' && (
          <div className="grid gap-3">
            <section className={cn('rounded-lg border p-4', surface(theme))}>
              <p className={cn('text-xs font-semibold uppercase tracking-[0.16em]', muted(theme))}>Account</p>
              <div className="mt-3 flex items-center gap-3"><Avatar profile={profile} /><div className="min-w-0"><p className="truncate font-bold">{getProfileName(profile, email.split('@')[0] || 'Hub member')}</p><p className={cn('truncate text-sm', muted(theme))}>{email}</p></div></div>
            </section>
            <section className={cn('rounded-lg border p-4', surface(theme))}>
              <p className={cn('text-xs font-semibold uppercase tracking-[0.16em]', muted(theme))}>Plan</p>
              <p className="mt-2 text-lg font-bold">{formatSubscriptionStatusLabel(workspace)}</p>
              <p className={cn('mt-1 text-sm leading-6', muted(theme))}>Your current TriCord account includes the core Hub, Room, feed, task, and knowledge features.</p>
            </section>
            <section className={cn('rounded-lg border p-4', surface(theme))}>
              <p className={cn('text-xs font-semibold uppercase tracking-[0.16em]', muted(theme))}>Hub access</p>
              <p className="mt-2 font-bold">{workspace?.name ?? 'Hub'}</p>
              <p className={cn('mt-1 text-sm', muted(theme))}>{role ? getRoleLabel(role) : 'Member'} role</p>
            </section>
            {role === 'owner' && premiumEmail && (
              <section className={cn('rounded-lg border p-4', surface(theme))}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className={cn('text-xs font-semibold uppercase tracking-[0.16em]', muted(theme))}>Hub Settings · Workforce</p>
                    <p className={cn('mt-2 text-sm leading-6', muted(theme))}>These are Hub-level settings. Optional recordkeeping modules stay off until an Owner enables them for this Hub.</p>
                  </div>
                  <span className="rounded-full bg-[var(--accent-soft)] px-3 py-1 text-xs font-bold text-[var(--accent-strong)]">Owner only</span>
                </div>
                <div className="mt-4 grid gap-3">
                  {BUSINESS_MODULE_CONFIGS.map((module) => (
                    <label key={module.key} className={cn('flex items-start justify-between gap-4 rounded-lg border p-3', subtleButton(theme))}>
                      <span className="min-w-0">
                        <span className="block text-sm font-bold">{module.title}</span>
                        <span className={cn('mt-1 block text-xs leading-5', muted(theme))}>{module.description}</span>
                      </span>
                      <span className="flex shrink-0 items-center gap-2">
                        {moduleSavingKey === module.key && <Loader2 className="h-4 w-4 animate-spin" />}
                        <input
                          type="checkbox"
                          checked={businessModules[module.key]}
                          disabled={Boolean(moduleSavingKey)}
                          onChange={async (event) => {
                            const nextModules = { ...businessModules, [module.key]: event.target.checked };
                            setModuleSavingKey(module.key);
                            setModuleError('');
                            try { await onBusinessModulesChange(nextModules); }
                            catch (caughtError) { setModuleError(getErrorMessage(caughtError)); }
                            finally { setModuleSavingKey(''); }
                          }}
                          className="h-4 w-4 accent-[var(--accent-strong)]"
                        />
                      </span>
                    </label>
                  ))}
                </div>
                {moduleError && <p className="mt-3 text-sm font-semibold text-[#B91C1C]">{moduleError}</p>}
              </section>
            )}
          </div>
        )}


        {section === 'subscription' && (
          <section className={cn('rounded-lg border p-4', surface(theme))}>
            <p className={cn('text-xs font-semibold uppercase tracking-[0.16em]', muted(theme))}>Subscription</p>
            <div className="mt-3 flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-2xl font-bold capitalize">{formatSubscriptionStatusLabel(workspace)}</p>
                <p className={cn('mt-1 text-sm leading-6', muted(theme))}>Billing belongs to this Hub. Changing this subscription will not affect other Hubs you belong to.</p>
              </div>
              <span className="rounded-full bg-[var(--accent-soft)] px-3 py-1 text-xs font-bold text-[var(--accent-strong)]">Owner only</span>
            </div>
            <div className={cn('mt-5 rounded-lg border p-4', subtleButton(theme))}>
              <p className="font-bold">{workspace?.name ?? 'Current Hub'}</p>
              <p className={cn('mt-1 text-sm', muted(theme))}>Use this area to subscribe after the trial, manage payment details, review invoices, or export Hub data.</p>
            </div>
            <button type="button" onClick={onUpgrade} className="mt-5 inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-[var(--accent)] px-5 text-sm font-bold text-[var(--accent-ink)]">
              <CreditCard className="h-4 w-4" />
              {workspace?.subscription_status === 'active' ? 'Manage subscription' : 'Subscribe'}
            </button>
          </section>
        )}

        {section === 'help' && (
          <div className="grid gap-4 lg:grid-cols-3">
            <section className={cn('rounded-lg border p-4 lg:col-span-3', surface(theme))}>
              <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="font-bold">TriCord User Guide</p><p className={cn('mt-1 text-sm leading-6', muted(theme))}>Download the complete TriCord user guide.</p></div><div className="flex flex-wrap gap-2"><a href={USER_GUIDE_URL} target="_blank" rel="noreferrer" className="inline-flex h-10 items-center justify-center rounded-lg bg-[var(--accent)] px-4 text-sm font-bold text-[var(--accent-ink)]">Open PDF</a></div></div>
            </section>
            <HelpTopic title="Active Feed and discussions" body="Create focused posts inside Rooms, keep replies attached to the original topic, add reactions, forward selected messages, archive outcomes, and reopen the side discussion panel from a post when needed." theme={theme} />
            <HelpTopic title="Rooms" body="Use Rooms to separate work by team, client, department, or process. Owners and Admins can create, rename, pin, sort, move, and delete Rooms. Members can manage Rooms they created when permissions allow." theme={theme} />
            <HelpTopic title="Tasks" body="Plan work with Board, List, and Calendar views. Add assignees, priorities, due dates, project names, statuses, and archive completed or canceled work." theme={theme} />
            <HelpTopic title="Knowledge base" body="Create documentation, how-to guides, FAQs, best practices, troubleshooting notes, and SOPs. Everyone except Guests can read knowledge articles; Owners and permitted Admins can manage them." theme={theme} />
            <HelpTopic title="Attendance Tracking" body="Optional workforce tools. Admins and Members can clock in and out when enabled. Owners can correct records. Hub Owners can configure per-employee requirements such as GPS, IP, device information, photo verification, workdays, and grace periods." theme={theme} />
            <HelpTopic title="Employee Records" body="Optional workforce tools. Manage employee profiles, leave requests, documents, performance records, and compensation details. Members can view their own records and request changes where direct editing is not allowed." theme={theme} />
            <HelpTopic title="Payroll Preparation" body="Optional workforce tools. Organize preparation periods, compensation items, payment details, and owner-reviewed draft summaries. TriCord is not a payroll processor and does not provide tax, legal, HR, or compliance advice." theme={theme} />
            <HelpTopic title="Attendance Reports" body="Review tasks, activity, and enabled workforce records from one operational dashboard." theme={theme} />
            <HelpTopic title="Admin, roles, and permissions" body="Owners manage billing, roles, invites, Room access, and granular Admin capabilities. Admins only see features they have been granted. Members and Guests see only what is relevant to their role." theme={theme} />
            <HelpTopic title="Email Features" body="Forward email into a Room using its Room email address, or send outbound email from a discussion with metadata lines such as to:, cc:, bcc:, and subj:. The @ symbol is reserved for tagging people in the Hub." theme={theme} />
            <HelpTopic title="Privacy and employee notices" body="Owners are responsible for giving employees and users any required notices before collecting employee records, compensation details, GPS, IP address, device information, selfie images, or other sensitive workforce data." theme={theme} />
            <HelpTopic title="HIPAA and regulated data" body="TriCord is not designed for protected health information, medical records, payment card numbers, bank login credentials, or other regulated data unless TriCord has expressly agreed in writing to support that data type." theme={theme} />
            <HelpTopic title="Billing and subscriptions" body="Owners manage the Hub subscription, promo codes, taxes, renewal terms, and payment methods through Stripe Checkout or the billing portal. Standard Hub pricing includes up to 25 employees; larger teams should contact TriCord for a custom plan." theme={theme} />
            <HelpTopic title="Personalization And Settings" body="Use Settings to manage profile details, nickname, photo URL or upload, theme, accent color, discussion-panel preference, Workforce, Help, reporting a problem, and logout." theme={theme} />
            <HelpTopic title="Keyboard shortcut" body="Press Ctrl plus Backslash on Windows or Linux, or Command plus Backslash on macOS, to hide or show the discussion panel." theme={theme} />
            <button type="button" onClick={() => onOpenSection('report')} className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-[var(--accent-strong)] px-4 text-sm font-semibold text-white lg:col-span-3"><Bug className="h-4 w-4" />Report a problem</button>
          </div>
        )}

        {section === 'about' && (
          <section className={cn('rounded-lg border p-5', surface(theme))}>
            <div className="flex items-center gap-3"><div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[var(--accent)]"><TriCordLogo className="h-9 w-9" /></div><div><p className="text-lg font-bold">TriCord</p><p className={cn('text-sm', muted(theme))}>Collaborative hubs for teams</p></div></div>
            <p className={cn('mt-5 text-sm leading-7', muted(theme))}>TriCord brings conversations, project work, shared knowledge, and hub administration into one focused workspace.</p>
            <div className="mt-5 border-t border-inherit pt-4"><p className="text-sm font-semibold">Account plan</p><p className={cn('mt-1 text-sm', muted(theme))}>{formatSubscriptionStatusLabel(workspace)}</p></div>
          </section>
        )}

        {section === 'report' && (
          <form
            className="grid gap-4"
            onSubmit={(event) => {
              event.preventDefault();
              setReportError('');
              if (!ownerEmail) {
                setReportError('The Hub owner email is not available. Ask a Owner or Admin for support.');
                return;
              }
              if (!concernDetails.trim()) return;
              const subject = `[TriCord] ${concernType}`;
              const body = [`Hub: ${workspace?.name ?? 'TriCord'}`, `From: ${email}`, `Concern: ${concernType}`, '', concernDetails.trim()].join('\n');
              window.location.href = `mailto:${encodeURIComponent(ownerEmail)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
            }}
          >
            <p className={cn('text-sm leading-6', muted(theme))}>Describe what happened and TriCord will prepare an email addressed to your Hub owner.</p>
            <label className="grid gap-2 text-sm font-semibold">
              Type of concern
              <select value={concernType} onChange={(event) => setConcernType(event.target.value)} className={cn('h-11 rounded-lg border bg-transparent px-3 outline-none', subtleButton(theme))}>
                <option>Technical issue</option>
                <option>Account or access</option>
                <option>Privacy or safety</option>
                <option>Billing or plan</option>
                <option>Feature request</option>
                <option>Other</option>
              </select>
            </label>
            <label className="grid gap-2 text-sm font-semibold">
              Details
              <textarea value={concernDetails} onChange={(event) => setConcernDetails(event.target.value)} placeholder="Include what you expected, what happened, and any steps that may help reproduce it." className={cn('min-h-40 resize-y rounded-lg border bg-transparent p-3 outline-none', subtleButton(theme))} />
            </label>
            <button disabled={!concernDetails.trim()} className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-[var(--accent-strong)] px-4 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"><Mail className="h-4 w-4" />Submit</button>
            <p className={cn('text-xs leading-5', muted(theme))}>Your default email app will open so you can review and send the message.</p>
            {reportError && <p className="text-sm font-semibold text-[#B91C1C]">{reportError}</p>}
          </form>
        )}
      </div>
    </ModalShell>
  );
}

function ConfirmActionModal({ theme, title, body, confirmLabel, onClose, onConfirm, onError }: { theme: 'light' | 'dark'; title: string; body: string; confirmLabel: string; onClose: () => void; onConfirm: () => Promise<void>; onError: (message: string) => void }) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  return (
    <ModalShell theme={theme} title={title} onClose={onClose}>
      <div className="grid gap-4">
        <p className={cn('text-sm leading-6', muted(theme))}>{body}</p>
        {error && <p className="rounded-lg border border-[#FCA5A5] bg-[#FEF2F2] px-3 py-2 text-sm font-semibold text-[#B91C1C]">{error}</p>}
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} disabled={submitting} className={cn('h-10 rounded-lg border px-4 text-sm font-semibold', subtleButton(theme))}>Cancel</button>
          <button
            type="button"
            disabled={submitting}
            onClick={async () => {
              setSubmitting(true);
              setError('');
              try {
                await onConfirm();
              } catch (caughtError) {
                const message = getErrorMessage(caughtError);
                setError(message);
                onError(message);
              } finally {
                setSubmitting(false);
              }
            }}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-[#DC2626] px-4 text-sm font-semibold text-white disabled:opacity-60"
          >
            {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
            {confirmLabel}
          </button>
        </div>
      </div>
    </ModalShell>
  );
}

function ModalShell({ theme, title, children, onClose, wide = false, full = false }: { theme: 'light' | 'dark'; title: string; children: ReactNode; onClose: () => void; wide?: boolean; full?: boolean }) {
  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/35 p-4">
      <div className={cn('max-h-[calc(100dvh-2rem)] w-full overflow-y-auto rounded-xl border p-5 shadow-2xl scroll-area', full ? 'max-w-7xl' : wide ? 'max-w-4xl' : 'max-w-lg', theme === 'dark' ? 'border-white/10 bg-[#0C0B10]' : 'border-[#E7E3EA] bg-[#FFFFFF]')}>
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-xl font-bold">{title}</h2>
          <button aria-label="Close modal" onClick={onClose} className={cn('rounded-lg border p-2', subtleButton(theme))}>
            <X className="h-4 w-4" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function AuthScreen({ theme, setTheme, inviteToken }: { theme: 'light' | 'dark'; setTheme: (theme: 'light' | 'dark') => void; inviteToken: string }) {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  return (
    <CenteredScreen theme={theme} setTheme={setTheme}>
      <div className="mx-auto max-w-md text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-[var(--accent)] shadow-lg shadow-[var(--accent-strong)]/20">
          <TriCordLogo className="h-11 w-11" />
        </div>
        <h1 className="mt-6 text-3xl font-bold tracking-tight">{inviteToken ? 'Accept your invite' : 'Sign in to TriCord'}</h1>
        <p className={cn('mt-3 text-sm leading-6', muted(theme))}>
          {inviteToken
            ? 'Use the exact email address that received this invite.'
            : 'Enter the email connected to your Hub. Owners, Admins, Members, and Guests all use the same sign-in.'}
        </p>
        <form
          className="mt-6 grid gap-3 text-left"
          onSubmit={async (event) => {
            event.preventDefault();
            if (!supabase || !email.trim()) return;
            setSubmitting(true);
            setError('');
            const redirectUrl = getAuthRedirectUrl(inviteToken);
            const { error: signInError } = await supabase.auth.signInWithOtp({
              email: email.trim(),
              options: { emailRedirectTo: redirectUrl },
            });
            setSubmitting(false);
            if (signInError) setError(signInError.message);
            else setSent(true);
          }}
        >
          <input value={email} onChange={(event) => setEmail(event.target.value)} type="email" placeholder="you@company.com" className={cn('h-12 rounded-lg border bg-transparent px-4 outline-none', subtleButton(theme))} />
          <button disabled={submitting || !email.trim()} className="inline-flex h-12 items-center justify-center gap-2 rounded-lg bg-[var(--accent-strong)] px-4 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50">
            {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
            Send magic link
          </button>
          {sent && <p className="text-sm font-semibold text-[#0F766E]">Check your email for a sign-in link.</p>}
          {error && <p className="text-sm font-semibold text-[#B91C1C]">{error}</p>}
        </form>
      </div>
    </CenteredScreen>
  );
}

function OnboardingScreen({
  theme,
  setTheme,
  email,
  onCreate,
  onSignOut,
}: {
  theme: 'light' | 'dark';
  setTheme: (theme: 'light' | 'dark') => void;
  email: string;
  onCreate: (setup: HubSetup) => Promise<void>;
  onSignOut: () => void;
}) {
  const [name, setName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [creatingHub, setCreatingHub] = useState(false);
  const [countryCode, setCountryCode] = useState('US');
  const [currencyCode, setCurrencyCode] = useState('USD');
  const [timezone, setTimezone] = useState(Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC');
  const [dateFormat, setDateFormat] = useState('MM/DD/YYYY');
  const [payrollFrequency, setPayrollFrequency] = useState('biweekly');
  const [firstDayOfWeek, setFirstDayOfWeek] = useState(0);

  return (
    <CenteredScreen theme={theme} setTheme={setTheme}>
      <div className="mx-auto max-w-md text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-[var(--accent)] shadow-lg shadow-[var(--accent-strong)]/20">
          <TriCordLogo className="h-11 w-11" />
        </div>
        <h1 className="mt-6 text-3xl font-bold tracking-tight">No Hub found</h1>
        <p className={cn('mt-3 text-sm leading-6', muted(theme))}>
          You are signed in as {email}, but this email is not a member of any Hub yet. If you expected access, use the invited email or ask your Owner/Admin for an invite.
        </p>
        {!creatingHub && (
          <div className="mt-6 grid gap-3 text-left">
            <button type="button" onClick={onSignOut} className="inline-flex h-12 items-center justify-center rounded-lg bg-[var(--accent-strong)] px-4 text-sm font-semibold text-white">
              Sign in with a different email
            </button>
            <button type="button" onClick={() => setCreatingHub(true)} className={cn('inline-flex h-11 items-center justify-center rounded-lg border px-4 text-sm font-semibold', subtleButton(theme))}>
              Create a new Hub instead
            </button>
          </div>
        )}
        {creatingHub && (
          <form
            className="mt-6 grid gap-3 text-left"
            onSubmit={async (event) => {
              event.preventDefault();
              if (!name.trim()) return;
              setSubmitting(true);
              setError('');
              try {
                await onCreate({ name: name.trim(), countryCode, currencyCode, locale: navigator.language || 'en-US', timezone, dateFormat, payrollFrequency, firstDayOfWeek });
              } catch (caughtError) {
                setError(getErrorMessage(caughtError));
              } finally {
                setSubmitting(false);
              }
            }}
          >
            <div className={cn('rounded-lg border px-4 py-3 text-sm leading-6', surface(theme))}>
              This creates a separate Hub and makes {email} the Owner. Do this only if you are starting a new Hub.
            </div>
            <input value={name} onChange={(event) => setName(event.target.value)} placeholder="New Hub name" className={cn('h-12 rounded-lg border bg-transparent px-4 outline-none', subtleButton(theme))} />
            <div className="grid grid-cols-2 gap-3">
              <label className="text-xs font-semibold">Country<select value={countryCode} onChange={(event) => { const country = event.target.value; setCountryCode(country); const defaults: Record<string, [string, string]> = { US: ['USD', 'MM/DD/YYYY'], PH: ['PHP', 'MM/DD/YYYY'], CA: ['CAD', 'YYYY-MM-DD'], AU: ['AUD', 'DD/MM/YYYY'], GB: ['GBP', 'DD/MM/YYYY'] }; const next = defaults[country]; if (next) { setCurrencyCode(next[0]); setDateFormat(next[1]); } }} className={cn('mt-1 h-11 w-full rounded-lg border bg-transparent px-3', subtleButton(theme))}><option value="US">United States</option><option value="PH">Philippines</option><option value="CA">Canada</option><option value="AU">Australia</option><option value="GB">United Kingdom</option><option value="OTHER">Other</option></select></label>
              <label className="text-xs font-semibold">Currency<input value={currencyCode} onChange={(event) => setCurrencyCode(event.target.value.toUpperCase().slice(0, 3))} className={cn('mt-1 h-11 w-full rounded-lg border bg-transparent px-3', subtleButton(theme))} /></label>
              <label className="col-span-2 text-xs font-semibold">Time zone<input value={timezone} onChange={(event) => setTimezone(event.target.value)} className={cn('mt-1 h-11 w-full rounded-lg border bg-transparent px-3', subtleButton(theme))} /></label>
              <label className="text-xs font-semibold">Date format<select value={dateFormat} onChange={(event) => setDateFormat(event.target.value)} className={cn('mt-1 h-11 w-full rounded-lg border bg-transparent px-3', subtleButton(theme))}><option>MM/DD/YYYY</option><option>DD/MM/YYYY</option><option>YYYY-MM-DD</option></select></label>
              <label className="text-xs font-semibold">Preparation Frequency<select value={payrollFrequency} onChange={(event) => setPayrollFrequency(event.target.value)} className={cn('mt-1 h-11 w-full rounded-lg border bg-transparent px-3', subtleButton(theme))}><option value="weekly">Weekly</option><option value="biweekly">Bi-weekly</option><option value="semimonthly">Semi-monthly</option><option value="monthly">Monthly</option></select></label>
              <label className="col-span-2 text-xs font-semibold">First day of week<select value={firstDayOfWeek} onChange={(event) => setFirstDayOfWeek(Number(event.target.value))} className={cn('mt-1 h-11 w-full rounded-lg border bg-transparent px-3', subtleButton(theme))}><option value={0}>Sunday</option><option value={1}>Monday</option><option value={6}>Saturday</option></select></label>
            </div>
            <button disabled={submitting || !name.trim()} className="inline-flex h-12 items-center justify-center gap-2 rounded-lg bg-[var(--accent-strong)] px-4 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50">
              {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
              Create new Hub as Owner
            </button>
            <button type="button" onClick={() => setCreatingHub(false)} className={cn('inline-flex h-11 items-center justify-center rounded-lg border px-4 text-sm font-semibold', subtleButton(theme))}>
              Back to sign-in options
            </button>
            {error && <p className="text-sm font-semibold text-[#B91C1C]">{error}</p>}
          </form>
        )}
      </div>
    </CenteredScreen>
  );
}

function HubSetupModal({ theme, email, onCreate, onClose }: { theme: 'light' | 'dark'; email: string; onCreate: (setup: HubSetup) => Promise<void>; onClose: () => void }) {
  const [name, setName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [countryCode, setCountryCode] = useState('US');
  const [currencyCode, setCurrencyCode] = useState('USD');
  const [timezone, setTimezone] = useState(Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC');
  const [dateFormat, setDateFormat] = useState('MM/DD/YYYY');
  const [payrollFrequency, setPayrollFrequency] = useState('biweekly');
  const [firstDayOfWeek, setFirstDayOfWeek] = useState(0);

  return (
    <ModalShell title="Create a new Hub" theme={theme} onClose={onClose} wide>
      <form
        className="grid gap-4"
        onSubmit={async (event) => {
          event.preventDefault();
          if (!name.trim()) return;
          setSubmitting(true);
          setError('');
          try {
            await onCreate({ name: name.trim(), countryCode, currencyCode, locale: navigator.language || 'en-US', timezone, dateFormat, payrollFrequency, firstDayOfWeek });
          } catch (caughtError) {
            setError(getErrorMessage(caughtError));
            setSubmitting(false);
          }
        }}
      >
        <div className={cn('rounded-lg border px-4 py-3 text-sm leading-6', surface(theme))}>
          This creates a separate Hub owned by <strong>{email}</strong>. Your roles and access in existing Hubs will not change.
        </div>
        <label className="text-sm font-semibold">
          Hub name
          <input autoFocus value={name} onChange={(event) => setName(event.target.value)} placeholder="New Hub name" className={cn('mt-1 h-11 w-full rounded-lg border bg-transparent px-3 outline-none', subtleButton(theme))} />
        </label>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="text-xs font-semibold">Country<select value={countryCode} onChange={(event) => { const country = event.target.value; setCountryCode(country); const defaults: Record<string, [string, string]> = { US: ['USD', 'MM/DD/YYYY'], PH: ['PHP', 'MM/DD/YYYY'], CA: ['CAD', 'YYYY-MM-DD'], AU: ['AUD', 'DD/MM/YYYY'], GB: ['GBP', 'DD/MM/YYYY'] }; const next = defaults[country]; if (next) { setCurrencyCode(next[0]); setDateFormat(next[1]); } }} className={cn('mt-1 h-11 w-full rounded-lg border bg-transparent px-3', subtleButton(theme))}><option value="US">United States</option><option value="PH">Philippines</option><option value="CA">Canada</option><option value="AU">Australia</option><option value="GB">United Kingdom</option><option value="OTHER">Other</option></select></label>
          <label className="text-xs font-semibold">Currency<input value={currencyCode} onChange={(event) => setCurrencyCode(event.target.value.toUpperCase().slice(0, 3))} className={cn('mt-1 h-11 w-full rounded-lg border bg-transparent px-3', subtleButton(theme))} /></label>
          <label className="text-xs font-semibold sm:col-span-2">Time zone<input value={timezone} onChange={(event) => setTimezone(event.target.value)} className={cn('mt-1 h-11 w-full rounded-lg border bg-transparent px-3', subtleButton(theme))} /></label>
          <label className="text-xs font-semibold">Date format<select value={dateFormat} onChange={(event) => setDateFormat(event.target.value)} className={cn('mt-1 h-11 w-full rounded-lg border bg-transparent px-3', subtleButton(theme))}><option>MM/DD/YYYY</option><option>DD/MM/YYYY</option><option>YYYY-MM-DD</option></select></label>
          <label className="text-xs font-semibold">Preparation Frequency<select value={payrollFrequency} onChange={(event) => setPayrollFrequency(event.target.value)} className={cn('mt-1 h-11 w-full rounded-lg border bg-transparent px-3', subtleButton(theme))}><option value="weekly">Weekly</option><option value="biweekly">Bi-weekly</option><option value="semimonthly">Semi-monthly</option><option value="monthly">Monthly</option></select></label>
          <label className="text-xs font-semibold sm:col-span-2">First day of week<select value={firstDayOfWeek} onChange={(event) => setFirstDayOfWeek(Number(event.target.value))} className={cn('mt-1 h-11 w-full rounded-lg border bg-transparent px-3', subtleButton(theme))}><option value={0}>Sunday</option><option value={1}>Monday</option><option value={6}>Saturday</option></select></label>
        </div>
        {error && <p className="text-sm font-semibold text-[#B91C1C]">{error}</p>}
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className={cn('h-10 rounded-lg border px-4 text-sm font-semibold', subtleButton(theme))}>Cancel</button>
          <button disabled={submitting || !name.trim()} className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-[var(--accent-strong)] px-4 text-sm font-semibold text-white disabled:opacity-50">{submitting && <Loader2 className="h-4 w-4 animate-spin" />}Create Hub</button>
        </div>
      </form>
    </ModalShell>
  );
}

function SetupScreen({ theme, setTheme }: { theme: 'light' | 'dark'; setTheme: (theme: 'light' | 'dark') => void }) {
  return (
    <CenteredScreen theme={theme} setTheme={setTheme}>
      <div className="mx-auto max-w-xl text-center">
        <h1 className="text-3xl font-bold tracking-tight">Connect Supabase</h1>
        <p className={cn('mt-3 text-sm leading-6', muted(theme))}>
          Add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` to your environment, then restart the app.
        </p>
      </div>
    </CenteredScreen>
  );
}

function LoadingScreen({ theme }: { theme: 'light' | 'dark' }) {
  return (
    <div className={cn('relative flex h-dvh items-center justify-center overflow-hidden', theme === 'dark' ? 'bg-[#0C0B10] text-[#FAF9FC]' : 'bg-[#F5F4F7] text-[#17151D]')}>
      <AmbientMotifs theme={theme} />
      <Loader2 className="relative z-10 h-6 w-6 animate-spin text-[var(--accent-strong)]" />
    </div>
  );
}

function InviteAcceptScreen({
  theme,
  email,
  error,
  onUseInvitedEmail,
  onClear,
}: {
  theme: 'light' | 'dark';
  email: string;
  error: string;
  onUseInvitedEmail: () => Promise<void>;
  onClear: () => void;
}) {
  const emailMismatch = error.toLowerCase().includes('different email');

  return (
    <div className={cn('relative grid h-dvh overflow-hidden p-4', theme === 'dark' ? 'bg-[#0C0B10] text-[#FAF9FC]' : 'bg-[#F5F4F7] text-[#17151D]')}>
      <AmbientMotifs theme={theme} />
      <div className="mx-auto max-w-md place-self-center text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-[var(--accent-strong)] text-white shadow-lg shadow-[var(--accent-strong)]/20">
          {error ? <X className="h-6 w-6" /> : <Loader2 className="h-6 w-6 animate-spin" />}
        </div>
        <h1 className="mt-6 text-3xl font-bold tracking-tight">{error ? 'Invite could not be accepted' : 'Accepting invite'}</h1>
        <p className={cn('mt-3 text-sm leading-6', muted(theme))}>
          {error
            ? emailMismatch
              ? `You are currently signed in as ${email}. This invite belongs to another email address.`
              : 'This invite could not be completed. Ask the hub Owner or admin to send a fresh invite link.'
            : `Signed in as ${email}. Adding you to the invited hub...`}
        </p>
        {error && <p className="mt-4 rounded-lg border border-[#FCA5A5] bg-[#FEF2F2] px-4 py-3 text-left text-sm font-semibold text-[#B91C1C]">{error}</p>}
        {error && (
          <div className="mt-4 grid gap-2">
            {emailMismatch && (
              <button onClick={() => void onUseInvitedEmail()} className="inline-flex h-11 items-center justify-center rounded-lg bg-[var(--accent-strong)] px-4 text-sm font-semibold text-white">
                Sign in with invited email
              </button>
            )}
            <button onClick={onClear} className={cn('inline-flex h-11 items-center justify-center rounded-lg border px-4 text-sm font-semibold', subtleButton(theme))}>
              Clear invite and continue
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function CenteredScreen({ theme, setTheme, children }: { theme: 'light' | 'dark'; setTheme: (theme: 'light' | 'dark') => void; children: ReactNode }) {
  return (
    <div className={cn('relative grid h-dvh overflow-hidden p-4', theme === 'dark' ? 'bg-[#0C0B10] text-[#FAF9FC]' : 'bg-[#F5F4F7] text-[#17151D]')}>
      <AmbientMotifs theme={theme} />
      <button onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} className={cn('absolute right-5 top-5 z-10 rounded-lg border p-2', subtleButton(theme))}>
        {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
      </button>
      <div className="relative z-10 place-self-center">{children}</div>
    </div>
  );
}

function EmptyState({ theme, icon: Icon, title, body, actionLabel, onAction }: { theme: 'light' | 'dark'; icon: LucideIcon; title: string; body: string; actionLabel?: string; onAction?: () => void }) {
  return (
    <div className={cn('flex min-h-[320px] flex-col items-center justify-center rounded-lg border p-8 text-center', surface(theme))}>
      <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[var(--accent-soft)] text-[var(--accent-strong)]">
        <Icon className="h-6 w-6" />
      </div>
      <h3 className="mt-5 text-xl font-bold">{title}</h3>
      <p className={cn('mt-2 max-w-md text-sm leading-6', muted(theme))}>{body}</p>
      {actionLabel && onAction && (
        <button onClick={onAction} className="mt-5 inline-flex h-10 items-center justify-center rounded-lg bg-[var(--accent-strong)] px-4 text-sm font-semibold text-white">
          {actionLabel}
        </button>
      )}
    </div>
  );
}

function NavButton({ icon: Icon, label, active, onClick, theme }: { icon: LucideIcon; label: string; active: boolean; onClick: () => void; theme: 'light' | 'dark' }) {
  return (
    <button
      onClick={onClick}
      className={cn('flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-semibold transition', active ? 'bg-[var(--accent-soft)] text-[var(--accent-strong)] shadow-sm' : theme === 'dark' ? 'text-[#D8D4DE] hover:bg-white/10 hover:text-white' : 'text-[#5E5767] hover:bg-[#F0EDF3] hover:text-[#17151D]')}
    >
      <Icon className="h-4 w-4" />
      {label}
    </button>
  );
}

function AccountMenuButton({ icon: Icon, label, rooming: RoomingIcon, active = false, onClick }: { icon: LucideIcon; label: string; rooming?: LucideIcon; active?: boolean; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className={cn('flex h-10 w-full items-center gap-3 rounded-lg px-3 text-left text-sm font-semibold transition hover:bg-white/10', active && 'bg-white/10')}>
      <Icon className="h-4 w-4 shrink-0" />
      <span className="min-w-0 flex-1 truncate">{label}</span>
      {RoomingIcon && <RoomingIcon className={cn('h-4 w-4 shrink-0 transition-transform', active && 'rotate-90')} />}
    </button>
  );
}


function formatEmailProviderLabel(provider: string) {
  if (provider === 'gmail') return 'Gmail';
  if (provider === 'outlook') return 'Outlook';
  if (provider === 'microsoft365') return 'Microsoft 365';
  return 'Connected mailbox';
}

function ConnectedEmailAccountsSection({ accounts, loading, notice, theme, fallbackAddress, onConnect, onDefault, onDisconnect }: { accounts: UserEmailAccount[]; loading: boolean; notice: string; theme: 'light' | 'dark'; fallbackAddress: string; onConnect: (provider: string) => void; onDefault: (accountId: string) => void; onDisconnect: (accountId: string) => void }) {
  const connectedAccounts = accounts.filter((account) => account.is_connected);
  return <section className={cn('mt-6 border-t pt-5', theme === 'dark' ? 'border-white/10' : 'border-[#E7E3EA]')}>
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div><h3 className="font-bold">Connected Email Accounts</h3><p className={cn('mt-1 text-sm', muted(theme))}>Connect Gmail, Google Workspace, Outlook, or Microsoft 365 so TriCord can send email from your own mailbox and keep the conversation attached to the discussion.</p></div>
      {loading && <Loader2 className="h-4 w-4 animate-spin" />}
    </div>
    <div className="mt-4 grid gap-3 md:grid-cols-2">
      {connectedAccounts.map((account) => <div key={account.id} className={cn('rounded-lg border p-4', surface(theme))}>
        <div className="flex items-start justify-between gap-3"><div><p className="font-bold">{formatEmailProviderLabel(account.provider)}</p><p className={cn('mt-1 text-sm', muted(theme))}>{account.email_address}</p></div><StatusBadge label={account.is_default ? 'Default' : 'Connected'} tone={account.is_default ? 'accent' : 'success'} /></div>
        {account.last_error && <p className="mt-3 rounded-md bg-[#FEF2F2] px-3 py-2 text-xs font-semibold text-[#B91C1C]">{account.last_error}</p>}
        <div className="mt-4 flex flex-wrap gap-2">
          {!account.is_default && <button type="button" onClick={() => onDefault(account.id)} className={cn('h-9 rounded-lg border px-3 text-sm font-semibold', subtleButton(theme))}>Make Default</button>}
          <button type="button" onClick={() => onConnect(account.provider)} className={cn('h-9 rounded-lg border px-3 text-sm font-semibold', subtleButton(theme))}>Reconnect</button>
          <button type="button" onClick={() => onDisconnect(account.id)} className={cn('h-9 rounded-lg border px-3 text-sm font-semibold text-[#B91C1C]', subtleButton(theme))}>Disconnect</button>
        </div>
      </div>)}
      <div className={cn('rounded-lg border p-4', surface(theme))}>
        <div className="flex items-start justify-between gap-3"><div><p className="font-bold">Account email</p><p className={cn('mt-1 text-sm', muted(theme))}>{fallbackAddress}</p></div><StatusBadge label="Sign-in identity" tone="neutral" /></div>
        <p className={cn('mt-3 text-sm leading-6', muted(theme))}>This is your TriCord sign-in email. Connect Gmail or Microsoft 365 above when you want outbound email to send from an authorized mailbox.</p>
      </div>
    </div>
    {notice && <p className={cn('mt-3 rounded-lg border px-3 py-2 text-sm font-semibold', surface(theme))}>{notice}</p>}
  </section>;
}

function StatusBadge({ label, tone }: { label: string; tone: 'accent' | 'success' | 'neutral' }) {
  const className = tone === 'success' ? 'bg-[#DCFCE7] text-[#166534]' : tone === 'accent' ? 'bg-[var(--accent-soft)] text-[var(--accent-strong)]' : 'bg-black/5 text-current';
  return <span className={cn('inline-flex rounded-full px-2.5 py-1 text-xs font-semibold', className)}>{label}</span>;
}

function NotificationToggle({ theme, title, body, checked, onChange }: { theme: 'light' | 'dark'; title: string; body: string; checked: boolean; onChange: (checked: boolean) => void }) {
  return (
    <label className={cn('flex items-start justify-between gap-4 rounded-lg border p-3', subtleButton(theme))}>
      <span className="min-w-0">
        <span className="block text-sm font-bold">{title}</span>
        <span className={cn('mt-1 block text-xs leading-5', muted(theme))}>{body}</span>
      </span>
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} className="mt-1 h-4 w-4 shrink-0 accent-[var(--accent-strong)]" />
    </label>
  );
}

function HelpTopic({ title, body, theme }: { title: string; body: string; theme: 'light' | 'dark' }) {
  return (
    <section className={cn('rounded-lg border p-4', surface(theme))}>
      <p className="font-bold">{title}</p>
      <p className={cn('mt-2 text-sm leading-6', muted(theme))}>{body}</p>
    </section>
  );
}

function StatusPill({ state }: { state: AppPost['state'] }) {
  const styles = {
    open: 'bg-[#DBEAFE] text-[#1D4ED8]',
    read_only: 'bg-[#F1F5F9] text-[#475569]',
    locked: 'bg-[#FEE2E2] text-[#B91C1C]',
    archived: 'bg-[#E5E7EB] text-[#374151]',
  };
  const labels: Record<AppPost['state'], string> = {
    open: 'Active',
    read_only: 'Read only',
    locked: 'Locked',
    archived: 'Archived',
  };
  return <span className={cn('rounded-full px-2.5 py-1 text-xs font-semibold', styles[state])}>{labels[state]}</span>;
}

function getProfileName(profile?: AppProfile, fallback = 'Hub member') {
  return profile?.nickname?.trim() || profile?.display_name?.trim() || fallback;
}

function getProfileFullName(profile?: AppProfile, fallback = 'Hub member') {
  return profile?.full_name?.trim() || profile?.display_name?.trim() || fallback;
}

function Avatar({ profile }: { profile?: AppProfile }) {
  const profileName = getProfileName(profile);
  if (profile?.avatar_url) {
    return <img src={profile.avatar_url} alt={profileName} className="h-9 w-9 rounded-lg object-cover" />;
  }
  return <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[var(--accent-soft)] text-sm font-bold text-[var(--accent-strong)]">{profileName.slice(0, 1).toUpperCase()}</div>;
}

async function fetchProfiles(userIds: string[]) {
  if (!supabase || userIds.length === 0) return [];

  const profileResult = await supabase
    .from('users')
    .select(PROFILE_SELECT)
    .in('id', userIds);

  if (!profileResult.error) return (profileResult.data ?? []) as AppProfile[];

  const missingProfileColumn = ['full_name', 'nickname'].some((column) => profileResult.error.message.includes(column));
  if (!missingProfileColumn) return [];

  const fallbackResult = await supabase
    .from('users')
    .select(BASIC_PROFILE_SELECT)
    .in('id', userIds);

  if (fallbackResult.error) return [];
  return (fallbackResult.data ?? []) as AppProfile[];
}

async function ensureProfile(session: Session) {
  if (!supabase) return;
  const email = session.user.email ?? '';
  const displayName = session.user.user_metadata?.full_name ?? email.split('@')[0] ?? 'Member';
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

  const { data: existingProfile } = await supabase
    .from('users')
    .select('id')
    .eq('id', session.user.id)
    .maybeSingle();

  if (existingProfile) {
    await supabase
      .from('users')
      .update({ email, timezone })
      .eq('id', session.user.id);
    return;
  }

  await supabase.from('users').insert({
    id: session.user.id,
    email,
    display_name: displayName,
    full_name: displayName,
    nickname: displayName,
    avatar_url: session.user.user_metadata?.avatar_url ?? null,
    timezone,
  });
}

async function createWorkspace(session: Session, setup: HubSetup): Promise<string> {
  if (!supabase) throw new Error('Supabase is not configured.');
  const email = session.user.email ?? '';
  const displayName = session.user.user_metadata?.full_name ?? email.split('@')[0] ?? 'Member';
  const { data, error } = await supabase.rpc('create_initial_workspace', {
    workspace_name: setup.name,
    profile_email: email,
    profile_display_name: displayName,
    profile_avatar_url: session.user.user_metadata?.avatar_url ?? null,
    profile_timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  });

  if (!error) {
    const workspaceId = String(data);
    await saveInitialWorkforceSettings(workspaceId, setup);
    return workspaceId;
  }

  const missingRpc = error.code === 'PGRST202' || error.message.toLowerCase().includes('schema cache');
  if (!missingRpc) throw error;

  const workspaceId = await createWorkspaceWithTableInserts(session, setup.name);
  await saveInitialWorkforceSettings(workspaceId, setup);
  return workspaceId;
}

async function createWorkspaceWithTableInserts(session: Session, workspaceName: string) {
  if (!supabase) throw new Error('Supabase is not configured.');
  await ensureProfile(session);

  const slug = `${slugify(workspaceName)}-${crypto.randomUUID().slice(0, 8)}`;
  const { data: workspace, error: workspaceError } = await supabase
    .from('workspaces')
    .insert({ name: workspaceName, slug, owner_id: session.user.id })
    .select('id')
    .single();

  if (workspaceError) throw workspaceError;

  const { error: membershipError } = await supabase
    .from('memberships')
    .insert({ workspace_id: workspace.id, user_id: session.user.id, role: 'owner' });

  if (membershipError) throw membershipError;

  const { error: spaceError } = await supabase.from('spaces').insert({
    workspace_id: workspace.id,
    name: 'General',
    slug: 'general',
    access: 'public',
    created_by: session.user.id,
  });

  if (spaceError) throw spaceError;
  return workspace.id as string;
}

async function saveInitialWorkforceSettings(workspaceId: string, setup: HubSetup) {
  if (!supabase || !workspaceId) return;
  const { error } = await supabase.from('workforce_settings').upsert({
    workspace_id: workspaceId, country_code: setup.countryCode, currency_code: setup.currencyCode,
    locale: setup.locale, timezone: setup.timezone, date_format: setup.dateFormat,
    payroll_frequency: setup.payrollFrequency, first_day_of_week: setup.firstDayOfWeek,
    updated_at: new Date().toISOString(),
  });
  if (error) throw error;
}

async function createSpace(workspaceId: string, _userId: string, name: string, access: SpaceAccess) {
  if (!supabase) throw new Error('Supabase is not configured.');
  const slug = `${slugify(name)}-${crypto.randomUUID().slice(0, 6)}`;
  const { data, error } = await supabase.rpc('create_room', {
    target_workspace_id: workspaceId,
    room_name: name,
    room_slug: slug,
    room_access: access,
  });

  if (error) throw error;
  return data as AppSpace;
}

async function deleteSpace(spaceId: string) {
  if (!supabase) throw new Error('Supabase is not configured.');
  const { data, error } = await supabase
    .from('spaces')
    .delete()
    .eq('id', spaceId)
    .select('id');

  if (error) throw error;
  if (!data?.length) throw new Error('You do not have permission to delete this room.');
}

async function renameSpace(spaceId: string, name: string) {
  if (!supabase) throw new Error('Supabase is not configured.');
  const { error } = await supabase.rpc('rename_room', {
    target_space_id: spaceId,
    new_name: name,
    new_slug: `${slugify(name)}-${crypto.randomUUID().slice(0, 6)}`,
  });
  if (error) throw error;
}

async function saveRoomOrder(userId: string, orderedSpaces: AppSpace[], currentPreferences: Record<string, RoomPreference>) {
  if (!supabase) throw new Error('Supabase is not configured.');
  const rows = orderedSpaces.map((space, position) => ({
    user_id: userId,
    space_id: space.id,
    position,
    pinned: Boolean(currentPreferences[space.id]?.pinned),
    updated_at: new Date().toISOString(),
  }));
  const { error } = await supabase.from('room_preferences').upsert(rows, { onConflict: 'user_id,space_id' });
  if (error) throw error;
  return Object.fromEntries(rows.map(({ space_id, position, pinned }) => [space_id, { space_id, position, pinned }])) as Record<string, RoomPreference>;
}

async function setRoomPinned(userId: string, space: AppSpace, pinned: boolean, currentPreferences: Record<string, RoomPreference>) {
  if (!supabase) throw new Error('Supabase is not configured.');
  const nextPreference: RoomPreference = {
    space_id: space.id,
    position: currentPreferences[space.id]?.position ?? Object.keys(currentPreferences).length,
    pinned,
  };
  const { error } = await supabase.from('room_preferences').upsert({
    user_id: userId,
    ...nextPreference,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'user_id,space_id' });
  if (error) throw error;
  return { ...currentPreferences, [space.id]: nextPreference };
}

async function createPost(workspaceId: string, spaceId: string, userId: string, title: string, body: string) {
  if (!supabase) return;
  const { error } = await supabase.from('posts').insert({
    workspace_id: workspaceId,
    space_id: spaceId,
    author_id: userId,
    title,
    body,
  });
  if (error) throw error;
}

async function updatePost(postId: string, input: { title: string; body: string; spaceId: string }) {
  if (!supabase) return;
  const { data, error } = await supabase
    .from('posts')
    .update({
      title: input.title,
      body: input.body,
      space_id: input.spaceId,
      last_activity_at: new Date().toISOString(),
    })
    .eq('id', postId)
    .select('id')
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error('The post was not updated. Your account may not have permission to edit it.');
}

async function deletePost(postId: string) {
  if (!supabase) return;
  const { data: attachmentRows } = await supabase
    .from('attachments')
    .select('bucket, object_path')
    .eq('post_id', postId);
  const { data, error } = await supabase.from('posts').delete().eq('id', postId).select('id').maybeSingle();
  if (error) throw error;
  if (!data) throw new Error('The post was not deleted. Apply the latest Supabase migration and confirm your account is the author, Owner, or admin.');
  const pathsByBucket = new Map<string, string[]>();
  (attachmentRows ?? []).forEach((attachment) => {
    if (attachment.bucket === 'external') return;
    pathsByBucket.set(attachment.bucket, [...(pathsByBucket.get(attachment.bucket) ?? []), attachment.object_path]);
  });
  await Promise.all([...pathsByBucket].map(([bucket, paths]) => supabase.storage.from(bucket).remove(paths)));
}

async function assignPost(postId: string, assigneeId: string) {
  if (!supabase) throw new Error('Supabase is not configured.');
  const { error } = await supabase.rpc('assign_post', {
    target_post_id: postId,
    target_user_id: assigneeId || null,
  });
  if (error) throw error;
}

async function setPostArchived(postId: string, archived: boolean) {
  if (!supabase) throw new Error('Supabase is not configured.');
  const { error } = await supabase.rpc('set_post_archived', {
    target_post_id: postId,
    should_archive: archived,
  });
  if (error) throw error;
}

async function createComment(post: AppPost, userId: string, body: string, isDecision: boolean, files: File[], externalAttachments: ExternalAttachmentDraft[], parentCommentId: string | null) {
  if (!supabase) return;
  const { data: comment, error } = await supabase
    .from('comments')
    .insert({
      workspace_id: post.workspace_id,
      post_id: post.id,
      author_id: userId,
      body,
      is_decision: isDecision,
      parent_comment_id: parentCommentId,
    })
    .select('id')
    .single();
  if (error) throw error;
  for (const file of files) {
    await uploadCommentAttachment(post, comment.id, userId, file);
  }
  for (const attachment of externalAttachments) {
    await createExternalCommentAttachment(post, comment.id, userId, attachment);
  }
}

async function forwardMessages(targetPosts: AppPost[], messages: ForwardableMessage[], userId: string) {
  if (!supabase) throw new Error('Supabase is not configured.');
  for (const targetPost of targetPosts) {
    for (const message of messages) {
      const { data: forwardedComment, error: commentError } = await supabase
        .from('comments')
        .insert({
          workspace_id: targetPost.workspace_id,
          post_id: targetPost.id,
          author_id: userId,
          body: message.body,
          is_decision: false,
        })
        .select('id')
        .single();
      if (commentError) throw commentError;

      for (const attachment of message.attachments) {
        const externalUrl = getExternalAttachmentUrl(attachment);
        const destinationPath = externalUrl
          ? attachment.object_path
          : `${targetPost.workspace_id}/${userId}/${forwardedComment.id}/${crypto.randomUUID()}-${sanitizeFilename(attachment.filename)}`;
        if (!externalUrl) {
          const { error: copyError } = await supabase.storage.from(attachment.bucket).copy(attachment.object_path, destinationPath);
          if (copyError) throw copyError;
        }
        const { error: attachmentError } = await supabase.from('attachments').insert({
          workspace_id: targetPost.workspace_id,
          post_id: targetPost.id,
          comment_id: forwardedComment.id,
          uploaded_by: userId,
          bucket: attachment.bucket,
          object_path: destinationPath,
          filename: attachment.filename,
          mime_type: attachment.mime_type,
          byte_size: attachment.byte_size,
          metadata: attachment.metadata ?? {},
        });
        if (attachmentError) {
          if (!externalUrl) await supabase.storage.from(attachment.bucket).remove([destinationPath]);
          throw attachmentError;
        }
      }
    }
  }
}

async function toggleReaction(post: AppPost, commentId: string | null, userId: string, emoji: string) {
  if (!supabase) throw new Error('Supabase is not configured.');
  let query = supabase
    .from('reactions')
    .select('id')
    .eq('user_id', userId)
    .eq('emoji', emoji);
  query = commentId
    ? query.is('post_id', null).eq('comment_id', commentId)
    : query.eq('post_id', post.id).is('comment_id', null);
  const { data: existing, error: lookupError } = await query.limit(1).maybeSingle();
  if (lookupError) throw lookupError;

  if (existing) {
    const { error } = await supabase.from('reactions').delete().eq('id', existing.id);
    if (error) throw error;
    return;
  }

  const { error } = await supabase.from('reactions').insert({
    workspace_id: post.workspace_id,
    post_id: commentId ? null : post.id,
    comment_id: commentId,
    user_id: userId,
    emoji,
  });
  if (error) throw error;
}

async function updateComment(commentId: string, body: string) {
  if (!supabase) throw new Error('Supabase is not configured.');
  const { data, error } = await supabase.from('comments').update({ body, updated_at: new Date().toISOString() }).eq('id', commentId).select('id').maybeSingle();
  if (error) throw error;
  if (!data) throw new Error('This message could not be edited.');
}

async function deleteComment(commentId: string) {
  if (!supabase) throw new Error('Supabase is not configured.');
  const { data: attachmentRows } = await supabase.from('attachments').select('bucket, object_path').eq('comment_id', commentId);
  const { data, error } = await supabase.from('comments').delete().eq('id', commentId).select('id').maybeSingle();
  if (error) throw error;
  if (!data) throw new Error('This message could not be deleted.');
  const pathsByBucket = new Map<string, string[]>();
  (attachmentRows ?? []).forEach((attachment) => {
    if (attachment.bucket === 'external') return;
    pathsByBucket.set(attachment.bucket, [...(pathsByBucket.get(attachment.bucket) ?? []), attachment.object_path]);
  });
  await Promise.all([...pathsByBucket].map(([bucket, paths]) => supabase.storage.from(bucket).remove(paths)));
}

async function uploadCommentAttachment(post: AppPost, commentId: string, userId: string, file: File) {
  if (!supabase) throw new Error('Supabase is not configured.');
  const validationError = validateUploadFile(file);
  if (validationError) throw new Error(`${file.name}: ${validationError}`);

  const safeName = sanitizeFilename(file.name);
  const objectPath = `${post.workspace_id}/${userId}/${commentId}/${crypto.randomUUID()}-${safeName}`;
  const { error: uploadError } = await supabase.storage.from('workspace-files').upload(objectPath, file, {
    contentType: file.type || 'application/octet-stream',
    upsert: false,
  });
  if (uploadError) throw uploadError;

  const { error: attachmentError } = await supabase.from('attachments').insert({
    workspace_id: post.workspace_id,
    post_id: post.id,
    comment_id: commentId,
    uploaded_by: userId,
    bucket: 'workspace-files',
    object_path: objectPath,
    filename: file.name,
    mime_type: file.type || 'application/octet-stream',
    byte_size: file.size,
  });

  if (attachmentError) {
    await supabase.storage.from('workspace-files').remove([objectPath]);
    throw attachmentError;
  }
}

async function createExternalCommentAttachment(post: AppPost, commentId: string, userId: string, attachment: ExternalAttachmentDraft) {
  if (!supabase) throw new Error('Supabase is not configured.');
  const url = normalizeExternalAttachmentUrl(attachment);
  if (!url) throw new Error(getExternalAttachmentValidationMessage(attachment.provider));
  const filename = attachment.title.trim() || getExternalAttachmentDefaultTitle(attachment.provider, url);
  const { error } = await supabase.from('attachments').insert({
    workspace_id: post.workspace_id,
    post_id: post.id,
    comment_id: commentId,
    uploaded_by: userId,
    bucket: 'external',
    object_path: url,
    filename,
    mime_type: attachment.mimeType || 'text/uri-list',
    byte_size: Math.max(1, Math.round(attachment.sizeBytes ?? 1)),
    metadata: {
      external_url: url,
      provider: attachment.provider,
      source: attachment.provider,
      title: filename,
      icon_url: attachment.iconUrl ?? null,
    },
  });
  if (error) throw error;
}

async function uploadAvatar(userId: string, file: File) {
  if (!supabase) throw new Error('Supabase is not configured.');
  if (!file.type.startsWith('image/')) throw new Error('Choose an image file for your profile photo.');
  if (file.size > 10 * 1024 * 1024) throw new Error('Profile photos must be 10 MB or smaller.');

  const extension = file.name.split('.').pop()?.toLowerCase().replace(/[^a-z0-9]/g, '') || 'jpg';
  const objectPath = `${userId}/avatar.${extension}`;
  const { error } = await supabase.storage.from('avatars').upload(objectPath, file, {
    contentType: file.type,
    cacheControl: '3600',
    upsert: true,
  });
  if (error) throw error;

  const { data } = supabase.storage.from('avatars').getPublicUrl(objectPath);
  return `${data.publicUrl}?v=${Date.now()}`;
}

async function createTask(
  workspaceId: string,
  userId: string,
  input: { title: string; description: string; projectName: string; priority: TaskPriority; tags: string[]; assigneeId: string; dueAt: string },
) {
  if (!supabase) return;
  const { error } = await supabase.from('tasks').insert({
    workspace_id: workspaceId,
    title: input.title,
    description: input.description || null,
    project_name: input.projectName || null,
    priority: input.priority,
    tags: input.tags,
    assignee_id: input.assigneeId || null,
    created_by: userId,
    status: 'todo',
    due_at: input.dueAt || null,
  });
  if (error) throw error;
}

async function updateTask(
  taskId: string,
  input: { title: string; description: string; projectName: string; priority: TaskPriority; tags: string[]; assigneeId: string; dueAt: string },
) {
  if (!supabase) return;
  const { data, error } = await supabase
    .from('tasks')
    .update({
      title: input.title,
      description: input.description || null,
      project_name: input.projectName || null,
      priority: input.priority,
      tags: input.tags,
      assignee_id: input.assigneeId || null,
      due_at: input.dueAt || null,
    })
    .eq('id', taskId)
    .select('id')
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error('The task was not updated. Your account may not have permission to edit it.');
}

async function updateTaskStatus(taskId: string, status: TaskStatus) {
  if (!supabase) return;
  const { data, error } = await supabase.from('tasks').update({ status }).eq('id', taskId).select('id').maybeSingle();
  if (error) throw error;
  if (!data) throw new Error('The task status was not updated. Your account may not have permission to edit it.');
}

async function deleteTask(taskId: string) {
  if (!supabase) return;
  const { data, error } = await supabase.from('tasks').delete().eq('id', taskId).select('id').maybeSingle();
  if (error) throw error;
  if (!data) throw new Error('The task was not deleted. Apply the latest Supabase migration and confirm your account is the creator, assignee, Owner, or admin.');
}

async function archiveTask(taskId: string) {
  if (!supabase) throw new Error('Supabase is not configured.');
  const { error } = await supabase.rpc('archive_completed_task', { target_task_id: taskId });
  if (error) throw error;
}

async function createKnowledgeArticle(workspaceId: string, userId: string, input: { category: KnowledgeCategory; title: string; summary: string; content: string }) {
  if (!supabase) throw new Error('Supabase is not configured.');
  const { error } = await supabase.from('knowledge_articles').insert({ workspace_id: workspaceId, created_by: userId, category: input.category, title: input.title, summary: input.summary || null, content: input.content });
  if (error) throw error;
}

async function updateKnowledgeArticle(articleId: string, input: { category: KnowledgeCategory; title: string; summary: string; content: string }) {
  if (!supabase) throw new Error('Supabase is not configured.');
  const { data, error } = await supabase.from('knowledge_articles').update({ category: input.category, title: input.title, summary: input.summary || null, content: input.content }).eq('id', articleId).select('id').maybeSingle();
  if (error) throw error;
  if (!data) throw new Error('This article could not be updated.');
}

async function deleteKnowledgeArticle(articleId: string) {
  if (!supabase) throw new Error('Supabase is not configured.');
  const { data, error } = await supabase.from('knowledge_articles').delete().eq('id', articleId).select('id').maybeSingle();
  if (error) throw error;
  if (!data) throw new Error('This article could not be deleted.');
}

async function updateMemberRole(membershipId: string, role: WorkspaceRole) {
  if (!supabase) throw new Error('Supabase is not configured.');
  const { error } = await supabase.rpc('update_member_role', { target_membership_id: membershipId, new_role: role });
  if (error) throw error;
}

async function updateProfile(
  userId: string,
  input: { fullName: string; nickname: string; avatarUrl: string; phone: string; address: string; timezone: string; bio: string },
) {
  if (!supabase) return;
  const { data, error: basicError } = await supabase
    .from('users')
    .update({
      display_name: input.nickname,
      full_name: input.fullName,
      nickname: input.nickname,
      avatar_url: input.avatarUrl || null,
      timezone: input.timezone || null,
    })
    .eq('id', userId)
    .select('id')
    .maybeSingle();
  if (basicError) throw basicError;
  if (!data) throw new Error('Your profile was not updated. Please sign in again and retry.');

  const { error: detailsError } = await supabase.rpc('save_own_private_profile', {
    new_phone: input.phone,
    new_address: input.address,
    new_bio: input.bio,
  });
  if (detailsError) throw detailsError;
}

async function createWorkspaceInvitation(workspaceId: string, email: string, role: WorkspaceRole) {
  if (!supabase) throw new Error('Supabase is not configured.');
  const { data, error } = await supabase.rpc('create_workspace_invitation', {
    target_workspace_id: workspaceId,
    invitee_email: email,
    invitee_role: role,
  });

  if (error) throw error;

  const url = new URL(getAppUrl(), window.location.origin);
  url.hash = '';
  url.search = '';
  url.searchParams.set('invite', String(data));
  const { error: emailError } = await supabase.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: url.toString(),
      shouldCreateUser: true,
    },
  });
  if (emailError) throw new Error(`The invitation was created, but the email could not be sent: ${emailError.message}`);
  return url.toString();
}

async function acceptWorkspaceInvitation(session: Session, inviteToken: string) {
  if (!supabase) throw new Error('Supabase is not configured.');
  const email = session.user.email ?? '';
  const displayName = session.user.user_metadata?.full_name ?? email.split('@')[0] ?? 'Member';
  const { data, error } = await supabase.rpc('accept_workspace_invitation', {
    invite_token: inviteToken,
    profile_email: email,
    profile_display_name: displayName,
    profile_avatar_url: session.user.user_metadata?.avatar_url ?? null,
    profile_timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  });

  if (error) throw error;
  return String(data);
}

async function getFunctionErrorMessage(error: unknown) {
  if (typeof error === 'object' && error && 'context' in error) {
    const context = (error as { context?: Response }).context;
    if (context instanceof Response) {
      try {
        const payload = await context.clone().json() as { error?: string };
        if (payload.error) return payload.error;
      } catch {
        try {
          const text = await context.clone().text();
          if (text) return text;
        } catch {
          // Fall through to generic error handling.
        }
      }
    }
  }
  return getErrorMessage(error);
}

function loadGoogleScript(src: string) {
  const existing = googleScriptPromises.get(src);
  if (existing) return existing;
  const promise = new Promise<void>((resolve, reject) => {
    const loaded = document.querySelector(`script[src="${src}"]`);
    if (loaded) {
      resolve();
      return;
    }
    const script = document.createElement('script');
    script.src = src;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Google Drive could not be loaded. Please try again.'));
    document.head.appendChild(script);
  });
  googleScriptPromises.set(src, promise);
  return promise;
}

async function loadGooglePickerApi() {
  await Promise.all([
    loadGoogleScript('https://accounts.google.com/gsi/client'),
    loadGoogleScript('https://apis.google.com/js/api.js'),
  ]);
  const api = window as Window & { gapi?: { load: (name: string, options: { callback: () => void; onerror: () => void }) => void } };
  await new Promise<void>((resolve, reject) => {
    api.gapi?.load('picker', { callback: resolve, onerror: () => reject(new Error('Google Drive picker could not be loaded.')) });
  });
}

async function requestGoogleDriveAccessToken() {
  if (!GOOGLE_DRIVE_CLIENT_ID) throw new Error('Google Drive browsing is not connected yet.');
  const googleWindow = window as Window & { google?: { accounts?: { oauth2?: { initTokenClient: (config: Record<string, unknown>) => { requestAccessToken: (options?: Record<string, string>) => void } } } } };
  const oauth = googleWindow.google?.accounts?.oauth2;
  if (!oauth) throw new Error('Google sign-in could not be loaded. Please try again.');
  return new Promise<string>((resolve, reject) => {
    const tokenClient = oauth.initTokenClient({
      client_id: GOOGLE_DRIVE_CLIENT_ID,
      scope: GOOGLE_DRIVE_PICKER_SCOPE,
      callback: (response: { access_token?: string; error?: string }) => {
        if (response.error) reject(new Error(response.error));
        else if (response.access_token) resolve(response.access_token);
        else reject(new Error('Google Drive did not return access.'));
      },
      error_callback: () => reject(new Error('Google Drive authorization was cancelled.')),
    });
    tokenClient.requestAccessToken({ prompt: 'consent' });
  });
}

async function openGoogleDrivePicker() {
  if (!GOOGLE_DRIVE_API_KEY || !GOOGLE_DRIVE_CLIENT_ID) throw new Error('Google Drive browsing is not connected yet.');
  await loadGooglePickerApi();
  const accessToken = await requestGoogleDriveAccessToken();
  const googleWindow = window as Window & { google?: { picker?: Record<string, any> } };
  const picker = googleWindow.google?.picker;
  if (!picker) throw new Error('Google Drive picker could not be opened.');

  return new Promise<ExternalAttachmentDraft[]>((resolve, reject) => {
    try {
      const docsView = new picker.DocsView(picker.ViewId.DOCS)
        .setIncludeFolders(true)
        .setSelectFolderEnabled(false);
      const drivePicker = new picker.PickerBuilder()
        .addView(docsView)
        .enableFeature(picker.Feature.MULTISELECT_ENABLED)
        .setDeveloperKey(GOOGLE_DRIVE_API_KEY)
        .setOAuthToken(accessToken)
        .setCallback((data: Record<string, any>) => {
          const action = data[picker.Response.ACTION];
          if (action === picker.Action.PICKED) {
            const docs = (data[picker.Response.DOCUMENTS] ?? []) as Array<Record<string, any>>;
            resolve(docs.map((doc) => {
              const url = String(doc[picker.Document.URL] ?? doc.url ?? '');
              const title = String(doc[picker.Document.NAME] ?? doc.name ?? getGoogleDriveAttachmentTitle(url));
              return {
                provider: 'google_drive' as const,
                url,
                title,
                mimeType: String(doc[picker.Document.MIME_TYPE] ?? doc.mimeType ?? 'text/uri-list'),
                iconUrl: typeof doc[picker.Document.ICON_URL] === 'string' ? doc[picker.Document.ICON_URL] : undefined,
                sizeBytes: Number(doc.sizeBytes ?? 1) || 1,
              };
            }).filter((attachment) => normalizeGoogleDriveUrl(attachment.url)));
          } else if (action === picker.Action.CANCEL) {
            resolve([]);
          }
        })
        .build();
      drivePicker.setVisible(true);
    } catch (caughtError) {
      reject(caughtError instanceof Error ? caughtError : new Error('Google Drive picker could not be opened.'));
    }
  });
}

function getImageExtension(mimeType: string) {
  const subtype = mimeType.split('/')[1]?.toLowerCase().replace(/[^a-z0-9]/g, '') || 'png';
  if (subtype === 'jpeg') return 'jpg';
  if (subtype === 'svgxml') return 'svg';
  return subtype || 'png';
}

function validateUploadFile(file: File) {
  if (file.size <= 0) return 'The file is empty.';
  if (file.size > MAX_DIRECT_UPLOAD_BYTES) return `This file is too large to add to TriCord. The maximum single-file upload is ${formatFileSize(MAX_DIRECT_UPLOAD_BYTES)}. Share larger files with a cloud storage link from Google Drive, Dropbox, OneDrive, or another secure file-sharing service.`;
  const extension = file.name.split('.').pop()?.toLowerCase() ?? '';
  if (BLOCKED_FILE_EXTENSIONS.has(extension)) return 'This file type is blocked for security.';
  if ((file.type || '').startsWith('application/x-msdownload')) return 'Executable files are blocked for security.';
  return '';
}

function getExternalAttachmentUrl(attachment: AppAttachment) {
  const value = attachment.metadata?.external_url;
  return typeof value === 'string' && /^https:\/\//i.test(value) ? value : '';
}

function getAttachmentProviderLabel(attachment: AppAttachment) {
  const value = attachment.metadata?.provider ?? attachment.metadata?.source;
  if (value === 'google_drive') return 'Google Drive';
  if (value === 'gmail') return 'Gmail';
  if (value === 'outlook') return 'Outlook';
  return 'External';
}

function normalizeGoogleDriveUrl(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return '';
  try {
    const url = new URL(trimmed);
    if (url.protocol !== 'https:') return '';
    const host = url.hostname.toLowerCase();
    const allowed = host === 'drive.google.com' || host.endsWith('.drive.google.com') || host === 'docs.google.com' || host.endsWith('.docs.google.com');
    if (!allowed) return '';
    return url.toString();
  } catch {
    return '';
  }
}

function getRoomForwardingAddress(space: AppSpace) {
  const alias = (space.email_alias || `${slugify(space.name) || 'room'}-pending`).toLowerCase();
  return `${alias}@${INBOUND_EMAIL_DOMAIN}`;
}

function normalizeEmailThreadUrl(value: string): { provider: 'gmail' | 'outlook'; url: string } | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  try {
    const url = new URL(trimmed);
    if (url.protocol !== 'https:') return null;
    const host = url.hostname.toLowerCase();
    if (host === 'mail.google.com') return { provider: 'gmail', url: url.toString() };
    const outlookHosts = new Set(['outlook.live.com', 'outlook.office.com', 'outlook.office365.com', 'outlook.office.com']);
    if (outlookHosts.has(host) || host.endsWith('.outlook.office.com') || host.endsWith('.outlook.office365.com')) return { provider: 'outlook', url: url.toString() };
    return null;
  } catch {
    return null;
  }
}

function normalizeExternalAttachmentUrl(attachment: ExternalAttachmentDraft) {
  if (attachment.provider === 'google_drive') return normalizeGoogleDriveUrl(attachment.url);
  const normalized = normalizeEmailThreadUrl(attachment.url);
  return normalized?.provider === attachment.provider ? normalized.url : '';
}

function getExternalAttachmentValidationMessage(provider: ExternalAttachmentProvider) {
  if (provider === 'google_drive') return 'Paste a valid Google Drive, Docs, Sheets, or Slides share link.';
  return 'Paste a valid Gmail or Outlook message/thread link.';
}

function getExternalAttachmentDefaultTitle(provider: ExternalAttachmentProvider, url: string) {
  if (provider === 'google_drive') return getGoogleDriveAttachmentTitle(url);
  return getEmailThreadAttachmentTitle(provider);
}

function getEmailThreadAttachmentTitle(provider: 'gmail' | 'outlook') {
  return provider === 'gmail' ? 'Gmail thread' : 'Outlook thread';
}

function getGoogleDriveAttachmentTitle(url: string) {
  try {
    const parsed = new URL(url);
    if (parsed.hostname.includes('docs.google.com')) {
      const type = parsed.pathname.split('/').filter(Boolean)[0];
      if (type === 'spreadsheets') return 'Google Sheets file';
      if (type === 'presentation') return 'Google Slides file';
      if (type === 'document') return 'Google Docs file';
      if (type === 'forms') return 'Google Forms file';
    }
  } catch {
    // Fall through to generic label.
  }
  return 'Google Drive file';
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

function sanitizeFilename(filename: string) {
  const cleaned = filename.normalize('NFKD').replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/^-+|-+$/g, '');
  return cleaned || 'attachment';
}

function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatMessageTime(timestamp: string) {
  return new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' }).format(new Date(timestamp));
}

function formatTaskDate(value: string) {
  return new Date(`${toTaskDateKey(value)}T12:00:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

function toTaskDateKey(value: string) {
  return value.slice(0, 10);
}

function toDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function buildCalendarDays(month: Date) {
  const first = new Date(month.getFullYear(), month.getMonth(), 1);
  const start = new Date(first);
  start.setDate(first.getDate() - first.getDay());
  return Array.from({ length: 42 }, (_, index) => {
    const day = new Date(start);
    day.setDate(start.getDate() + index);
    return day;
  });
}

function groupReactions(reactions: AppReaction[]) {
  const groups = new Map<string, { emoji: string; count: number; userIds: string[] }>();
  reactions.forEach((reaction) => {
    const group = groups.get(reaction.emoji) ?? { emoji: reaction.emoji, count: 0, userIds: [] };
    group.count += 1;
    group.userIds.push(reaction.user_id);
    groups.set(reaction.emoji, group);
  });
  return [...groups.values()];
}

function readRoomCompactSettings(storageKey: string): RoomCompactSettings {
  if (typeof window === 'undefined') return { all: false, rooms: {} };
  try {
    const parsed = JSON.parse(window.localStorage.getItem(storageKey) ?? '{}') as Partial<RoomCompactSettings>;
    return { all: Boolean(parsed.all), rooms: {} };
  } catch {
    return { all: false, rooms: {} };
  }
}

function getCommentsSignature(comments: Pick<AppComment, 'id' | 'updated_at'>[]) {
  return comments.map((comment) => `${comment.id}:${comment.updated_at}`).join('|');
}

function clampThreadWidth(width: number) {
  return Math.round(Math.min(80, Math.max(20, width)) * 10) / 10;
}

function hasAuthCallbackInUrl(routeKey = '') {
  if (typeof window === 'undefined') return false;
  const value = routeKey || `${window.location.pathname}${window.location.search}${window.location.hash}`;
  return /(?:[?#&](?:access_token|refresh_token|code|error|error_description)=)|type=magiclink/.test(value);
}

function getBasePath() {
  const base = import.meta.env.BASE_URL || '/';
  return base.endsWith('/') ? base : `${base}/`;
}

function getAppUrl() {
  return `${getBasePath()}app`;
}

function getAuthRedirectUrl(inviteToken = '') {
  const url = new URL(getAppUrl(), window.location.origin);
  url.hash = '';
  url.search = '';
  if (inviteToken) url.searchParams.set('invite', inviteToken);
  return url.toString();
}

function getInitialRouteKey() {
  if (typeof window === 'undefined') return '';
  const redirectedPath = window.sessionStorage.getItem(ROUTE_REDIRECT_STORAGE_KEY);
  if (redirectedPath) {
    window.sessionStorage.removeItem(ROUTE_REDIRECT_STORAGE_KEY);
    window.history.replaceState({}, '', redirectedPath);
  }
  return `${window.location.pathname}${window.location.search}${window.location.hash}`;
}

function stripBasePath(pathname: string) {
  const base = getBasePath();
  if (base !== '/' && pathname.startsWith(base)) {
    return pathname.slice(base.length).replace(/^\/+/, '');
  }
  return pathname.replace(/^\/+/, '');
}

const MARKETING_PAGE_ROUTES = new Set(['', 'privacy', 'terms', 'acceptable-use', 'refund', 'subprocessors', 'security', 'accessibility']);

function isMarketingHomeRoute(inviteToken: string, routeKey = '') {
  if (inviteToken || hasAuthCallbackInUrl(routeKey)) return false;
  const path = stripBasePath(window.location.pathname).replace(/\/+$/, '');
  return MARKETING_PAGE_ROUTES.has(path);
}

function getInitialTheme(): 'light' | 'dark' {
  if (typeof window === 'undefined') return 'light';
  return window.localStorage.getItem(THEME_STORAGE_KEY) === 'dark' ? 'dark' : 'light';
}

function getInitialAccentColor(): AccentColor {
  if (typeof window === 'undefined') return 'tangerine';
  const saved = window.localStorage.getItem(ACCENT_STORAGE_KEY);
  return saved && saved in accentPalettes ? saved as AccentColor : 'tangerine';
}

function getInitialChatOpen() {
  if (typeof window === 'undefined') return false;
  return window.localStorage.getItem(CHAT_OPEN_STORAGE_KEY) === 'true';
}

function getInitialThreadWidth() {
  if (typeof window === 'undefined') return 30;
  const savedWidth = Number(window.localStorage.getItem(THREAD_WIDTH_STORAGE_KEY));
  return clampThreadWidth(Number.isFinite(savedWidth) && savedWidth >= 20 && savedWidth <= 80 ? savedWidth : 30);
}

function normalizeSharedUrl(value: string) {
  const candidate = value.trim().replace(/[),.;!?]+$/g, '');
  if (!/^https?:\/\//i.test(candidate)) return null;
  try {
    const parsed = new URL(candidate);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:' ? parsed.toString() : null;
  } catch {
    return null;
  }
}

function extractUrls(value: string) {
  const matches = value.match(/https?:\/\/[^\s<]+/gi) ?? [];
  return [...new Set(matches.map(normalizeSharedUrl).filter((url): url is string => Boolean(url)))].slice(0, 3);
}

type MessageTextToken = { kind: 'text'; text: string } | { kind: 'url'; text: string; href: string } | { kind: 'mention'; text: string };

function buildMessageTextTokens(value: string, mentionProfiles: AppProfile[]): MessageTextToken[] {
  const mentionNames = [...new Set(mentionProfiles.map((profile) => getProfileName(profile, profile.email.split('@')[0] || 'Hub member').trim()).filter(Boolean))]
    .sort((a, b) => b.length - a.length);
  const tokens: MessageTextToken[] = [];
  const pattern = /(https?:\/\/[^\s<]+)|(@[^\s@#]+(?:\s+[^\s@#]+){0,3})/gi;
  let cursor = 0;
  for (const match of value.matchAll(pattern)) {
    const index = match.index ?? 0;
    if (index > cursor) tokens.push({ kind: 'text', text: value.slice(cursor, index) });
    const raw = match[0];
    const url = normalizeSharedUrl(raw);
    if (url) {
      tokens.push({ kind: 'url', text: shortenUrlForDisplay(url), href: url });
    } else {
      const mentionName = mentionNames.find((name) => raw.toLowerCase().startsWith(`@${name.toLowerCase()}`));
      if (mentionName) {
        const mentionText = raw.slice(0, mentionName.length + 1);
        tokens.push({ kind: 'mention', text: mentionText });
        if (raw.length > mentionText.length) tokens.push({ kind: 'text', text: raw.slice(mentionText.length) });
      } else {
        tokens.push({ kind: 'text', text: raw });
      }
    }
    cursor = index + raw.length;
  }
  if (cursor < value.length) tokens.push({ kind: 'text', text: value.slice(cursor) });
  return tokens;
}

function shortenUrlForDisplay(url: string) {
  try {
    const parsed = new URL(url);
    const path = `${parsed.pathname}${parsed.search}${parsed.hash}`;
    if (path.length <= 28) return url;
    return `${parsed.origin}${parsed.pathname.slice(0, 18)}...${path.slice(-12)}`;
  } catch {
    return url.length > 48 ? `${url.slice(0, 32)}...${url.slice(-12)}` : url;
  }
}

function getActiveMentionMatch(value: string, caretPosition: number) {
  const prefix = value.slice(0, caretPosition);
  const match = prefix.match(/(^|\s)@([^@#\s]*)$/);
  if (!match) return null;
  const query = match[2] ?? '';
  return { query, start: caretPosition - query.length - 1, end: caretPosition };
}

function getMentionSearchValue(profile: AppProfile) {
  return [profile.nickname, profile.display_name, profile.full_name, profile.email]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
}

function parseEmailSendCommand(value: string) {
  const raw = value.trim();
  if (!/^to:/im.test(raw) && !/^cc:/im.test(raw) && !/^subj(?:ect)?:/im.test(raw)) return null;
  const lines = raw.split(/\r?\n/);
  const metadata: Record<string, string[]> = { to: [], cc: [], bcc: [], subj: [] };
  const bodyLines: string[] = [];
  let inMetadata = true;
  for (const line of lines) {
    const match = inMetadata ? line.match(/^\s*(to|cc|bcc|subj|subject):\s*(.*)$/i) : null;
    if (match) {
      const key = match[1].toLowerCase() === 'subject' ? 'subj' : match[1].toLowerCase();
      metadata[key].push(match[2]);
      continue;
    }
    if (inMetadata && line.trim() === '') {
      inMetadata = false;
      continue;
    }
    inMetadata = false;
    bodyLines.push(line);
  }
  const to = metadata.to.flatMap((line) => line.split(/[;,]/)).map(normalizeEmailAddress).filter(Boolean)[0];
  if (!to) return null;
  const cc = metadata.cc.flatMap((line) => line.split(/[;,]/)).map(normalizeEmailAddress).filter(Boolean);
  const bcc = metadata.bcc.flatMap((line) => line.split(/[;,]/)).map(normalizeEmailAddress).filter(Boolean);
  const subject = metadata.subj.join(' ').replace(/\s+/g, ' ').trim().slice(0, 180);
  const message = bodyLines.join('\n').trim();
  if (!message) return null;
  return { to, cc: [...new Set(cc)].slice(0, 10), bcc: [...new Set(bcc)].slice(0, 10), subject, message };
}

function normalizeEmailAddress(value: string) {
  const email = value.trim().replace(/^mailto:/i, '').replace(/[<>,;]+$/g, '').replace(/^[<,;]+/g, '');
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : '';
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  if (typeof error === 'object' && error && 'message' in error) return String(error.message);
  return 'Something went wrong. Please try again.';
}

function getBusinessModules(workspace?: AppWorkspace): BusinessModules {
  return { ...DEFAULT_BUSINESS_MODULES, ...(workspace?.business_modules ?? {}) };
}

function hasAcknowledgedBusinessModule(workspace: AppWorkspace, key: BusinessModuleKey) {
  return workspace.business_module_disclaimers?.[key] === BUSINESS_MODULE_NOTICE_VERSION;
}

async function updateWorkspaceBusinessModules(workspaceId: string, modules: BusinessModules, disclaimers: Record<string, string>) {
  if (!supabase) throw new Error('Supabase is not configured.');
  const { error } = await supabase
    .from('workspaces')
    .update({
      business_modules: modules,
      business_module_disclaimers: disclaimers,
      updated_at: new Date().toISOString(),
    })
    .eq('id', workspaceId);
  if (error) throw error;
}

function getWorkspaceSubscriptionState(workspace?: AppWorkspace) {
  const now = Date.now();
  const trialEndsAt = workspace?.trial_ends_at ? Date.parse(workspace.trial_ends_at) : NaN;
  const status = workspace?.subscription_status ?? (workspace?.plan && workspace.plan !== 'free' ? 'active' : 'trial');
  const daysRemaining = Number.isFinite(trialEndsAt) ? Math.max(0, Math.ceil((trialEndsAt - now) / 86_400_000)) : null;
  return { status, daysRemaining, trialEndsAt: Number.isFinite(trialEndsAt) ? trialEndsAt : null };
}

function formatSubscriptionStatusLabel(workspace?: AppWorkspace | null) {
  const state = getWorkspaceSubscriptionState(workspace ?? undefined);
  if (state.status === 'active') return 'Active subscription';
  if (state.status === 'expired') return 'Trial expired';
  if (state.status === 'cancelled') return 'Subscription cancelled';
  return state.daysRemaining == null ? 'Free trial' : `${state.daysRemaining} day${state.daysRemaining === 1 ? '' : 's'} left in trial`;
}

function normalizePlan(_plan: string): LaunchPlan {
  return 'tricord';
}

function getRoleLabel(role: WorkspaceRole) {
  const labels: Record<WorkspaceRole, string> = {
    owner: 'Owner',
    admin: 'Admin',
    member: 'Member',
    guest: 'Guest',
  };
  return labels[role];
}

function getRoomAccessLabel(access: SpaceAccess) {
  const labels: Record<SpaceAccess, string> = {
    public: 'public',
    private: 'private',
    invite_only: 'invite-only',
  };
  return labels[access];
}

function getKnowledgeCategoryLabel(category: KnowledgeCategory) {
  return knowledgeCategories.find((item) => item.value === category)?.label ?? category;
}

function getInitialInviteToken() {
  const urlToken = new URLSearchParams(window.location.search).get('invite');
  if (urlToken) return urlToken;
  return window.localStorage.getItem(INVITE_STORAGE_KEY) ?? '';
}

function clearStoredInviteToken() {
  window.localStorage.removeItem(INVITE_STORAGE_KEY);
}

function surface(theme: 'light' | 'dark') {
  return theme === 'dark' ? 'border-white/10 bg-white/[0.055]' : 'border-[#E7E3EA] bg-white';
}

function subtleButton(theme: 'light' | 'dark') {
  return theme === 'dark' ? 'border-white/10 bg-white/[0.055] hover:bg-white/[0.1]' : 'border-[#E7E3EA] bg-white hover:bg-[var(--accent-soft)]';
}

function muted(theme: 'light' | 'dark') {
  return theme === 'dark' ? 'text-[#AAA4B3]' : 'text-[#6F6878]';
}
