import { Fragment, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  Banknote, BriefcaseBusiness, CalendarDays, Camera, Check, Clock3, Coffee, ExternalLink, FileUp,
  Gauge, MapPin, MonitorSmartphone, Pause, Pencil, Play, Plus, RefreshCw, Search, ShieldCheck, Square, Users,
  Trash2, X,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { cn } from '../../lib/utils';
import type { AppMembership, AppProfile, ViewMode, WorkspaceCapabilities, WorkspaceRole } from '../../types';

type Theme = 'light' | 'dark';
type WorkforceView = Extract<ViewMode, 'timekeeping' | 'hr' | 'payroll' | 'reports'>;

const MAX_WORKFORCE_UPLOAD_BYTES = 20 * 1024 * 1024;
const BLOCKED_WORKFORCE_FILE_EXTENSIONS = new Set(['ade', 'adp', 'apk', 'app', 'bat', 'bin', 'cmd', 'com', 'cpl', 'dll', 'dmg', 'exe', 'gadget', 'hta', 'ins', 'iso', 'jar', 'js', 'jse', 'lib', 'lnk', 'mde', 'msc', 'msi', 'msp', 'mst', 'osx', 'pif', 'ps1', 'scr', 'sh', 'sys', 'vb', 'vbe', 'vbs', 'vxd', 'ws', 'wsc', 'wsf', 'wsh']);
const PAYROLL_FREQUENCY_OPTIONS = ['weekly', 'biweekly', 'semimonthly', 'monthly'];
const PAYROLL_FREQUENCY_LABELS: Record<string, string> = { weekly: 'Weekly', biweekly: 'Bi-weekly', semimonthly: 'Semi-monthly', monthly: 'Monthly' };

interface WorkforceProps {
  view: WorkforceView;
  workspaceId: string;
  userId: string;
  role: WorkspaceRole;
  profiles: Record<string, AppProfile>;
  memberships: AppMembership[];
  capabilities: WorkspaceCapabilities | null;
  theme: Theme;
  premiumFeatures: boolean;
  onNotice: (message: string) => void;
}

interface EmployeeProfile {
  id: string; workspace_id: string; user_id: string; first_name: string | null; last_name: string | null;
  address: string | null; contact_number: string | null; birthday: string | null;
  emergency_contact_name: string | null; emergency_contact_number: string | null;
  employee_number: string | null; department: string | null; position: string | null;
  manager_user_id: string | null; employment_status: string; hire_date: string | null; employment_type: string | null;
  exemption_status: 'exempt' | 'non_exempt' | null;
}

interface TimeEntry {
  id: string; workspace_id: string; employee_profile_id: string; work_date: string;
  clock_in: string; clock_out: string | null; break_started_at: string | null; break_seconds: number;
}

interface TimeEvent {
  id: string; workspace_id: string; employee_profile_id: string; time_entry_id: string;
  event_type: 'clock_in' | 'clock_out' | 'break_start' | 'break_end'; occurred_at: string;
  latitude: number | null; longitude: number | null; map_url: string | null; ip_address: string | null;
  device_information: string | null; selfie_path: string | null; distance_from_office_meters: number | null;
}

interface TimekeepingSettings {
  workspace_id: string; capture_location: boolean; capture_ip: boolean; capture_device: boolean;
  require_selfie: boolean; enforce_geofence: boolean; office_latitude: number | null;
  office_longitude: number | null; geofence_radius_meters: number; standard_daily_hours: number;
  grace_period_minutes: number;
  workday_start: string; workday_end: string; workdays: number[];
}

type AttendancePolicyKey = 'capture_location' | 'capture_ip' | 'capture_device' | 'require_selfie' | 'enforce_geofence';

interface EmployeeTimekeepingPolicy extends TimekeepingSettings {
  employee_profile_id: string;
  enabled: boolean;
  pending_requirements?: Partial<Record<AttendancePolicyKey, boolean>> | null;
  pending_requested_at?: string | null;
  pending_requested_by?: string | null;
  accepted_requirements_at?: string | null;
  declined_requirements_at?: string | null;
  updated_at?: string;
  updated_by?: string | null;
}

interface EmployeePayrollField {
  id: string; workspace_id: string; employee_profile_id: string; name: string;
  item_kind: 'earning' | 'deduction'; calculation_type: 'fixed' | 'percentage';
  value: number; country_code: string | null; active: boolean;
}

interface WorkforceSettings {
  workspace_id: string; country_code: string; currency_code: string; locale: string; timezone: string;
  date_format: string; payroll_frequency: string; first_day_of_week: number;
}

interface LeaveType { id: string; name: string; code: string; paid: boolean; annual_allowance: number }
interface LeaveRequest { id: string; workspace_id: string; employee_profile_id: string; leave_type_id: string; start_date: string; end_date: string; days: number; reason: string | null; status: string; created_at: string }
interface OvertimeRequest { id: string; workspace_id: string; employee_profile_id: string; work_date: string; hours: number; reason: string | null; status: string; created_at: string }
interface LeaveBalance { id: string; employee_profile_id: string; leave_type_id: string; year: number; allocated: number; used: number }
interface PayrollPeriod { id: string; name: string; period_start: string; period_end: string; pay_date: string; status: string; currency_code: string }
interface PayrollItem { id: string; payroll_period_id: string; employee_profile_id: string; regular_hours: number; overtime_hours: number; gross_pay: number; deductions: number; net_pay: number }
interface PayrollRule { id: string; name: string; rule_kind: 'earning' | 'deduction'; calculation_type: 'fixed' | 'percentage'; value: number; country_code: string | null; active: boolean }
interface WorkforceHoliday { id: string; holiday_date: string; name: string; country_code: string | null; paid: boolean }
interface RecordChangeRequest {
  id: string; workspace_id: string; employee_profile_id: string; target_table: 'employee_documents' | 'performance_records';
  target_id: string; request_type: 'delete' | 'replace' | 'update'; details: string | null; status: string;
  requested_by: string; reviewed_by: string | null; reviewed_at: string | null; created_at: string;
}

interface WorkforceConfirmState {
  title: string;
  body: string;
  confirmLabel: string;
  tone?: 'danger' | 'accent';
  onConfirm: () => Promise<void>;
}

export function WorkforceModule(props: WorkforceProps) {
  if (props.view === 'timekeeping') return <TimekeepingPage {...props} />;
  if (props.view === 'hr') return <HrPage {...props} />;
  if (props.view === 'payroll') return <PayrollPage {...props} />;
  return <ReportsPage {...props} />;
}

function TimekeepingPage({ workspaceId, userId, role, profiles, capabilities, theme, premiumFeatures, onNotice }: WorkforceProps) {
  const [employee, setEmployee] = useState<EmployeeProfile | null>(null);
  const [employees, setEmployees] = useState<EmployeeProfile[]>([]);
  const [entries, setEntries] = useState<TimeEntry[]>([]);
  const [events, setEvents] = useState<TimeEvent[]>([]);
  const [expandedEvidenceEntryId, setExpandedEvidenceEntryId] = useState('');
  const [policies, setPolicies] = useState<EmployeeTimekeepingPolicy[]>([]);
  const [selectedPolicyEmployeeId, setSelectedPolicyEmployeeId] = useState('');
  const [settings, setSettings] = useState<EmployeeTimekeepingPolicy | null>(null);
  const [saving, setSaving] = useState(false);
  const [confirmDialog, setConfirmDialog] = useState<WorkforceConfirmState | null>(null);
  const [entryModal, setEntryModal] = useState<{ id: string; clockIn: string; clockOut: string } | null>(null);
  const [policyNotice, setPolicyNotice] = useState<{ title: string; body: string; pending?: boolean; employeeProfileId?: string } | null>(null);
  const policySignatureRef = useRef<string | null>(null);
  const [now, setNow] = useState(Date.now());
  const [selfie, setSelfie] = useState<File | null>(null);
  const selfieRef = useRef<HTMLInputElement | null>(null);
  const canConfigure = premiumFeatures && (role === 'owner' || (role === 'admin' && Boolean(capabilities?.manage_timekeeping)));
  const canSeePremiumPolicyNotice = !premiumFeatures && role === 'owner';
  const canClock = role === 'admin' || role === 'member';
  const canManageEntries = role === 'owner' || (role === 'admin' && Boolean(capabilities?.correct_attendance));
  const canViewEvidence = role === 'owner' || (role === 'admin' && Boolean(capabilities?.correct_attendance || capabilities?.manage_timekeeping));

  const load = useCallback(async () => {
    if (!supabase) return;
    const [employeeResult, employeesResult, entriesResult, eventsResult, policiesResult] = await Promise.all([
      supabase.from('employee_profiles').select('*').eq('workspace_id', workspaceId).eq('user_id', userId).maybeSingle(),
      supabase.from('employee_profiles').select('*').eq('workspace_id', workspaceId),
      supabase.from('time_entries').select('*').eq('workspace_id', workspaceId).order('clock_in', { ascending: false }).limit(50),
      supabase.from('time_events').select('*').eq('workspace_id', workspaceId).order('occurred_at', { ascending: false }).limit(250),
      supabase.from('employee_timekeeping_policies').select('*').eq('workspace_id', workspaceId),
    ]);
    if (employeeResult.error || employeesResult.error || entriesResult.error || eventsResult.error || policiesResult.error) {
      onNotice(employeeResult.error?.message ?? employeesResult.error?.message ?? entriesResult.error?.message ?? eventsResult.error?.message ?? policiesResult.error?.message ?? 'Attendance records could not be loaded.');
      return;
    }
    const ownEmployee = employeeResult.data as EmployeeProfile | null;
    const nextEmployees = (employeesResult.data ?? []) as EmployeeProfile[];
    const nextPolicies = (policiesResult.data ?? []) as EmployeeTimekeepingPolicy[];
    setEmployee(ownEmployee);
    setEmployees(nextEmployees);
    setEntries((entriesResult.data ?? []) as TimeEntry[]);
    setEvents((eventsResult.data ?? []) as TimeEvent[]);
    setPolicies(nextPolicies);
    const ownPolicy = nextPolicies.find((policy) => policy.employee_profile_id === ownEmployee?.id) ?? null;
    if ((role === 'admin' || role === 'member') && ownEmployee && ownPolicy) {
      const pendingKeys = pendingAttendanceRequirementKeys(ownPolicy);
      if (pendingKeys.length > 0) {
        const notice = attendancePendingRequirementNotice(pendingKeys.map(settingLabel));
        setPolicyNotice({ ...notice, pending: true, employeeProfileId: ownEmployee.id });
      } else {
        const signature = attendancePolicySignature(ownPolicy);
        const storageKey = attendancePolicyStorageKey(workspaceId, ownEmployee.id);
        const previousSignature = window.localStorage.getItem(storageKey);
        const notice = attendancePolicyChangeNotice(previousSignature, ownPolicy, userId);
        if (notice && policySignatureRef.current !== signature) setPolicyNotice(notice);
        window.localStorage.setItem(storageKey, signature);
        policySignatureRef.current = signature;
      }
    }
    if (canConfigure) {
      setSelectedPolicyEmployeeId((current) => current && nextPolicies.some((policy) => policy.employee_profile_id === current) ? current : nextPolicies[0]?.employee_profile_id ?? '');
    } else {
      setSettings(ownPolicy);
    }
  }, [canConfigure, onNotice, role, userId, workspaceId]);

  useEffect(() => {
    if (!canConfigure) return;
    const selected = policies.find((policy) => policy.employee_profile_id === selectedPolicyEmployeeId);
    setSettings(selected ? { ...selected } : null);
  }, [canConfigure, policies, selectedPolicyEmployeeId]);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => { const id = window.setInterval(() => setNow(Date.now()), 1000); return () => window.clearInterval(id); }, []);
  useEffect(() => {
    if (!supabase) return;
    const channel = supabase.channel(`workforce-time-${workspaceId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'time_entries', filter: `workspace_id=eq.${workspaceId}` }, () => void load())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'time_events', filter: `workspace_id=eq.${workspaceId}` }, () => void load())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'employee_timekeeping_policies', filter: `workspace_id=eq.${workspaceId}` }, () => void load())
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [load, workspaceId]);

  const ownEntries = entries.filter((entry) => entry.employee_profile_id === employee?.id);
  const visibleEntries = canConfigure || canManageEntries ? entries : ownEntries;
  const eventsByEntry = useMemo(() => {
    const grouped = new Map<string, TimeEvent[]>();
    events.forEach((event) => {
      grouped.set(event.time_entry_id, [...(grouped.get(event.time_entry_id) ?? []), event]);
    });
    return grouped;
  }, [events]);
  const active = ownEntries.find((entry) => !entry.clock_out);
  const status = active?.break_started_at ? 'On Break' : active ? 'Clocked In' : 'Clocked Out';
  const todayKey = new Date().toISOString().slice(0, 10);
  const todayHours = ownEntries.filter((entry) => entry.work_date === todayKey).reduce((sum, entry) => sum + workedHours(entry, now), 0);

  const requestLocation = async () => {
    if (!settings?.capture_location && !settings?.enforce_geofence) return { latitude: null, longitude: null };
    if (!navigator.geolocation) throw new Error('Location is not available on this device.');
    return new Promise<{ latitude: number; longitude: number }>((resolve, reject) => navigator.geolocation.getCurrentPosition(
      (position) => resolve({ latitude: position.coords.latitude, longitude: position.coords.longitude }),
      () => reject(new Error('Location permission is required by this Hub.')),
      { enableHighAccuracy: true, timeout: 15000 },
    ));
  };

  const runAction = async (action: 'clock_in' | 'clock_out' | 'break_start' | 'break_end') => {
    if (!supabase || !employee || !settings) return;
    setSaving(true);
    try {
      const location = await requestLocation();
      let selfiePath: string | null = null;
      if (action === 'clock_in' && settings.require_selfie) {
        if (!selfie) throw new Error('Take or choose a selfie before clocking in.');
        const selfieError = validateWorkforceUpload(selfie, true);
        if (selfieError) throw new Error(selfieError);
        selfiePath = `${workspaceId}/${userId}/selfies/${crypto.randomUUID()}-${sanitizeWorkforceFilename(selfie.name)}`;
        const { error: uploadError } = await supabase.storage.from('employee-documents').upload(selfiePath, selfie);
        if (uploadError) throw uploadError;
      }
      const { error } = await supabase.rpc('record_time_event', {
        target_workspace_id: workspaceId, requested_action: action,
        event_latitude: location.latitude, event_longitude: location.longitude,
        event_device_information: navigator.userAgent, event_selfie_path: selfiePath,
      });
      if (error) throw error;
      setSelfie(null);
      await load();
    } catch (error) { onNotice(errorMessage(error)); } finally { setSaving(false); }
  };

  const saveSettings = async () => {
    if (!supabase || !settings || !canConfigure) return;
    setSaving(true);
    const currentPolicy = policies.find((policy) => policy.employee_profile_id === settings.employee_profile_id) ?? settings;
    const pendingRequirements: Partial<Record<AttendancePolicyKey, boolean>> = { ...(currentPolicy.pending_requirements ?? {}) };
    const requirementUpdates = {} as Record<AttendancePolicyKey, boolean>;
    ATTENDANCE_POLICY_NOTICE_KEYS.forEach((key) => {
      const requestedValue = Boolean(settings[key]) || settings.pending_requirements?.[key] === true;
      const currentValue = Boolean(currentPolicy[key]);
      if (requestedValue && !currentValue) {
        pendingRequirements[key] = true;
        requirementUpdates[key] = false;
      } else if (!requestedValue) {
        delete pendingRequirements[key];
        requirementUpdates[key] = false;
      } else {
        requirementUpdates[key] = true;
      }
    });
    const hasPendingRequirements = Object.values(pendingRequirements).some(Boolean);
    const { error } = await supabase.from('employee_timekeeping_policies').update({
      ...requirementUpdates,
      pending_requirements: pendingRequirements,
      pending_requested_at: hasPendingRequirements ? new Date().toISOString() : null,
      pending_requested_by: hasPendingRequirements ? userId : null,
      office_latitude: settings.office_latitude,
      office_longitude: settings.office_longitude, geofence_radius_meters: settings.geofence_radius_meters,
      standard_daily_hours: settings.standard_daily_hours, grace_period_minutes: settings.grace_period_minutes,
      workday_start: settings.workday_start, workday_end: settings.workday_end, workdays: settings.workdays,
      updated_at: new Date().toISOString(), updated_by: userId,
    }).eq('employee_profile_id', settings.employee_profile_id);
    setSaving(false);
    if (error) onNotice(error.message); else { onNotice(hasPendingRequirements ? 'Employee attendance policy saved. New requirements are pending employee acceptance.' : 'Employee attendance policy saved.'); await load(); }
  };

  const respondToPendingPolicy = async (acceptRequirements: boolean) => {
    if (!supabase || !policyNotice?.employeeProfileId) return;
    setSaving(true);
    const { error } = await supabase.rpc('respond_to_attendance_policy_requirements', {
      target_employee_profile_id: policyNotice.employeeProfileId,
      accept_requirements: acceptRequirements,
    });
    setSaving(false);
    if (error) onNotice(error.message);
    else {
      setPolicyNotice(null);
      onNotice(acceptRequirements ? 'Attendance policy accepted.' : 'Attendance policy declined.');
      await load();
    }
  };
  const openAdjustEntry = (entry: TimeEntry) => {
    if (!canManageEntries) return;
    setEntryModal({ id: entry.id, clockIn: entry.clock_in, clockOut: entry.clock_out ?? '' });
  };
  const saveEntryAdjustment = async () => {
    if (!supabase || !canManageEntries || !entryModal) return;
    const clockInDate = new Date(entryModal.clockIn);
    const clockOutDate = entryModal.clockOut.trim() ? new Date(entryModal.clockOut) : null;
    if (Number.isNaN(clockInDate.getTime()) || (clockOutDate && Number.isNaN(clockOutDate.getTime()))) {
      onNotice('Enter valid date/time values.');
      return;
    }
    const { error } = await supabase.from('time_entries').update({ clock_in: clockInDate.toISOString(), clock_out: clockOutDate ? clockOutDate.toISOString() : null, updated_at: new Date().toISOString() }).eq('id', entryModal.id);
    if (error) onNotice(error.message); else { setEntryModal(null); onNotice('Attendance entry updated.'); await load(); }
  };
  const deleteEntry = (entry: TimeEntry) => {
    if (!supabase || !canManageEntries) return;
    setConfirmDialog({
      title: 'Delete attendance entry?',
      body: 'This attendance record will be permanently removed.',
      confirmLabel: 'Delete entry',
      onConfirm: async () => {
        const { error } = await supabase.from('time_entries').delete().eq('id', entry.id);
        if (error) throw new Error(error.message);
        onNotice('Attendance entry deleted.');
        await load();
      },
    });
  };

  const openSelfie = async (path: string) => {
    if (!supabase) return;
    const { data, error } = await supabase.storage.from('employee-documents').createSignedUrl(path, 300);
    if (error || !data?.signedUrl) { onNotice(error?.message ?? 'Selfie could not be opened.'); return; }
    window.open(data.signedUrl, '_blank', 'noopener,noreferrer');
  };

  return <>
    <ModuleFrame icon={Clock3} title="Attendance Tracking" subtitle="Clock in, clock out, and working-hour records" theme={theme}>
      <div className={cn('grid gap-4', canConfigure && 'lg:grid-cols-[minmax(0,1fr)_380px]')}>
        <div className="space-y-4">
          {canClock && <div className={cn('border-b pb-6', border(theme))}>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <Metric label="Current status" value={status} accent theme={theme} />
              <Metric label="Clock in" value={active ? formatTime(active.clock_in) : '—'} theme={theme} />
              <Metric label="Current duration" value={active ? formatDuration(workedHours(active, now)) : '0h 00m'} theme={theme} />
              <Metric label="Today’s total" value={formatDuration(todayHours)} theme={theme} />
            </div>
          </div>}
          {canClock && <div className={cn('flex flex-wrap items-center gap-3 border-b py-5', border(theme))}>
            {!active && <ActionButton icon={Play} label="Clock in" onClick={() => void runAction('clock_in')} disabled={saving} />}
            {active && !active.break_started_at && <ActionButton icon={Coffee} label="Start break" onClick={() => void runAction('break_start')} disabled={saving} secondary />}
            {active?.break_started_at && <ActionButton icon={Play} label="Resume work" onClick={() => void runAction('break_end')} disabled={saving} />}
            {active && <ActionButton icon={Square} label="Clock out" onClick={() => void runAction('clock_out')} disabled={saving} danger />}
            {settings?.require_selfie && !active && (
              <>
                <input ref={selfieRef} className="hidden" type="file" accept="image/*" capture="user" onChange={(event) => setSelfie(event.target.files?.[0] ?? null)} />
                <button onClick={() => selfieRef.current?.click()} className={cn('inline-flex h-11 items-center gap-2 rounded-lg border px-4 text-sm font-semibold', buttonSurface(theme))}><Camera className="h-4 w-4" />{selfie ? 'Selfie ready' : 'Add selfie'}</button>
              </>
            )}
          </div>}
          {role === 'owner' && <div><h3 className="font-bold">Attendance records</h3><p className={cn('mt-1 text-sm', muted(theme))}>Owners can correct or remove entries. Admins need an explicit attendance permission.</p></div>}
          <DataTable headers={[...(role === 'owner' || role === 'admin' ? ['Employee'] : []), 'Date', 'Clock in', 'Clock out', 'Break', 'Hours', ...(canViewEvidence || canManageEntries ? ['Actions'] : [])]} theme={theme}>
            {visibleEntries.map((entry) => {
              const entryEvents = eventsByEntry.get(entry.id) ?? [];
              const expanded = expandedEvidenceEntryId === entry.id;
              const actionColSpan = (role === 'owner' || role === 'admin' ? 1 : 0) + 6 + (canViewEvidence || canManageEntries ? 1 : 0);
              return (
                <Fragment key={entry.id}>
                  <tr className={cn('border-b last:border-0', border(theme))}>
                    {(role === 'owner' || role === 'admin') && <Cell strong>{employeeName(employees.find((item) => item.id === entry.employee_profile_id), profiles)}</Cell>}<Cell>{formatDate(entry.work_date)}</Cell><Cell>{formatTime(entry.clock_in)}</Cell><Cell>{entry.clock_out ? formatTime(entry.clock_out) : 'Active'}</Cell><Cell>{formatDuration(entry.break_seconds / 3600)}</Cell><Cell strong>{formatDuration(workedHours(entry, now))}</Cell>{(canViewEvidence || canManageEntries) && <Cell><div className="flex gap-2">{canViewEvidence && <IconAction label="View clock-in evidence" icon={ShieldCheck} onClick={() => setExpandedEvidenceEntryId(expanded ? '' : entry.id)} />}{canManageEntries && <IconAction label="Edit attendance" icon={Pencil} onClick={() => openAdjustEntry(entry)} />}{canManageEntries && <IconAction label="Delete attendance" icon={Trash2} onClick={() => void deleteEntry(entry)} />}</div></Cell>}
                  </tr>
                  {expanded && <tr className={cn('border-b', border(theme))}><td colSpan={actionColSpan} className="px-4 py-4"><TimeEvidencePanel events={entryEvents} theme={theme} onOpenSelfie={openSelfie} /></td></tr>}
                </Fragment>
              );
            })}
          </DataTable>
        </div>
        {canSeePremiumPolicyNotice && <aside className={cn('h-fit rounded-lg border p-4', panel(theme))}>
          <h3 className="font-bold">Employee attendance policy</h3>
          <p className={cn('mt-2 text-sm leading-6', muted(theme))}>Advanced per-employee clock-in requirements are available on Plus and Pro.</p>
        </aside>}
        {canConfigure && <aside className={cn('h-fit rounded-lg border p-4', panel(theme))}>
          <h3 className="font-bold">Employee attendance policy</h3>
          <p className={cn('mt-1 text-xs leading-5', muted(theme))}>Requirements are configured separately for each Admin or Member.</p>
          <label className="mt-4 block"><span className={cn('mb-1 block text-xs font-semibold', muted(theme))}>Employee</span><select value={selectedPolicyEmployeeId} onChange={(event) => setSelectedPolicyEmployeeId(event.target.value)} className={cn('h-11 w-full rounded-lg border px-3 text-sm font-semibold', panel(theme))}>{policies.map((policy) => <option key={policy.employee_profile_id} value={policy.employee_profile_id}>{employeeName(employees.find((item) => item.id === policy.employee_profile_id), profiles)}</option>)}</select></label>
          {settings && <div className={cn('mt-4 border-t pt-4', border(theme))}>
            {ATTENDANCE_POLICY_NOTICE_KEYS.map((key) => <div key={key} className="py-0.5"><Toggle checked={settings[key] || Boolean(settings.pending_requirements?.[key])} onChange={(checked) => {
              if (checked) {
                const notice = attendanceSettingNotice(key);
                setConfirmDialog({ title: notice.title, body: notice.body, confirmLabel: 'Continue', tone: 'accent', onConfirm: async () => setSettings({ ...settings, [key]: true }) });
                return;
              }
              setSettings({ ...settings, [key]: false, pending_requirements: { ...(settings.pending_requirements ?? {}), [key]: false } });
            }} label={settingLabel(key)} />{settings.pending_requirements?.[key] && <p className={cn('ml-1 mt-1 text-xs font-semibold text-[var(--accent-strong)]')}>Pending employee acceptance</p>}</div>)}
            {settings.enforce_geofence && <div className="mt-3 grid grid-cols-2 gap-2"><SmallInput label="Latitude" value={settings.office_latitude ?? ''} onChange={(value) => setSettings({ ...settings, office_latitude: numberOrNull(value) })} theme={theme} /><SmallInput label="Longitude" value={settings.office_longitude ?? ''} onChange={(value) => setSettings({ ...settings, office_longitude: numberOrNull(value) })} theme={theme} /><SmallInput label="Radius (m)" value={settings.geofence_radius_meters} onChange={(value) => setSettings({ ...settings, geofence_radius_meters: Number(value) })} theme={theme} /></div>}
            <div className="mt-4 grid grid-cols-2 gap-2"><SmallInput label="Workday starts" value={settings.workday_start?.slice(0, 5) ?? '09:00'} onChange={(value) => setSettings({ ...settings, workday_start: value })} theme={theme} /><SmallInput label="Workday ends" value={settings.workday_end?.slice(0, 5) ?? '17:00'} onChange={(value) => setSettings({ ...settings, workday_end: value })} theme={theme} /><SmallInput label="Grace (minutes)" value={settings.grace_period_minutes} onChange={(value) => setSettings({ ...settings, grace_period_minutes: Number(value) })} theme={theme} /></div>
            <div className="mt-3 flex gap-1">{['S','M','T','W','T','F','S'].map((day, index) => <button key={`${day}-${index}`} type="button" title={['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'][index]} onClick={() => setSettings({ ...settings, workdays: settings.workdays.includes(index) ? settings.workdays.filter((value) => value !== index) : [...settings.workdays, index].sort() })} className={cn('h-8 w-8 rounded-md text-xs font-bold', settings.workdays.includes(index) ? 'bg-[var(--accent)] text-[var(--accent-ink)]' : buttonSurface(theme))}>{day}</button>)}</div>
            <button onClick={() => void saveSettings()} disabled={saving} className="mt-4 h-10 w-full rounded-lg bg-[var(--accent)] px-4 text-sm font-bold text-[var(--accent-ink)]">Save settings</button>
          </div>}
          {!settings && <p className={cn('mt-4 text-sm', muted(theme))}>No Admin or Member employee profiles are available.</p>}
        </aside>}
      </div>
    </ModuleFrame>
    {entryModal && <WorkforceModal title="Edit attendance entry" theme={theme} onClose={() => setEntryModal(null)} footer={<><button type="button" onClick={() => setEntryModal(null)} className={cn('h-10 rounded-lg border px-4 text-sm font-semibold', buttonSurface(theme))}>Cancel</button><button type="button" onClick={() => void saveEntryAdjustment()} className="h-10 rounded-lg bg-[var(--accent)] px-4 text-sm font-bold text-[var(--accent-ink)]">Save entry</button></>}><div className="grid gap-4 sm:grid-cols-2"><Field label="Clock in" value={entryModal.clockIn} onChange={(value) => setEntryModal({ ...entryModal, clockIn: value })} theme={theme} /><Field label="Clock out (optional)" value={entryModal.clockOut} onChange={(value) => setEntryModal({ ...entryModal, clockOut: value })} theme={theme} /></div><p className={cn('mt-3 text-xs', muted(theme))}>Use a complete date and time, such as 2026-07-14T09:00:00Z.</p></WorkforceModal>}
    {policyNotice && <WorkforceModal title={policyNotice.title} theme={theme} onClose={() => setPolicyNotice(null)} footer={policyNotice.pending ? <><button type="button" onClick={() => void respondToPendingPolicy(false)} disabled={saving} className={cn('h-10 rounded-lg border px-4 text-sm font-semibold', buttonSurface(theme))}>Decline</button><button type="button" onClick={() => void respondToPendingPolicy(true)} disabled={saving} className="h-10 rounded-lg bg-[var(--accent)] px-4 text-sm font-bold text-[var(--accent-ink)]">Accept</button></> : <button type="button" onClick={() => setPolicyNotice(null)} className="h-10 rounded-lg bg-[var(--accent)] px-4 text-sm font-bold text-[var(--accent-ink)]">Confirm</button>}><p className={cn('text-sm leading-6', muted(theme))}>{policyNotice.body}</p></WorkforceModal>}
  {confirmDialog && <WorkforceConfirmModal dialog={confirmDialog} theme={theme} onClose={() => setConfirmDialog(null)} onNotice={onNotice} />}
  </>;
}


function TimeEvidencePanel({ events, theme, onOpenSelfie }: { events: TimeEvent[]; theme: Theme; onOpenSelfie: (path: string) => Promise<void> }) {
  if (events.length === 0) return <p className={cn('text-sm', muted(theme))}>No captured clock-in evidence for this entry yet.</p>;
  return (
    <div className="grid gap-3">
      {events.map((event) => {
        const mapUrl = event.map_url || (event.latitude !== null && event.longitude !== null ? `https://www.google.com/maps?q=${event.latitude},${event.longitude}` : '');
        return (
          <section key={event.id} className={cn('rounded-lg border p-3', panel(theme))}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-bold capitalize">{event.event_type.replaceAll('_', ' ')}</p>
              <p className={cn('text-xs', muted(theme))}>{formatDate(event.occurred_at)} · {formatTime(event.occurred_at)}</p>
            </div>
            <div className="mt-3 grid gap-2 text-xs md:grid-cols-2 xl:grid-cols-3">
              <EvidenceItem icon={MapPin} label="GPS location" theme={theme}>{mapUrl ? <a href={mapUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-semibold text-[var(--accent-strong)]">Open map <ExternalLink className="h-3 w-3" /></a> : 'Not captured'}</EvidenceItem>
              <EvidenceItem icon={ShieldCheck} label="IP address" theme={theme}>{event.ip_address || 'Not captured'}</EvidenceItem>
              <EvidenceItem icon={MonitorSmartphone} label="Device" theme={theme}>{event.device_information || 'Not captured'}</EvidenceItem>
              <EvidenceItem icon={Camera} label="Selfie" theme={theme}>{event.selfie_path ? <button type="button" onClick={() => void onOpenSelfie(event.selfie_path!)} className="font-semibold text-[var(--accent-strong)]">Open selfie</button> : 'Not captured'}</EvidenceItem>
              <EvidenceItem icon={MapPin} label="Distance from office" theme={theme}>{event.distance_from_office_meters !== null ? `${Math.round(Number(event.distance_from_office_meters))} m` : 'Not calculated'}</EvidenceItem>
            </div>
          </section>
        );
      })}
    </div>
  );
}

function EvidenceItem({ icon: Icon, label, theme, children }: { icon: typeof MapPin; label: string; theme: Theme; children: ReactNode }) {
  return <div className={cn('rounded-md border p-2', buttonSurface(theme))}><p className={cn('mb-1 flex items-center gap-1.5 font-semibold', muted(theme))}><Icon className="h-3.5 w-3.5" />{label}</p><div className="break-words">{children}</div></div>;
}

function HrPage({ workspaceId, userId, role, profiles, memberships, capabilities, theme, onNotice }: WorkforceProps) {
  const [employees, setEmployees] = useState<EmployeeProfile[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [query, setQuery] = useState('');
  const [leaveTypes, setLeaveTypes] = useState<LeaveType[]>([]);
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>([]);
  const [overtimeRequests, setOvertimeRequests] = useState<OvertimeRequest[]>([]);
  const [leaveBalances, setLeaveBalances] = useState<LeaveBalance[]>([]);
  const [tab, setTab] = useState<'people' | 'leave' | 'documents' | 'performance' | 'compensation'>('people');
  const [editing, setEditing] = useState<EmployeeProfile | null>(null);
  const [saving, setSaving] = useState(false);
  const [leaveModal, setLeaveModal] = useState<{ mode: 'create' | 'edit'; request?: LeaveRequest } | null>(null);
  const [leaveDraft, setLeaveDraft] = useState({ leave_type_id: '', start_date: '', end_date: '', reason: '' });
  const [overtimeModal, setOvertimeModal] = useState<{ mode: 'create' | 'edit'; request?: OvertimeRequest } | null>(null);
  const [overtimeDraft, setOvertimeDraft] = useState({ work_date: today(), hours: '1', reason: '' });
  const [allocationModal, setAllocationModal] = useState<{ leaveTypeId: string; leaveTypeName: string } | null>(null);
  const [allocationValue, setAllocationValue] = useState('');
  const [confirmDialog, setConfirmDialog] = useState<WorkforceConfirmState | null>(null);
  const canManage = role === 'owner' || (role === 'admin' && Boolean(capabilities?.manage_hr));
  const canApproveLeave = role === 'owner' || (role === 'admin' && Boolean(capabilities?.approve_leave));
  const canManagePayroll = role === 'owner' || (role === 'admin' && Boolean(capabilities?.manage_payroll));

  const load = useCallback(async () => {
    if (!supabase) return;
    const [employeesResult, typesResult, requestsResult, balancesResult] = await Promise.all([
      supabase.from('employee_profiles').select('*').eq('workspace_id', workspaceId).order('last_name'),
      supabase.from('leave_types').select('*').eq('workspace_id', workspaceId).eq('active', true).order('name'),
      supabase.from('leave_requests').select('*').eq('workspace_id', workspaceId).order('created_at', { ascending: false }),
      supabase.from('leave_balances').select('*').eq('workspace_id', workspaceId),
    ]);
    if (employeesResult.error || typesResult.error || requestsResult.error || balancesResult.error) { onNotice(employeesResult.error?.message ?? typesResult.error?.message ?? requestsResult.error?.message ?? balancesResult.error?.message ?? 'Employee records could not be loaded.'); return; }
    const next = (employeesResult.data ?? []) as EmployeeProfile[];
    setEmployees(next); setLeaveTypes((typesResult.data ?? []) as LeaveType[]); setLeaveRequests((requestsResult.data ?? []) as LeaveRequest[]); setLeaveBalances((balancesResult.data ?? []) as LeaveBalance[]);
    setSelectedId((current) => current || next.find((employee) => employee.user_id === userId)?.id || next[0]?.id || '');
    const overtimeResult = await supabase.from('overtime_requests').select('*').eq('workspace_id', workspaceId).order('created_at', { ascending: false });
    if (!overtimeResult.error) setOvertimeRequests((overtimeResult.data ?? []) as OvertimeRequest[]);
    else if (!['42P01', 'PGRST205'].includes(overtimeResult.error.code ?? '')) onNotice(overtimeResult.error.message);
    else setOvertimeRequests([]);
  }, [onNotice, userId, workspaceId]);
  useEffect(() => { void load(); }, [load]);
  useWorkforceRealtime(workspaceId, 'employee_profiles,leave_requests,leave_balances,employee_documents,performance_records,employee_record_change_requests,overtime_requests', load);

  const selected = employees.find((employee) => employee.id === selectedId) ?? null;
  const canRequestLeave = (role === 'member' || role === 'admin') && selected?.user_id === userId;
  useEffect(() => { setEditing(selected ? { ...selected } : null); }, [selected]);
  const membershipRoleByUserId = useMemo(() => new Map(memberships.map((membership) => [membership.user_id, membership.role])), [memberships]);
  const filtered = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return employees
      .filter((employee) => employeeName(employee, profiles).toLowerCase().includes(normalizedQuery) || (employee.department ?? '').toLowerCase().includes(normalizedQuery))
      .sort((first, second) => {
        const firstRole = membershipRoleByUserId.get(first.user_id);
        const secondRole = membershipRoleByUserId.get(second.user_id);
        const firstPriority = firstRole === 'owner' ? 0 : 1;
        const secondPriority = secondRole === 'owner' ? 0 : 1;
        if (firstPriority !== secondPriority) return firstPriority - secondPriority;
        return employeeName(first, profiles).localeCompare(employeeName(second, profiles), undefined, { sensitivity: 'base' });
      });
  }, [employees, membershipRoleByUserId, profiles, query]);

  const saveProfile = async () => {
    if (!supabase || !editing) return;
    setSaving(true);
    let error: { message: string } | null = null;
    if (canManage) {
      const result = await supabase.from('employee_profiles').update({ ...editing, updated_at: new Date().toISOString() }).eq('id', editing.id);
      error = result.error;
    } else {
      const result = await supabase.rpc('update_own_employee_profile', {
        target_workspace_id: workspaceId, new_first_name: editing.first_name, new_last_name: editing.last_name,
        new_address: editing.address, new_contact_number: editing.contact_number, new_birthday: editing.birthday,
        new_emergency_name: editing.emergency_contact_name, new_emergency_number: editing.emergency_contact_number,
      }); error = result.error;
    }
    setSaving(false); if (error) onNotice(error.message); else { onNotice('Employee profile saved.'); await load(); }
  };

  const openLeaveModal = (request?: LeaveRequest) => {
    const leaveTypeId = request?.leave_type_id || leaveTypes[0]?.id || '';
    if (!leaveTypeId) { onNotice('No leave types are configured.'); return; }
    setLeaveDraft({ leave_type_id: leaveTypeId, start_date: request?.start_date ?? today(), end_date: request?.end_date ?? today(), reason: request?.reason ?? '' });
    setLeaveModal({ mode: request ? 'edit' : 'create', request });
  };

  const saveLeaveRequest = async () => {
    if (!supabase || !selected || !leaveModal) return;
    const days = daysBetweenInclusive(leaveDraft.start_date, leaveDraft.end_date);
    if (!leaveDraft.leave_type_id || !leaveDraft.start_date || !leaveDraft.end_date || days < 1) { onNotice('Enter valid leave dates.'); return; }
    const payload = { leave_type_id: leaveDraft.leave_type_id, start_date: leaveDraft.start_date, end_date: leaveDraft.end_date, days, reason: leaveDraft.reason.trim() || null, updated_at: new Date().toISOString() };
    const result = leaveModal.mode === 'edit' && leaveModal.request
      ? await supabase.from('leave_requests').update(payload).eq('id', leaveModal.request.id)
      : await supabase.from('leave_requests').insert({ ...payload, workspace_id: workspaceId, employee_profile_id: selected.id });
    if (result.error) onNotice(result.error.message); else { setLeaveModal(null); onNotice(leaveModal.mode === 'edit' ? 'Leave request updated.' : 'Leave request submitted.'); await load(); }
  };

  const reviewLeave = async (id: string, status: 'approved' | 'rejected') => {
    if (!supabase) return; const { error } = await supabase.from('leave_requests').update({ status, reviewed_by: userId, reviewed_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq('id', id);
    if (error) onNotice(error.message); else await load();
  };
  const cancelLeave = async (id: string) => {
    if (!supabase) return; const { error } = await supabase.from('leave_requests').update({ status: 'canceled', updated_at: new Date().toISOString() }).eq('id', id);
    if (error) onNotice(error.message); else { onNotice('Leave request canceled.'); await load(); }
  };
  const deleteLeave = (id: string) => {
    if (!supabase || !canApproveLeave) return;
    setConfirmDialog({
      title: 'Delete leave request?',
      body: 'This leave request will be permanently removed from the employee record.',
      confirmLabel: 'Continue',
      onConfirm: async () => {
        const { error } = await supabase.from('leave_requests').delete().eq('id', id);
        if (error) throw new Error(error.message);
        onNotice('Leave request deleted.');
        await load();
      },
    });
  };
  const openOvertimeModal = (request?: OvertimeRequest) => {
    if (!selected) return;
    setOvertimeDraft({ work_date: request?.work_date ?? today(), hours: request ? String(request.hours) : '1', reason: request?.reason ?? '' });
    setOvertimeModal({ mode: request ? 'edit' : 'create', request });
  };
  const saveOvertimeRequest = async () => {
    if (!supabase || !selected || !overtimeModal) return;
    const hours = Number(overtimeDraft.hours);
    if (!overtimeDraft.work_date || !Number.isFinite(hours) || hours <= 0) { onNotice('Enter a valid overtime date and hours.'); return; }
    const payload = { work_date: overtimeDraft.work_date, hours, reason: overtimeDraft.reason.trim() || null, updated_at: new Date().toISOString() };
    const result = overtimeModal.mode === 'edit' && overtimeModal.request
      ? await supabase.from('overtime_requests').update(payload).eq('id', overtimeModal.request.id)
      : await supabase.from('overtime_requests').insert({ ...payload, workspace_id: workspaceId, employee_profile_id: selected.id });
    if (result.error) onNotice(result.error.message); else { setOvertimeModal(null); onNotice(overtimeModal.mode === 'edit' ? 'Overtime request updated.' : 'Overtime request submitted.'); await load(); }
  };
  const reviewOvertime = async (id: string, status: 'approved' | 'rejected') => {
    if (!supabase || !canApproveLeave) return;
    const { error } = await supabase.from('overtime_requests').update({ status, reviewed_by: userId, reviewed_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq('id', id);
    if (error) onNotice(error.message); else await load();
  };
  const cancelOvertime = async (id: string) => {
    if (!supabase) return;
    const { error } = await supabase.from('overtime_requests').update({ status: 'canceled', updated_at: new Date().toISOString() }).eq('id', id);
    if (error) onNotice(error.message); else { onNotice('Overtime request canceled.'); await load(); }
  };
  const deleteOvertime = (id: string) => {
    if (!supabase || !canApproveLeave) return;
    setConfirmDialog({
      title: 'Delete overtime request?',
      body: 'This overtime request will be permanently removed from the employee record.',
      confirmLabel: 'Continue',
      onConfirm: async () => {
        const { error } = await supabase.from('overtime_requests').delete().eq('id', id);
        if (error) throw new Error(error.message);
        onNotice('Overtime request deleted.');
        await load();
      },
    });
  };
  const openAllocationModal = (leaveTypeId: string, leaveTypeName: string) => {
    if (!selected || !canManage) return;
    const current = leaveBalances.find((balance) => balance.employee_profile_id === selected.id && balance.leave_type_id === leaveTypeId && balance.year === new Date().getFullYear());
    setAllocationValue(String(current?.allocated ?? 0));
    setAllocationModal({ leaveTypeId, leaveTypeName });
  };
  const saveLeaveAllocation = async () => {
    if (!supabase || !selected || !canManage || !allocationModal) return;
    const allocated = Number(allocationValue);
    if (!Number.isFinite(allocated) || allocated < 0) { onNotice('Enter a valid non-negative allocation.'); return; }
    const current = leaveBalances.find((balance) => balance.employee_profile_id === selected.id && balance.leave_type_id === allocationModal.leaveTypeId && balance.year === new Date().getFullYear());
    const { error } = await supabase.from('leave_balances').upsert({ workspace_id: workspaceId, employee_profile_id: selected.id, leave_type_id: allocationModal.leaveTypeId, year: new Date().getFullYear(), allocated, used: current?.used ?? 0 }, { onConflict: 'employee_profile_id,leave_type_id,year' });
    if (error) onNotice(error.message); else { setAllocationModal(null); await load(); }
  };

  return <><ModuleFrame icon={BriefcaseBusiness} title="Employee Records" subtitle={canManage ? 'People, leave, documents, and performance' : 'Your employee profile and leave'} theme={theme} scroll={false}>
    <Segmented options={[['people', canManage ? 'People' : 'Profile'], ['leave', 'Approvals'], ['documents', 'Documents'], ['performance', 'Performance'], ...(canManagePayroll ? [['compensation', 'Compensation']] : [])]} value={tab} onChange={(value) => setTab(value as typeof tab)} theme={theme} />
    {tab === 'people' && <div className={cn('mt-5 grid min-h-0 max-h-[calc(100dvh-310px)] gap-5 overflow-hidden', canManage ? 'lg:grid-cols-[280px_minmax(0,1fr)]' : 'w-full')}>
      {canManage && <div className="min-h-0 overflow-hidden"><label className={cn('flex h-10 items-center gap-2 rounded-lg border px-3', panel(theme))}><Search className="h-4 w-4" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search employees" className="min-w-0 flex-1 bg-transparent text-sm outline-none" /></label><div className="mt-3 max-h-[calc(100dvh-370px)] space-y-1 overflow-y-auto pb-20 pr-1 scroll-area">{filtered.map((employee) => <button key={employee.id} onClick={() => setSelectedId(employee.id)} className={cn('flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left', selectedId === employee.id ? 'bg-[var(--accent-soft)] text-[var(--accent-strong)]' : theme === 'dark' ? 'hover:bg-white/5' : 'hover:bg-[#F0EDF3]')}><MiniAvatar profile={profiles[employee.user_id]} /><span className="min-w-0"><strong className="block truncate text-sm">{employeeName(employee, profiles)}</strong><span className={cn('block truncate text-xs', muted(theme))}>{hrPersonLabel(membershipRoleByUserId.get(employee.user_id))}</span></span></button>)}</div></div>}
      {editing && <div className={cn('min-h-0 max-h-[calc(100dvh-310px)] overflow-y-auto rounded-lg border p-5 pb-24 scroll-area', panel(theme))}><div className="mb-5 flex items-center gap-3"><MiniAvatar profile={profiles[editing.user_id]} large /><div><h3 className="text-lg font-bold">{employeeName(editing, profiles)}</h3><p className={cn('text-sm', muted(theme))}>{profiles[editing.user_id]?.email}</p></div></div><div className="grid gap-4 sm:grid-cols-2"><Field label="First name" value={editing.first_name ?? ''} onChange={(value) => setEditing({ ...editing, first_name: value })} theme={theme} /><Field label="Last name" value={editing.last_name ?? ''} onChange={(value) => setEditing({ ...editing, last_name: value })} theme={theme} /><Field label="Contact number" value={editing.contact_number ?? ''} onChange={(value) => setEditing({ ...editing, contact_number: value })} theme={theme} /><Field label="Birthday" type="date" value={editing.birthday ?? ''} onChange={(value) => setEditing({ ...editing, birthday: value || null })} theme={theme} /><Field label="Address" value={editing.address ?? ''} onChange={(value) => setEditing({ ...editing, address: value })} theme={theme} wide /><Field label="Emergency contact" value={editing.emergency_contact_name ?? ''} onChange={(value) => setEditing({ ...editing, emergency_contact_name: value })} theme={theme} /><Field label="Emergency number" value={editing.emergency_contact_number ?? ''} onChange={(value) => setEditing({ ...editing, emergency_contact_number: value })} theme={theme} />{canManage && <><Field label="Employee number" value={editing.employee_number ?? ''} onChange={(value) => setEditing({ ...editing, employee_number: value || null })} theme={theme} /><Field label="Department (used in reports)" value={editing.department ?? ''} onChange={(value) => setEditing({ ...editing, department: value || null })} theme={theme} /><Field label="Position" value={editing.position ?? ''} onChange={(value) => setEditing({ ...editing, position: value || null })} theme={theme} /><Field label="Hire date" type="date" value={editing.hire_date ?? ''} onChange={(value) => setEditing({ ...editing, hire_date: value || null })} theme={theme} /><SelectField label="Employment type" value={editing.employment_type ?? ''} options={['', 'full_time', 'part_time', 'contractor', 'temporary', 'intern']} onChange={(value) => setEditing({ ...editing, employment_type: value || null })} theme={theme} /><SelectField label="Overtime Classification" value={editing.exemption_status ?? 'non_exempt'} options={['non_exempt', 'exempt']} optionLabels={{ non_exempt: 'Non-exempt', exempt: 'Exempt' }} onChange={(value) => setEditing({ ...editing, exemption_status: value as 'exempt' | 'non_exempt' })} theme={theme} /><SelectField label="Status" value={editing.employment_status} options={['active', 'inactive', 'on_leave', 'terminated']} onChange={(value) => setEditing({ ...editing, employment_status: value })} theme={theme} /><label className="block"><span className={cn('mb-1 block text-xs font-semibold', muted(theme))}>Manager</span><select value={editing.manager_user_id ?? ''} onChange={(event) => setEditing({ ...editing, manager_user_id: event.target.value || null })} className={cn('h-11 w-full rounded-lg border px-3 text-sm', panel(theme))}><option value="">Not assigned</option>{employees.filter((employee) => employee.id !== editing.id).map((employee) => <option key={employee.id} value={employee.user_id}>{employeeName(employee, profiles)}</option>)}</select></label></>}</div><button onClick={() => void saveProfile()} disabled={saving} className="mt-5 h-11 rounded-lg bg-[var(--accent)] px-5 text-sm font-bold text-[var(--accent-ink)]">Save profile</button></div>}
    </div>}
    {tab === 'leave' && <div className="mt-5 min-h-0 max-h-[calc(100dvh-310px)] overflow-y-auto pb-24 pr-1 scroll-area"><div className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{leaveTypes.map((type) => { const balance = leaveBalances.find((item) => item.employee_profile_id === selected?.id && item.leave_type_id === type.id && item.year === new Date().getFullYear()); const remaining = Number(balance?.allocated ?? type.annual_allowance) - Number(balance?.used ?? 0); return <button key={type.id} type="button" onClick={() => openAllocationModal(type.id, type.name)} disabled={!canManage} className={cn('rounded-lg border p-4 text-left', panel(theme))}><span className={cn('text-xs font-semibold', muted(theme))}>{type.name}</span><strong className="mt-1 block text-xl">{remaining} days</strong></button>; })}</div><div className="mb-4 flex items-center justify-between"><div><h3 className="font-bold">{canApproveLeave ? 'Approvals' : 'My Requests'}</h3><p className={cn('text-sm', muted(theme))}>{leaveRequests.length} requests</p></div>{canRequestLeave && <button onClick={() => openLeaveModal()} className="inline-flex h-10 items-center gap-2 rounded-lg bg-[var(--accent)] px-4 text-sm font-bold text-[var(--accent-ink)]"><Plus className="h-4 w-4" />Request Leave</button>}</div><DataTable headers={['Employee', 'Type', 'Dates', 'Days', 'Status', 'Actions']} theme={theme}>{leaveRequests.map((request) => { const requestEmployee = employees.find((employee) => employee.id === request.employee_profile_id); const isOwnRequest = requestEmployee?.user_id === userId; const canEditRequest = canApproveLeave || (isOwnRequest && request.status === 'pending'); const canCancelRequest = isOwnRequest && request.status === 'pending'; const canDeleteRequest = canApproveLeave; return <tr key={request.id} className={cn('border-b last:border-0', border(theme))}><Cell strong>{employeeName(requestEmployee, profiles)}</Cell><Cell>{leaveTypes.find((type) => type.id === request.leave_type_id)?.name ?? 'Leave'}</Cell><Cell>{formatDate(request.start_date)} - {formatDate(request.end_date)}</Cell><Cell>{request.days}</Cell><Cell><StatusPill value={request.status} /></Cell><Cell><div className="flex flex-wrap gap-2">{canEditRequest && <IconAction label="Edit leave request" icon={Pencil} onClick={() => openLeaveModal(request)} />}{canApproveLeave && request.status === 'pending' && <><IconAction label="Approve" icon={Check} onClick={() => void reviewLeave(request.id, 'approved')} /><IconAction label="Deny" icon={X} onClick={() => void reviewLeave(request.id, 'rejected')} /></>}{canCancelRequest && <IconAction label="Cancel request" icon={X} onClick={() => void cancelLeave(request.id)} />}{canDeleteRequest && <IconAction label="Delete leave request" icon={Trash2} onClick={() => deleteLeave(request.id)} />}{!canEditRequest && !canApproveLeave && !canCancelRequest && !canDeleteRequest && <span className={muted(theme)}>—</span>}</div></Cell></tr>; })}</DataTable><div className="mt-8"><div className="mb-4 flex items-center justify-between"><div><h3 className="font-bold">Overtime Approvals</h3><p className={cn('text-sm', muted(theme))}>{overtimeRequests.length} requests</p></div>{canRequestLeave && <button onClick={() => openOvertimeModal()} className="inline-flex h-10 items-center gap-2 rounded-lg bg-[var(--accent)] px-4 text-sm font-bold text-[var(--accent-ink)]"><Plus className="h-4 w-4" />Request Overtime</button>}</div><DataTable headers={['Employee', 'Date', 'Hours', 'Reason', 'Status', 'Actions']} theme={theme}>{overtimeRequests.map((request) => { const requestEmployee = employees.find((employee) => employee.id === request.employee_profile_id); const isOwnRequest = requestEmployee?.user_id === userId; const canEditRequest = canApproveLeave || (isOwnRequest && request.status === 'pending'); const canCancelRequest = isOwnRequest && request.status === 'pending'; const canDeleteRequest = canApproveLeave; return <tr key={request.id} className={cn('border-b last:border-0', border(theme))}><Cell strong>{employeeName(requestEmployee, profiles)}</Cell><Cell>{formatDate(request.work_date)}</Cell><Cell>{Number(request.hours).toFixed(2)}</Cell><Cell>{request.reason || '—'}</Cell><Cell><StatusPill value={request.status} /></Cell><Cell><div className="flex flex-wrap gap-2">{canEditRequest && <IconAction label="Edit overtime request" icon={Pencil} onClick={() => openOvertimeModal(request)} />}{canApproveLeave && request.status === 'pending' && <><IconAction label="Approve" icon={Check} onClick={() => void reviewOvertime(request.id, 'approved')} /><IconAction label="Deny" icon={X} onClick={() => void reviewOvertime(request.id, 'rejected')} /></>}{canCancelRequest && <IconAction label="Cancel request" icon={X} onClick={() => void cancelOvertime(request.id)} />}{canDeleteRequest && <IconAction label="Delete overtime request" icon={Trash2} onClick={() => deleteOvertime(request.id)} />}{!canEditRequest && !canApproveLeave && !canCancelRequest && !canDeleteRequest && <span className={muted(theme)}>—</span>}</div></Cell></tr>; })}</DataTable>{overtimeRequests.length === 0 && <p className={cn('mt-3 rounded-lg border border-dashed p-4 text-sm', muted(theme))}>No overtime requests yet.</p>}</div></div>}
    {tab === 'documents' && <DocumentPanel workspaceId={workspaceId} userId={userId} employee={selected} profiles={profiles} canManage={canManage} theme={theme} onNotice={onNotice} />}
    {tab === 'performance' && <PerformancePanel workspaceId={workspaceId} userId={userId} employee={selected} profiles={profiles} canManage={canManage} theme={theme} onNotice={onNotice} />}
    {tab === 'compensation' && canManagePayroll && <CompensationPanel workspaceId={workspaceId} userId={userId} employee={selected} profiles={profiles} canManage={canManagePayroll} theme={theme} onNotice={onNotice} />}
  </ModuleFrame>
    {leaveModal && <WorkforceModal title={leaveModal.mode === 'edit' ? 'Edit Leave Request' : 'Request Leave'} theme={theme} onClose={() => setLeaveModal(null)} footer={<><button onClick={() => setLeaveModal(null)} className={cn('h-10 rounded-lg border px-4 text-sm font-semibold', buttonSurface(theme))}>Cancel</button><button onClick={() => void saveLeaveRequest()} className="h-10 rounded-lg bg-[var(--accent)] px-4 text-sm font-bold text-[var(--accent-ink)]">Save Request</button></>}><div className="grid gap-4 sm:grid-cols-2"><div className="sm:col-span-2"><SelectField label="Leave Type" value={leaveDraft.leave_type_id} options={leaveTypes.map((type) => type.id)} optionLabels={Object.fromEntries(leaveTypes.map((type) => [type.id, type.name]))} onChange={(value) => setLeaveDraft({ ...leaveDraft, leave_type_id: value })} theme={theme} /></div><Field label="Start Date" type="date" value={leaveDraft.start_date} onChange={(value) => setLeaveDraft({ ...leaveDraft, start_date: value, end_date: leaveDraft.end_date || value })} theme={theme} /><Field label="End Date" type="date" value={leaveDraft.end_date} onChange={(value) => setLeaveDraft({ ...leaveDraft, end_date: value })} theme={theme} /><Field label="Reason" value={leaveDraft.reason} onChange={(value) => setLeaveDraft({ ...leaveDraft, reason: value })} theme={theme} wide /></div></WorkforceModal>}
    {overtimeModal && <WorkforceModal title={overtimeModal.mode === 'edit' ? 'Edit Overtime Request' : 'Request Overtime'} theme={theme} onClose={() => setOvertimeModal(null)} footer={<><button onClick={() => setOvertimeModal(null)} className={cn('h-10 rounded-lg border px-4 text-sm font-semibold', buttonSurface(theme))}>Cancel</button><button onClick={() => void saveOvertimeRequest()} className="h-10 rounded-lg bg-[var(--accent)] px-4 text-sm font-bold text-[var(--accent-ink)]">Save Request</button></>}><div className="grid gap-4 sm:grid-cols-2"><Field label="Overtime Date" type="date" value={overtimeDraft.work_date} onChange={(value) => setOvertimeDraft({ ...overtimeDraft, work_date: value })} theme={theme} /><Field label="Hours" type="number" value={overtimeDraft.hours} onChange={(value) => setOvertimeDraft({ ...overtimeDraft, hours: value })} theme={theme} /><Field label="Reason" value={overtimeDraft.reason} onChange={(value) => setOvertimeDraft({ ...overtimeDraft, reason: value })} theme={theme} wide /></div></WorkforceModal>}
    {allocationModal && <WorkforceModal title={`Set ${allocationModal.leaveTypeName} Allocation`} theme={theme} onClose={() => setAllocationModal(null)} footer={<><button onClick={() => setAllocationModal(null)} className={cn('h-10 rounded-lg border px-4 text-sm font-semibold', buttonSurface(theme))}>Cancel</button><button onClick={() => void saveLeaveAllocation()} className="h-10 rounded-lg bg-[var(--accent)] px-4 text-sm font-bold text-[var(--accent-ink)]">Save Allocation</button></>}><Field label="Annual days" type="number" value={allocationValue} onChange={setAllocationValue} theme={theme} /></WorkforceModal>}
    {confirmDialog && <WorkforceConfirmModal dialog={confirmDialog} theme={theme} onClose={() => setConfirmDialog(null)} onNotice={onNotice} />}
  </>;
}

function PayrollPage({ workspaceId, userId, role, profiles, capabilities, theme, onNotice }: WorkforceProps) {
  const [periods, setPeriods] = useState<PayrollPeriod[]>([]); const [items, setItems] = useState<PayrollItem[]>([]); const [employees, setEmployees] = useState<EmployeeProfile[]>([]); const [settings, setSettings] = useState<WorkforceSettings | null>(null); const [rules, setRules] = useState<PayrollRule[]>([]); const [selectedPeriod, setSelectedPeriod] = useState(''); const [busy, setBusy] = useState(false);
  const [periodModalOpen, setPeriodModalOpen] = useState(false);
  const [editingPeriodId, setEditingPeriodId] = useState('');
  const [periodDraft, setPeriodDraft] = useState({ period_start: monthStart(), period_end: today(), pay_date: today() });
  const [ruleModalOpen, setRuleModalOpen] = useState(false);
  const [ruleDraft, setRuleDraft] = useState({ name: '', rule_kind: 'deduction' as 'earning' | 'deduction', calculation_type: 'percentage' as 'fixed' | 'percentage', value: '0' });
  const [itemModal, setItemModal] = useState<PayrollItem | null>(null);
  const [itemDraft, setItemDraft] = useState({ regular_hours: '0', overtime_hours: '0', gross_pay: '0', deductions: '0', net_pay: '0' });
  const [confirmDialog, setConfirmDialog] = useState<WorkforceConfirmState | null>(null);
  const canManage = role === 'owner' || (role === 'admin' && Boolean(capabilities?.manage_payroll));
  const canApprove = role === 'owner' || (role === 'admin' && Boolean(capabilities?.approve_payroll));
  const load = useCallback(async () => { if (!supabase) return; const [p, i, e, s, r] = await Promise.all([supabase.from('payroll_periods').select('*').eq('workspace_id', workspaceId).order('period_start', { ascending: false }), supabase.from('payroll_items').select('*').eq('workspace_id', workspaceId), supabase.from('employee_profiles').select('*').eq('workspace_id', workspaceId), supabase.from('workforce_settings').select('*').eq('workspace_id', workspaceId).maybeSingle(), supabase.from('payroll_rules').select('*').eq('workspace_id', workspaceId).order('name')]); const error = p.error ?? i.error ?? e.error ?? s.error ?? r.error; if (error) return onNotice(error.message); setPeriods((p.data ?? []) as PayrollPeriod[]); setItems((i.data ?? []) as PayrollItem[]); setEmployees((e.data ?? []) as EmployeeProfile[]); setSettings(s.data as WorkforceSettings | null); setRules((r.data ?? []) as PayrollRule[]); setSelectedPeriod((current) => current || p.data?.[0]?.id || ''); }, [onNotice, workspaceId]);
  useEffect(() => { void load(); }, [load]);
  useWorkforceRealtime(workspaceId, 'payroll_periods,payroll_items,payroll_rules', load);
  const period = periods.find((item) => item.id === selectedPeriod); const periodItems = items.filter((item) => item.payroll_period_id === selectedPeriod); const formatter = new Intl.NumberFormat(settings?.locale ?? 'en-US', { style: 'currency', currency: settings?.currency_code ?? 'USD' });
  const createPeriod = () => {
    const start = monthStart();
    const end = today();
    setEditingPeriodId('');
    setPeriodDraft({ period_start: start, period_end: end, pay_date: end });
    setPeriodModalOpen(true);
  };
  const editPeriod = () => {
    if (!period) return;
    setEditingPeriodId(period.id);
    setPeriodDraft({ period_start: period.period_start, period_end: period.period_end, pay_date: period.pay_date });
    setPeriodModalOpen(true);
  };
  const deletePeriod = () => {
    if (!supabase || !period || !canManage) return;
    const target = period;
    setConfirmDialog({
      title: 'Delete Preparation Period?',
      body: `This removes ${target.name} and its draft summary records. This cannot be undone.`,
      confirmLabel: 'Delete Period',
      onConfirm: async () => {
        const { error } = await supabase.from('payroll_periods').delete().eq('id', target.id);
        if (error) throw new Error(error.message);
        setSelectedPeriod('');
        await load();
      },
    });
  };
  const savePeriod = async () => {
    if (!supabase || !settings) return;
    if (!periodDraft.period_start || !periodDraft.period_end || !periodDraft.pay_date) { onNotice('Enter a period start, period end, and pay date.'); return; }
    const payload = { name: `${formatDate(periodDraft.period_start)} – ${formatDate(periodDraft.period_end)}`, period_start: periodDraft.period_start, period_end: periodDraft.period_end, pay_date: periodDraft.pay_date, currency_code: settings.currency_code };
    const result = editingPeriodId
      ? await supabase.from('payroll_periods').update(payload).eq('id', editingPeriodId)
      : await supabase.from('payroll_periods').insert({ ...payload, workspace_id: workspaceId, created_by: userId });
    if (result.error) onNotice(result.error.message); else { setPeriodModalOpen(false); setEditingPeriodId(''); await load(); }
  };
  const generate = async () => { if (!supabase || !period) return; setBusy(true); const { data, error } = await supabase.rpc('calculate_payroll', { target_payroll_period_id: period.id }); setBusy(false); if (error) onNotice(error.message); else { onNotice(`Payroll preparation draft created for ${data ?? 0} employees.`); await load(); } };
  const setStatus = async (status: 'approved' | 'paid') => { if (!supabase || !period) return; const { error } = await supabase.rpc('set_payroll_period_status', { target_payroll_period_id: period.id, requested_status: status }); if (error) onNotice(error.message); else await load(); };
  const saveHubSettings = async () => { if (!supabase || !settings || role !== 'owner') return; const { error } = await supabase.from('workforce_settings').update({ country_code: settings.country_code, currency_code: settings.currency_code, locale: settings.locale, timezone: settings.timezone, payroll_frequency: settings.payroll_frequency, updated_at: new Date().toISOString() }).eq('workspace_id', workspaceId); if (error) onNotice(error.message); else onNotice('Payroll preparation settings saved.'); };
  const addRule = () => { setRuleDraft({ name: '', rule_kind: 'deduction', calculation_type: 'percentage', value: '0' }); setRuleModalOpen(true); };
  const saveRule = async () => {
    if (!supabase || !settings) return;
    const value = Number(ruleDraft.value);
    if (!ruleDraft.name.trim() || !Number.isFinite(value) || value < 0) { onNotice('Enter an item name and a valid non-negative value.'); return; }
    const { error } = await supabase.from('payroll_rules').insert({ workspace_id: workspaceId, name: ruleDraft.name.trim(), rule_kind: ruleDraft.rule_kind, calculation_type: ruleDraft.calculation_type, value, country_code: settings.country_code });
    if (error) onNotice(error.message); else { setRuleModalOpen(false); await load(); }
  };
  const deleteRule = (ruleId: string) => {
    if (!supabase) return;
    setConfirmDialog({
      title: 'Delete preparation rule?',
      body: 'This preparation rule will be removed from future draft summaries.',
      confirmLabel: 'Continue',
      onConfirm: async () => {
        const { error } = await supabase.from('payroll_rules').delete().eq('id', ruleId);
        if (error) throw new Error(error.message);
        await load();
      },
    });
  };
  const editPayrollItem = (item: PayrollItem) => {
    setItemDraft({
      regular_hours: String(item.regular_hours ?? 0),
      overtime_hours: String(item.overtime_hours ?? 0),
      gross_pay: String(item.gross_pay ?? 0),
      deductions: String(item.deductions ?? 0),
      net_pay: String(item.net_pay ?? 0),
    });
    setItemModal(item);
  };
  const savePayrollItem = async () => {
    if (!supabase || !itemModal || !canManage) return;
    const payload = {
      regular_hours: Number(itemDraft.regular_hours || 0),
      overtime_hours: Number(itemDraft.overtime_hours || 0),
      gross_pay: Number(itemDraft.gross_pay || 0),
      deductions: Number(itemDraft.deductions || 0),
      net_pay: Number(itemDraft.net_pay || 0),
    };
    if (Object.values(payload).some((value) => !Number.isFinite(value))) { onNotice('Enter valid payroll amounts.'); return; }
    const { error } = await supabase.from('payroll_items').update(payload).eq('id', itemModal.id);
    if (error) onNotice(error.message); else { setItemModal(null); await load(); }
  };
  const deletePayrollItem = (item: PayrollItem) => {
    if (!supabase || !canManage) return;
    setConfirmDialog({
      title: 'Delete payroll draft line?',
      body: `This draft line for ${employeeName(employees.find((employee) => employee.id === item.employee_profile_id), profiles)} will be permanently removed from this preparation period.`,
      confirmLabel: 'Continue',
      onConfirm: async () => {
        const { error } = await supabase.from('payroll_items').delete().eq('id', item.id);
        if (error) throw new Error(error.message);
        await load();
      },
    });
  };
  return <>
  <ModuleFrame icon={Banknote} title="Payroll Preparation" subtitle={canManage ? 'Owner-reviewed draft summaries and compensation records' : 'Your draft compensation summaries'} theme={theme}>
    <div className="mb-5 grid gap-4 xl:grid-cols-2">
      {role === 'owner' && settings && <details className={cn('rounded-lg border p-4', panel(theme))}><summary className="cursor-pointer font-bold">Hub Payroll Preparation Settings</summary><div className="mt-4 grid gap-3 md:grid-cols-2"><Field label="Country" value={settings.country_code} onChange={(value) => setSettings({ ...settings, country_code: value.toUpperCase() })} theme={theme} /><Field label="Currency" value={settings.currency_code} onChange={(value) => setSettings({ ...settings, currency_code: value.toUpperCase() })} theme={theme} /><Field label="Locale" value={settings.locale} onChange={(value) => setSettings({ ...settings, locale: value })} theme={theme} /><Field label="Time Zone" value={settings.timezone} onChange={(value) => setSettings({ ...settings, timezone: value })} theme={theme} /><SelectField label="Frequency" value={settings.payroll_frequency} options={PAYROLL_FREQUENCY_OPTIONS} optionLabels={PAYROLL_FREQUENCY_LABELS} onChange={(value) => setSettings({ ...settings, payroll_frequency: value })} theme={theme} /></div><button onClick={() => void saveHubSettings()} className="mt-4 h-10 rounded-lg bg-[var(--accent)] px-4 text-sm font-bold text-[var(--accent-ink)]">Save Hub Settings</button></details>}
      {canManage && <details className={cn('rounded-lg border p-4', panel(theme))}><summary className="cursor-pointer font-bold">Preparation Rules ({rules.length})</summary><div className="mt-3 space-y-2">{rules.map((rule) => <div key={rule.id} className="flex items-center justify-between gap-3 rounded-lg border border-current/10 px-3 py-2"><span><strong className="block text-sm">{rule.name}</strong><span className={cn('text-xs capitalize', muted(theme))}>{rule.rule_kind} · {rule.calculation_type} · {rule.value}{rule.calculation_type === 'percentage' ? '%' : ` ${settings?.currency_code ?? ''}`}</span></span><button aria-label="Delete preparation item" title="Delete preparation item" onClick={() => void deleteRule(rule.id)} className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-[#FCA5A5] text-[#B91C1C]"><Trash2 className="h-3.5 w-3.5" /></button></div>)}</div><button onClick={() => void addRule()} className={cn('mt-3 inline-flex h-9 items-center gap-2 rounded-lg border px-3 text-sm font-semibold', buttonSurface(theme))}><Plus className="h-4 w-4" />Add Item</button></details>}
    </div>
    <div className="flex flex-wrap items-center justify-between gap-3"><select value={selectedPeriod} onChange={(event) => setSelectedPeriod(event.target.value)} className={cn('h-11 min-w-64 rounded-lg border px-3 text-sm', panel(theme))}><option value="">Select preparation period</option>{periods.map((item) => <option key={item.id} value={item.id}>{item.name} · {item.status}</option>)}</select>{canManage && <div className="flex flex-wrap gap-2"><button onClick={() => void createPeriod()} className={cn('inline-flex h-10 items-center gap-2 rounded-lg border px-4 text-sm font-semibold', buttonSurface(theme))}><Plus className="h-4 w-4" />New Draft Period</button>{period && <><IconAction label="Edit preparation period" icon={Pencil} onClick={() => editPeriod()} /><IconAction label="Delete preparation period" icon={Trash2} onClick={() => deletePeriod()} /><button onClick={() => void generate()} disabled={busy} className="inline-flex h-10 items-center gap-2 rounded-lg bg-[var(--accent)] px-4 text-sm font-bold text-[var(--accent-ink)]"><RefreshCw className="h-4 w-4" />Prepare Draft</button></>}</div>}</div>
    {period && <><div className="mt-5 grid gap-4 sm:grid-cols-3"><Metric label="Gross Draft" value={formatter.format(periodItems.reduce((sum, item) => sum + Number(item.gross_pay), 0))} theme={theme} /><Metric label="Net Draft" value={formatter.format(periodItems.reduce((sum, item) => sum + Number(item.net_pay), 0))} theme={theme} /><Metric label="Status" value={period.status} accent theme={theme} /></div>{canApprove && period.status === 'calculated' && <button onClick={() => void setStatus('approved')} className="mt-4 h-10 rounded-lg bg-[#16A34A] px-4 text-sm font-bold text-white">Approve Draft</button>}{canManage && period.status === 'approved' && <button onClick={() => void setStatus('paid')} className="mt-4 h-10 rounded-lg bg-[var(--accent)] px-4 text-sm font-bold text-[var(--accent-ink)]">Mark Recorded</button>}<div className="mt-5"><DataTable headers={['Employee', 'Regular Hours', 'Overtime', 'Gross', 'Deductions', 'Net', 'Actions']} theme={theme}>{periodItems.map((item) => <tr key={item.id} className={cn('border-b last:border-0', border(theme))}><Cell strong>{employeeName(employees.find((employee) => employee.id === item.employee_profile_id), profiles)}</Cell><Cell>{Number(item.regular_hours).toFixed(2)}</Cell><Cell>{Number(item.overtime_hours).toFixed(2)}</Cell><Cell>{formatter.format(item.gross_pay)}</Cell><Cell>{formatter.format(item.deductions)}</Cell><Cell strong>{formatter.format(item.net_pay)}</Cell><Cell>{canManage ? <div className="flex gap-2"><IconAction label="Edit payroll draft line" icon={Pencil} onClick={() => editPayrollItem(item)} /><IconAction label="Delete payroll draft line" icon={Trash2} onClick={() => deletePayrollItem(item)} /></div> : <span className={muted(theme)}>—</span>}</Cell></tr>)}</DataTable></div></>}
    {!period && <EmptyState icon={Banknote} title="No Preparation Period Selected" body={canManage ? 'Create the first preparation period to build an owner-reviewed draft from attendance records.' : 'Your draft summaries will appear here.'} theme={theme} />}
  </ModuleFrame>
  {periodModalOpen && <WorkforceModal title={editingPeriodId ? 'Edit Preparation Period' : 'New Draft Period'} theme={theme} onClose={() => { setPeriodModalOpen(false); setEditingPeriodId(''); }} footer={<><button type="button" onClick={() => { setPeriodModalOpen(false); setEditingPeriodId(''); }} className={cn('h-10 rounded-lg border px-4 text-sm font-semibold', buttonSurface(theme))}>Cancel</button><button type="button" onClick={() => void savePeriod()} className="h-10 rounded-lg bg-[var(--accent)] px-4 text-sm font-bold text-[var(--accent-ink)]">{editingPeriodId ? 'Save Period' : 'Create Period'}</button></>}><div className="grid gap-4 sm:grid-cols-3"><Field label="Period Start" type="date" value={periodDraft.period_start} onChange={(value) => setPeriodDraft({ ...periodDraft, period_start: value })} theme={theme} /><Field label="Period End" type="date" value={periodDraft.period_end} onChange={(value) => setPeriodDraft({ ...periodDraft, period_end: value, pay_date: periodDraft.pay_date || value })} theme={theme} /><Field label="Pay Date" type="date" value={periodDraft.pay_date} onChange={(value) => setPeriodDraft({ ...periodDraft, pay_date: value })} theme={theme} /></div></WorkforceModal>}
  {itemModal && <WorkforceModal title="Edit Payroll Draft Line" theme={theme} onClose={() => setItemModal(null)} footer={<><button type="button" onClick={() => setItemModal(null)} className={cn('h-10 rounded-lg border px-4 text-sm font-semibold', buttonSurface(theme))}>Cancel</button><button type="button" onClick={() => void savePayrollItem()} className="h-10 rounded-lg bg-[var(--accent)] px-4 text-sm font-bold text-[var(--accent-ink)]">Save Line</button></>}><div className="grid gap-4 sm:grid-cols-2"><Field label="Regular Hours" type="number" value={itemDraft.regular_hours} onChange={(value) => setItemDraft({ ...itemDraft, regular_hours: value })} theme={theme} /><Field label="Overtime Hours" type="number" value={itemDraft.overtime_hours} onChange={(value) => setItemDraft({ ...itemDraft, overtime_hours: value })} theme={theme} /><Field label="Gross Pay" type="number" value={itemDraft.gross_pay} onChange={(value) => setItemDraft({ ...itemDraft, gross_pay: value })} theme={theme} /><Field label="Deductions" type="number" value={itemDraft.deductions} onChange={(value) => setItemDraft({ ...itemDraft, deductions: value })} theme={theme} /><Field label="Net Pay" type="number" value={itemDraft.net_pay} onChange={(value) => setItemDraft({ ...itemDraft, net_pay: value })} theme={theme} /></div></WorkforceModal>}
  {ruleModalOpen && <WorkforceModal title="Add Preparation Item" theme={theme} onClose={() => setRuleModalOpen(false)} footer={<><button type="button" onClick={() => setRuleModalOpen(false)} className={cn('h-10 rounded-lg border px-4 text-sm font-semibold', buttonSurface(theme))}>Cancel</button><button type="button" onClick={() => void saveRule()} className="h-10 rounded-lg bg-[var(--accent)] px-4 text-sm font-bold text-[var(--accent-ink)]">Save Item</button></>}><div className="grid gap-4 sm:grid-cols-2"><Field label="Item Name" value={ruleDraft.name} onChange={(value) => setRuleDraft({ ...ruleDraft, name: value })} theme={theme} /><SelectField label="Type" value={ruleDraft.rule_kind} options={['earning', 'deduction']} onChange={(value) => setRuleDraft({ ...ruleDraft, rule_kind: value as 'earning' | 'deduction' })} theme={theme} /><SelectField label="Calculation" value={ruleDraft.calculation_type} options={['percentage', 'fixed']} onChange={(value) => setRuleDraft({ ...ruleDraft, calculation_type: value as 'percentage' | 'fixed' })} theme={theme} /><Field label={ruleDraft.calculation_type === 'percentage' ? 'Percentage' : 'Fixed amount'} type="number" value={ruleDraft.value} onChange={(value) => setRuleDraft({ ...ruleDraft, value })} theme={theme} /></div></WorkforceModal>}
  {confirmDialog && <WorkforceConfirmModal dialog={confirmDialog} theme={theme} onClose={() => setConfirmDialog(null)} onNotice={onNotice} />}
  </>;
}

function ReportsPage({ workspaceId, role, profiles, capabilities, theme, onNotice }: WorkforceProps) {
  const [employees, setEmployees] = useState<EmployeeProfile[]>([]); const [entries, setEntries] = useState<TimeEntry[]>([]); const [leave, setLeave] = useState<LeaveRequest[]>([]); const [payroll, setPayroll] = useState<PayrollItem[]>([]); const [settings, setSettings] = useState<WorkforceSettings | null>(null); const [timeSettings, setTimeSettings] = useState<TimekeepingSettings | null>(null); const [holidays, setHolidays] = useState<WorkforceHoliday[]>([]); const [from, setFrom] = useState(monthStart()); const [to, setTo] = useState(today()); const [department, setDepartment] = useState('all'); const [employeeId, setEmployeeId] = useState('all'); const [holidayModalOpen, setHolidayModalOpen] = useState(false); const [holidayDraft, setHolidayDraft] = useState({ holiday_date: today(), name: '' }); const [entryModal, setEntryModal] = useState<TimeEntry | null>(null); const [entryDraft, setEntryDraft] = useState({ work_date: today(), clock_in: '', clock_out: '', break_seconds: '0' }); const [confirmDialog, setConfirmDialog] = useState<WorkforceConfirmState | null>(null);
  const canManageHolidays = role === 'owner' || Boolean(capabilities?.manage_hr);
  const canManageAttendance = role === 'owner' || Boolean(capabilities?.correct_attendance);
  const load = useCallback(async () => { if (!supabase) return; const [e, t, l, p, s, ts, h] = await Promise.all([supabase.from('employee_profiles').select('*').eq('workspace_id', workspaceId), supabase.from('time_entries').select('*').eq('workspace_id', workspaceId).gte('work_date', from).lte('work_date', to), supabase.from('leave_requests').select('*').eq('workspace_id', workspaceId).lte('start_date', to).gte('end_date', from), supabase.from('payroll_items').select('*').eq('workspace_id', workspaceId), supabase.from('workforce_settings').select('*').eq('workspace_id', workspaceId).maybeSingle(), supabase.from('timekeeping_settings').select('*').eq('workspace_id', workspaceId).maybeSingle(), supabase.from('workforce_holidays').select('*').eq('workspace_id', workspaceId).gte('holiday_date', from).lte('holiday_date', to).order('holiday_date')]); const error = e.error ?? t.error ?? l.error ?? p.error ?? s.error ?? ts.error ?? h.error; if (error) return onNotice(error.message); setEmployees((e.data ?? []) as EmployeeProfile[]); setEntries((t.data ?? []) as TimeEntry[]); setLeave((l.data ?? []) as LeaveRequest[]); setPayroll((p.data ?? []) as PayrollItem[]); setSettings(s.data as WorkforceSettings | null); setTimeSettings(ts.data as TimekeepingSettings | null); setHolidays((h.data ?? []) as WorkforceHoliday[]); }, [from, onNotice, to, workspaceId]); useEffect(() => { void load(); }, [load]);
  useWorkforceRealtime(workspaceId, 'employee_profiles,time_entries,leave_requests,payroll_items,workforce_holidays', load);
  const localToday = dateInTimezone(settings?.timezone ?? 'UTC'); const filteredEmployees = employees.filter((employee) => (department === 'all' || employee.department === department) && (employeeId === 'all' || employee.id === employeeId)); const ids = new Set(filteredEmployees.map((employee) => employee.id)); const filteredEntries = entries.filter((entry) => ids.has(entry.employee_profile_id)); const filteredLeave = leave.filter((request) => ids.has(request.employee_profile_id)); const filteredPayroll = payroll.filter((item) => ids.has(item.employee_profile_id)); const todayEntries = filteredEntries.filter((entry) => entry.work_date === localToday); const presentIds = new Set(todayEntries.map((entry) => entry.employee_profile_id)); const leaveTodayIds = new Set(filteredLeave.filter((request) => request.status === 'approved' && request.start_date <= localToday && request.end_date >= localToday).map((request) => request.employee_profile_id)); const holidayToday = holidays.some((holiday) => holiday.holiday_date === localToday); const scheduledToday = Boolean(timeSettings?.workdays?.includes(dayInTimezone(settings?.timezone ?? 'UTC')) && !holidayToday); const absent = scheduledToday ? filteredEmployees.filter((employee) => employee.employment_status === 'active' && !presentIds.has(employee.id) && !leaveTodayIds.has(employee.id)).length : 0; const startMinutes = parseTimeMinutes(timeSettings?.workday_start ?? '09:00') + Number(timeSettings?.grace_period_minutes ?? 0); const late = todayEntries.filter((entry) => timeMinutesInTimezone(entry.clock_in, settings?.timezone ?? 'UTC') > startMinutes).length; const totalHours = filteredEntries.reduce((sum, entry) => sum + workedHours(entry, Date.now()), 0); const overtime = filteredEntries.reduce((sum, entry) => sum + Math.max(0, workedHours(entry, Date.now()) - 8), 0); const formatter = new Intl.NumberFormat(settings?.locale ?? 'en-US', { style: 'currency', currency: settings?.currency_code ?? 'USD' }); const departments = [...new Set(employees.map((employee) => employee.department).filter(Boolean))] as string[];
  const addHoliday = () => { setHolidayDraft({ holiday_date: today(), name: '' }); setHolidayModalOpen(true); };
  const saveHoliday = async () => { if (!supabase) return; if (!holidayDraft.holiday_date || !holidayDraft.name.trim()) { onNotice('Enter a holiday date and name.'); return; } const { error } = await supabase.from('workforce_holidays').insert({ workspace_id: workspaceId, holiday_date: holidayDraft.holiday_date, name: holidayDraft.name.trim(), country_code: settings?.country_code, paid: true }); if (error) onNotice(error.message); else { setHolidayModalOpen(false); await load(); } };
  const deleteHoliday = (id: string) => {
    if (!supabase || !canManageHolidays) return;
    setConfirmDialog({
      title: 'Delete holiday?',
      body: 'This holiday will be removed from attendance reports for the selected date range.',
      confirmLabel: 'Continue',
      onConfirm: async () => {
        const { error } = await supabase.from('workforce_holidays').delete().eq('id', id);
        if (error) throw new Error(error.message);
        await load();
      },
    });
  };
  const openAttendanceEntry = (entry: TimeEntry) => {
    setEntryDraft({
      work_date: entry.work_date,
      clock_in: toDateTimeLocal(entry.clock_in),
      clock_out: entry.clock_out ? toDateTimeLocal(entry.clock_out) : '',
      break_seconds: String(entry.break_seconds ?? 0),
    });
    setEntryModal(entry);
  };
  const saveAttendanceEntry = async () => {
    if (!supabase || !entryModal || !canManageAttendance) return;
    const breakSeconds = Number(entryDraft.break_seconds || 0);
    if (!entryDraft.work_date || !entryDraft.clock_in || !Number.isFinite(breakSeconds) || breakSeconds < 0) { onNotice('Enter a valid attendance record.'); return; }
    const { error } = await supabase.from('time_entries').update({
      work_date: entryDraft.work_date,
      clock_in: fromDateTimeLocal(entryDraft.clock_in),
      clock_out: entryDraft.clock_out ? fromDateTimeLocal(entryDraft.clock_out) : null,
      break_seconds: breakSeconds,
    }).eq('id', entryModal.id);
    if (error) onNotice(error.message); else { setEntryModal(null); await load(); }
  };
  const deleteAttendanceEntry = (entry: TimeEntry) => {
    if (!supabase || !canManageAttendance) return;
    setConfirmDialog({
      title: 'Delete attendance record?',
      body: `This attendance record from ${formatDate(entry.work_date)} will be permanently removed.`,
      confirmLabel: 'Continue',
      onConfirm: async () => {
        const { error } = await supabase.from('time_entries').delete().eq('id', entry.id);
        if (error) throw new Error(error.message);
        await load();
      },
    });
  };
  return <>
    <ModuleFrame icon={Gauge} title="Attendance Reports" subtitle="Attendance records and workforce summaries" theme={theme}>
      <div className="mb-5 grid max-w-3xl items-end gap-3 sm:grid-cols-2 xl:grid-cols-[160px_160px_180px_150px]">
        <Field label="From" type="date" value={from} onChange={setFrom} theme={theme} compact />
        <Field label="To" type="date" value={to} onChange={setTo} theme={theme} compact />
        <SelectField label="Department" value={department} options={['all', ...departments]} onChange={setDepartment} theme={theme} compact />
        <label className="block w-40"><span className={cn('mb-1 block text-xs font-semibold', muted(theme))}>Employee</span><select aria-label="Employee filter" value={employeeId} onChange={(event) => setEmployeeId(event.target.value)} className={cn('h-10 w-full rounded-lg border px-3 text-sm', panel(theme))}><option value="all">All employees</option>{employees.map((employee) => <option key={employee.id} value={employee.id}>{employeeName(employee, profiles)}</option>)}</select></label>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><Metric label="Employees present" value={String(presentIds.size)} theme={theme} accent /><Metric label="Employees late" value={String(late)} theme={theme} /><Metric label="Employees absent" value={String(absent)} theme={theme} /><Metric label="Employees on leave" value={String(leaveTodayIds.size)} theme={theme} /><Metric label="Total hours" value={formatDuration(totalHours)} theme={theme} /><Metric label="Overtime" value={formatDuration(overtime)} theme={theme} /><Metric label="Draft payroll total" value={formatter.format(filteredPayroll.reduce((sum, item) => sum + Number(item.net_pay), 0))} theme={theme} /><Metric label="Pending leave" value={String(filteredLeave.filter((request) => request.status === 'pending').length)} theme={theme} /></div>
      <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]"><div><h3 className="mb-3 font-bold">Attendance summary</h3><DataTable headers={['Employee', 'Department', 'Days Recorded', 'Hours', 'Overtime', 'Actions']} theme={theme}>{filteredEmployees.map((employee) => { const own = filteredEntries.filter((entry) => entry.employee_profile_id === employee.id); const latestEntry = [...own].sort((a, b) => Date.parse(b.clock_in) - Date.parse(a.clock_in))[0]; const hours = own.reduce((sum, entry) => sum + workedHours(entry, Date.now()), 0); return <tr key={employee.id} className={cn('border-b last:border-0', border(theme))}><Cell strong>{employeeName(employee, profiles)}</Cell><Cell>{employee.department || '—'}</Cell><Cell>{new Set(own.map((entry) => entry.work_date)).size}</Cell><Cell>{formatDuration(hours)}</Cell><Cell>{formatDuration(own.reduce((sum, entry) => sum + Math.max(0, workedHours(entry, Date.now()) - 8), 0))}</Cell><Cell>{canManageAttendance && latestEntry ? <div className="flex gap-2"><IconAction label="Edit latest attendance record" icon={Pencil} onClick={() => openAttendanceEntry(latestEntry)} /><IconAction label="Delete latest attendance record" icon={Trash2} onClick={() => deleteAttendanceEntry(latestEntry)} /></div> : <span className={muted(theme)}>—</span>}</Cell></tr>; })}</DataTable></div><aside className={cn('h-fit rounded-lg border p-4', panel(theme))}><div className="flex items-center justify-between"><h3 className="font-bold">Holidays</h3>{canManageHolidays && <button aria-label="Add holiday" title="Add Holiday" onClick={() => addHoliday()} className={cn('inline-flex h-8 w-8 items-center justify-center rounded-md border', buttonSurface(theme))}><Plus className="h-4 w-4" /></button>}</div><div className="mt-3 space-y-2">{holidays.map((holiday) => <div key={holiday.id} className="flex items-center justify-between gap-2 text-sm"><span><strong className="block">{holiday.name}</strong><span className={muted(theme)}>{formatDate(holiday.holiday_date)}</span></span>{canManageHolidays && <button aria-label="Delete holiday" title="Delete holiday" onClick={() => deleteHoliday(holiday.id)} className="text-[#B91C1C]"><Trash2 className="h-4 w-4" /></button>}</div>)}{holidays.length === 0 && <p className={cn('text-sm', muted(theme))}>No holidays in this range.</p>}</div></aside></div>
    </ModuleFrame>
    {entryModal && <WorkforceModal title="Edit Attendance Record" theme={theme} onClose={() => setEntryModal(null)} footer={<><button type="button" onClick={() => setEntryModal(null)} className={cn('h-10 rounded-lg border px-4 text-sm font-semibold', buttonSurface(theme))}>Cancel</button><button type="button" onClick={() => void saveAttendanceEntry()} className="h-10 rounded-lg bg-[var(--accent)] px-4 text-sm font-bold text-[var(--accent-ink)]">Save Record</button></>}><div className="grid gap-4 sm:grid-cols-2"><Field label="Work Date" type="date" value={entryDraft.work_date} onChange={(value) => setEntryDraft({ ...entryDraft, work_date: value })} theme={theme} /><Field label="Clock In" type="datetime-local" value={entryDraft.clock_in} onChange={(value) => setEntryDraft({ ...entryDraft, clock_in: value })} theme={theme} /><Field label="Clock Out" type="datetime-local" value={entryDraft.clock_out} onChange={(value) => setEntryDraft({ ...entryDraft, clock_out: value })} theme={theme} /><Field label="Break Seconds" type="number" value={entryDraft.break_seconds} onChange={(value) => setEntryDraft({ ...entryDraft, break_seconds: value })} theme={theme} /></div></WorkforceModal>}
    {holidayModalOpen && <WorkforceModal title="Add holiday" theme={theme} onClose={() => setHolidayModalOpen(false)} footer={<><button type="button" onClick={() => setHolidayModalOpen(false)} className={cn('h-10 rounded-lg border px-4 text-sm font-semibold', buttonSurface(theme))}>Cancel</button><button type="button" onClick={() => void saveHoliday()} className="h-10 rounded-lg bg-[var(--accent)] px-4 text-sm font-bold text-[var(--accent-ink)]">Save Holiday</button></>}><div className="grid gap-4 sm:grid-cols-2"><Field label="Holiday Date" type="date" value={holidayDraft.holiday_date} onChange={(value) => setHolidayDraft({ ...holidayDraft, holiday_date: value })} theme={theme} /><Field label="Holiday Name" value={holidayDraft.name} onChange={(value) => setHolidayDraft({ ...holidayDraft, name: value })} theme={theme} /></div></WorkforceModal>}
    {confirmDialog && <WorkforceConfirmModal dialog={confirmDialog} theme={theme} onClose={() => setConfirmDialog(null)} onNotice={onNotice} />}
  </>;
}

function EmployeeContextHeader({ employee, profiles, theme, label }: { employee: EmployeeProfile | null; profiles: Record<string, AppProfile>; theme: Theme; label: string }) {
  if (!employee) return null;
  return <div className={cn('mb-4 flex items-center justify-between gap-3 rounded-lg border px-4 py-3', panel(theme))}><div className="flex min-w-0 items-center gap-3"><MiniAvatar profile={profiles[employee.user_id]} /><div className="min-w-0"><p className="truncate text-sm font-bold">{employeeName(employee, profiles)}</p><p className={cn('truncate text-xs', muted(theme))}>{label}</p></div></div><StatusPill value={employee.employment_status} /></div>;
}

function DocumentPanel({ workspaceId, userId, employee, profiles, canManage, theme, onNotice }: { workspaceId: string; userId: string; employee: EmployeeProfile | null; profiles: Record<string, AppProfile>; canManage: boolean; theme: Theme; onNotice: (message: string) => void }) {
  const [documents, setDocuments] = useState<{ id: string; document_type: string; filename: string; object_path: string; created_at: string }[]>([]);
  const [requests, setRequests] = useState<RecordChangeRequest[]>([]);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [editingDocument, setEditingDocument] = useState<{ id: string; document_type: string; filename: string; object_path: string; created_at: string } | null>(null);
  const [changeRequest, setChangeRequest] = useState<{ targetId: string; targetName: string } | null>(null);
  const [requestDraft, setRequestDraft] = useState({ request_type: 'update' as 'delete' | 'replace' | 'update', details: '' });
  const [documentDraft, setDocumentDraft] = useState({ document_type: 'other', filename: '' });
  const [confirmDialog, setConfirmDialog] = useState<WorkforceConfirmState | null>(null);
  const documentTypes = ['resume', 'offer_letter', 'employment_contract', 'nda', 'tax_form', 'identity', 'certificate', 'other'];
  const load = useCallback(async () => {
    if (!supabase || !employee) return;
    const [documentsResult, requestsResult] = await Promise.all([
      supabase.from('employee_documents').select('*').eq('employee_profile_id', employee.id).order('created_at', { ascending: false }),
      supabase.from('employee_record_change_requests').select('*').eq('employee_profile_id', employee.id).eq('target_table', 'employee_documents').order('created_at', { ascending: false }),
    ]);
    if (documentsResult.error || requestsResult.error) onNotice(documentsResult.error?.message ?? requestsResult.error?.message ?? 'Documents could not be loaded.');
    else { setDocuments(documentsResult.data ?? []); setRequests((requestsResult.data ?? []) as RecordChangeRequest[]); }
  }, [employee, onNotice]);
  useEffect(() => { void load(); }, [load]);
  useWorkforceRealtime(workspaceId, 'employee_documents,employee_record_change_requests', load);
  const queueUpload = (file: File) => { const validationError = validateWorkforceUpload(file); if (validationError) { onNotice(validationError); return; } setPendingFile(file); setDocumentDraft({ document_type: 'other', filename: file.name }); };
  const saveUpload = async () => { if (!supabase || !employee || !pendingFile) return; const path = `${workspaceId}/${employee.user_id}/documents/${crypto.randomUUID()}-${sanitizeWorkforceFilename(pendingFile.name)}`; const { error: uploadError } = await supabase.storage.from('employee-documents').upload(path, pendingFile, { contentType: pendingFile.type || 'application/octet-stream', upsert: false }); if (uploadError) return onNotice(uploadError.message); const { error } = await supabase.from('employee_documents').insert({ workspace_id: workspaceId, employee_profile_id: employee.id, document_type: documentDraft.document_type, filename: documentDraft.filename.trim() || pendingFile.name, object_path: path, uploaded_by: userId }); if (error) onNotice(error.message); else { setPendingFile(null); await load(); } };
  const openEdit = (document: { id: string; document_type: string; filename: string; object_path: string; created_at: string }) => { setEditingDocument(document); setDocumentDraft({ document_type: document.document_type, filename: document.filename }); };
  const saveEdit = async () => { if (!supabase || !editingDocument) return; const { error } = await supabase.from('employee_documents').update({ document_type: documentDraft.document_type, filename: documentDraft.filename.trim() || editingDocument.filename }).eq('id', editingDocument.id); if (error) onNotice(error.message); else { setEditingDocument(null); await load(); } };
  const deleteDocument = (document: { id: string; object_path: string; filename?: string }) => { if (!supabase || !canManage) return; setConfirmDialog({ title: 'Delete Document', body: `You are about to delete ${document.filename ?? 'this document'}. This action cannot be undone.`, confirmLabel: 'Continue', tone: 'danger', onConfirm: async () => { const { error } = await supabase.from('employee_documents').delete().eq('id', document.id); if (error) { onNotice(error.message); return; } await supabase.storage.from('employee-documents').remove([document.object_path]); await load(); } }); };
  const submitChangeRequest = async () => { if (!supabase || !employee || !changeRequest) return; const { error } = await supabase.from('employee_record_change_requests').insert({ workspace_id: workspaceId, employee_profile_id: employee.id, target_table: 'employee_documents', target_id: changeRequest.targetId, request_type: requestDraft.request_type, details: requestDraft.details.trim() || null, requested_by: userId }); if (error) onNotice(error.message); else { setChangeRequest(null); setRequestDraft({ request_type: 'update', details: '' }); onNotice('Request sent for approval.'); await load(); } };
  const reviewChangeRequest = async (id: string, status: 'approved' | 'rejected') => { if (!supabase || !canManage) return; const { error } = await supabase.from('employee_record_change_requests').update({ status, reviewed_by: userId, reviewed_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq('id', id); if (error) onNotice(error.message); else await load(); };
  if (!employee) return <EmptyState icon={FileUp} title="Select an employee" body="Choose an employee to view documents." theme={theme} />;
  const documentNames = Object.fromEntries(documents.map((document) => [document.id, document.filename]));
  return <div className="mt-5 min-h-0 max-h-[calc(100dvh-310px)] overflow-y-auto pb-24 pr-1 scroll-area"><EmployeeContextHeader employee={employee} profiles={profiles} theme={theme} label="Documents" /><label className={cn('inline-flex h-10 cursor-pointer items-center gap-2 rounded-lg border px-4 text-sm font-semibold', buttonSurface(theme))}><FileUp className="h-4 w-4" />Upload document<input type="file" className="hidden" onChange={(event) => { const file = event.target.files?.[0]; event.currentTarget.value = ''; if (file) queueUpload(file); }} /></label>{canManage && <ChangeRequestInbox requests={requests} targetNames={documentNames} theme={theme} onReview={reviewChangeRequest} />}<div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{documents.map((document) => <div key={document.id} className={cn('rounded-lg border p-4', panel(theme))}><div className="flex items-start justify-between gap-3"><span className="min-w-0"><strong className="block truncate text-sm">{document.filename}</strong><span className={cn('text-xs capitalize', muted(theme))}>{document.document_type.replaceAll('_', ' ')} · {formatDate(document.created_at)}</span></span>{canManage ? <span className="flex shrink-0 gap-2"><IconAction label="Edit document" icon={Pencil} onClick={() => openEdit(document)} /><IconAction label="Delete document" icon={Trash2} onClick={() => deleteDocument(document)} /></span> : <button onClick={() => setChangeRequest({ targetId: document.id, targetName: document.filename })} className={cn('inline-flex h-8 shrink-0 items-center gap-2 rounded-md border px-3 text-xs font-semibold', buttonSurface(theme))}><RefreshCw className="h-3.5 w-3.5" />Action</button>}</div></div>)}</div>{documents.length === 0 && <EmptyState icon={FileUp} title="No documents" body={canManage ? 'Upload employment records and certificates.' : 'Your employment documents will appear here.'} theme={theme} />}{changeRequest && <WorkforceModal title="Request document change" theme={theme} onClose={() => setChangeRequest(null)} footer={<><button onClick={() => setChangeRequest(null)} className={cn('h-10 rounded-lg border px-4 text-sm font-semibold', buttonSurface(theme))}>Cancel</button><button onClick={() => void submitChangeRequest()} className="h-10 rounded-lg bg-[var(--accent)] px-4 text-sm font-bold text-[var(--accent-ink)]">Send request</button></>}><p className={cn('mb-4 text-sm', muted(theme))}>{changeRequest.targetName}</p><div className="grid gap-4 sm:grid-cols-2"><SelectField label="Action needed" value={requestDraft.request_type} options={['update', 'replace', 'delete']} onChange={(value) => setRequestDraft({ ...requestDraft, request_type: value as 'delete' | 'replace' | 'update' })} theme={theme} /><Field label="Details" value={requestDraft.details} onChange={(value) => setRequestDraft({ ...requestDraft, details: value })} theme={theme} wide /></div></WorkforceModal>}{(pendingFile || editingDocument) && <WorkforceModal title={pendingFile ? 'Upload document' : 'Edit document'} theme={theme} onClose={() => { setPendingFile(null); setEditingDocument(null); }} footer={<><button onClick={() => { setPendingFile(null); setEditingDocument(null); }} className={cn('h-10 rounded-lg border px-4 text-sm font-semibold', buttonSurface(theme))}>Cancel</button><button onClick={() => void (pendingFile ? saveUpload() : saveEdit())} className="h-10 rounded-lg bg-[var(--accent)] px-4 text-sm font-bold text-[var(--accent-ink)]">Save document</button></>}><div className="grid gap-4 sm:grid-cols-2"><SelectField label="Document type" value={documentDraft.document_type} options={documentTypes} onChange={(value) => setDocumentDraft({ ...documentDraft, document_type: value })} theme={theme} /><Field label="File name" value={documentDraft.filename} onChange={(value) => setDocumentDraft({ ...documentDraft, filename: value })} theme={theme} /></div></WorkforceModal>}{confirmDialog && <WorkforceConfirmModal dialog={confirmDialog} theme={theme} onClose={() => setConfirmDialog(null)} onNotice={onNotice} />}</div>;
}

function PerformancePanel({ workspaceId, userId, employee, profiles, canManage, theme, onNotice }: { workspaceId: string; userId: string; employee: EmployeeProfile | null; profiles: Record<string, AppProfile>; canManage: boolean; theme: Theme; onNotice: (message: string) => void }) {
  const [records, setRecords] = useState<{ id: string; record_type: string; title: string; details: string | null; review_date: string; rating: number | null }[]>([]);
  const [requests, setRequests] = useState<RecordChangeRequest[]>([]);
  const [recordModal, setRecordModal] = useState<{ id?: string } | null>(null);
  const [changeRequest, setChangeRequest] = useState<{ targetId: string; targetName: string } | null>(null);
  const [requestDraft, setRequestDraft] = useState({ request_type: 'update' as 'delete' | 'replace' | 'update', details: '' });
  const [recordDraft, setRecordDraft] = useState({ record_type: 'goal', title: '', details: '', review_date: today(), rating: '' });
  const [confirmDialog, setConfirmDialog] = useState<WorkforceConfirmState | null>(null);
  const load = useCallback(async () => {
    if (!supabase || !employee) return;
    const [recordsResult, requestsResult] = await Promise.all([
      supabase.from('performance_records').select('*').eq('employee_profile_id', employee.id).order('review_date', { ascending: false }),
      supabase.from('employee_record_change_requests').select('*').eq('employee_profile_id', employee.id).eq('target_table', 'performance_records').order('created_at', { ascending: false }),
    ]);
    if (recordsResult.error || requestsResult.error) onNotice(recordsResult.error?.message ?? requestsResult.error?.message ?? 'Performance records could not be loaded.');
    else { setRecords(recordsResult.data ?? []); setRequests((requestsResult.data ?? []) as RecordChangeRequest[]); }
  }, [employee, onNotice]);
  useEffect(() => { void load(); }, [load]);
  useWorkforceRealtime(workspaceId, 'performance_records,employee_record_change_requests', load);
  const openRecord = (record?: { id: string; record_type: string; title: string; details: string | null; review_date: string; rating: number | null }) => { setRecordDraft({ record_type: record?.record_type ?? 'goal', title: record?.title ?? '', details: record?.details ?? '', review_date: record?.review_date ?? today(), rating: record?.rating == null ? '' : String(record.rating) }); setRecordModal(record ? { id: record.id } : {}); };
  const saveRecord = async () => { if (!supabase || !employee || !recordModal) return; const rating = recordDraft.rating.trim() === '' ? null : Number(recordDraft.rating); if (!recordDraft.title.trim() || (rating != null && (!Number.isFinite(rating) || rating < 0 || rating > 5))) { onNotice('Enter a title and an optional rating from 0 to 5.'); return; } const payload = { record_type: recordDraft.record_type, title: recordDraft.title.trim(), details: recordDraft.details.trim() || null, review_date: recordDraft.review_date, rating, updated_at: new Date().toISOString() }; const result = recordModal.id ? await supabase.from('performance_records').update(payload).eq('id', recordModal.id) : await supabase.from('performance_records').insert({ ...payload, workspace_id: workspaceId, employee_profile_id: employee.id, created_by: userId }); if (result.error) onNotice(result.error.message); else { setRecordModal(null); await load(); } };
  const deleteRecord = (record: { id: string; title: string }) => { if (!supabase || !canManage) return; setConfirmDialog({ title: 'Delete Performance Record', body: `You are about to delete ${record.title}. This action cannot be undone.`, confirmLabel: 'Continue', tone: 'danger', onConfirm: async () => { const { error } = await supabase.from('performance_records').delete().eq('id', record.id); if (error) onNotice(error.message); else await load(); } }); };
  const submitChangeRequest = async () => { if (!supabase || !employee || !changeRequest) return; const { error } = await supabase.from('employee_record_change_requests').insert({ workspace_id: workspaceId, employee_profile_id: employee.id, target_table: 'performance_records', target_id: changeRequest.targetId, request_type: requestDraft.request_type, details: requestDraft.details.trim() || null, requested_by: userId }); if (error) onNotice(error.message); else { setChangeRequest(null); setRequestDraft({ request_type: 'update', details: '' }); onNotice('Request sent for approval.'); await load(); } };
  const reviewChangeRequest = async (id: string, status: 'approved' | 'rejected') => { if (!supabase || !canManage) return; const { error } = await supabase.from('employee_record_change_requests').update({ status, reviewed_by: userId, reviewed_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq('id', id); if (error) onNotice(error.message); else await load(); };
  const recordNames = Object.fromEntries(records.map((record) => [record.id, record.title]));
  return <div className="mt-5 min-h-0 max-h-[calc(100dvh-310px)] overflow-y-auto pb-24 pr-1 scroll-area"><EmployeeContextHeader employee={employee} profiles={profiles} theme={theme} label="Performance" />{canManage && <button onClick={() => openRecord()} className="inline-flex h-10 items-center gap-2 rounded-lg bg-[var(--accent)] px-4 text-sm font-bold text-[var(--accent-ink)]"><Plus className="h-4 w-4" />Add record</button>}{canManage && <ChangeRequestInbox requests={requests} targetNames={recordNames} theme={theme} onReview={reviewChangeRequest} />}<div className="mt-4 space-y-3">{records.map((record) => <div key={record.id} className={cn('rounded-lg border p-4', panel(theme))}><div className="flex items-start justify-between gap-3"><div><div className="flex items-center gap-2"><strong>{record.title}</strong><StatusPill value={record.record_type} /></div><p className={cn('mt-2 text-sm', muted(theme))}>{record.details || 'No details'}</p><span className={cn('mt-2 block text-xs', muted(theme))}>{formatDate(record.review_date)}{record.rating != null ? ` · ${record.rating}/5` : ''}</span></div>{canManage ? <div className="flex shrink-0 gap-2"><IconAction label="Edit performance record" icon={Pencil} onClick={() => openRecord(record)} /><IconAction label="Delete performance record" icon={Trash2} onClick={() => deleteRecord(record)} /></div> : <button onClick={() => setChangeRequest({ targetId: record.id, targetName: record.title })} className={cn('inline-flex h-8 shrink-0 items-center gap-2 rounded-md border px-3 text-xs font-semibold', buttonSurface(theme))}><RefreshCw className="h-3.5 w-3.5" />Action</button>}</div></div>)}</div>{records.length === 0 && <EmptyState icon={Gauge} title="No performance records" body="Reviews, achievements, warnings, and goals will appear here." theme={theme} />}{changeRequest && <WorkforceModal title="Request performance change" theme={theme} onClose={() => setChangeRequest(null)} footer={<><button onClick={() => setChangeRequest(null)} className={cn('h-10 rounded-lg border px-4 text-sm font-semibold', buttonSurface(theme))}>Cancel</button><button onClick={() => void submitChangeRequest()} className="h-10 rounded-lg bg-[var(--accent)] px-4 text-sm font-bold text-[var(--accent-ink)]">Send request</button></>}><p className={cn('mb-4 text-sm', muted(theme))}>{changeRequest.targetName}</p><div className="grid gap-4 sm:grid-cols-2"><SelectField label="Action needed" value={requestDraft.request_type} options={['update', 'replace', 'delete']} onChange={(value) => setRequestDraft({ ...requestDraft, request_type: value as 'delete' | 'replace' | 'update' })} theme={theme} /><Field label="Details" value={requestDraft.details} onChange={(value) => setRequestDraft({ ...requestDraft, details: value })} theme={theme} wide /></div></WorkforceModal>}{recordModal && <WorkforceModal title={recordModal.id ? 'Edit performance record' : 'Add performance record'} theme={theme} onClose={() => setRecordModal(null)} footer={<><button onClick={() => setRecordModal(null)} className={cn('h-10 rounded-lg border px-4 text-sm font-semibold', buttonSurface(theme))}>Cancel</button><button onClick={() => void saveRecord()} className="h-10 rounded-lg bg-[var(--accent)] px-4 text-sm font-bold text-[var(--accent-ink)]">Save record</button></>}><div className="grid gap-4 sm:grid-cols-2"><SelectField label="Type" value={recordDraft.record_type} options={['review', 'achievement', 'warning', 'goal']} onChange={(value) => setRecordDraft({ ...recordDraft, record_type: value })} theme={theme} /><Field label="Review date" type="date" value={recordDraft.review_date} onChange={(value) => setRecordDraft({ ...recordDraft, review_date: value })} theme={theme} /><Field label="Title" value={recordDraft.title} onChange={(value) => setRecordDraft({ ...recordDraft, title: value })} theme={theme} wide /><Field label="Details" value={recordDraft.details} onChange={(value) => setRecordDraft({ ...recordDraft, details: value })} theme={theme} wide /><Field label="Rating (0-5)" type="number" value={recordDraft.rating} onChange={(value) => setRecordDraft({ ...recordDraft, rating: value })} theme={theme} /></div></WorkforceModal>}{confirmDialog && <WorkforceConfirmModal dialog={confirmDialog} theme={theme} onClose={() => setConfirmDialog(null)} onNotice={onNotice} />}</div>;
}

function CompensationPanel({ workspaceId, userId, employee, profiles, canManage, theme, onNotice }: { workspaceId: string; userId: string; employee: EmployeeProfile | null; profiles: Record<string, AppProfile>; canManage: boolean; theme: Theme; onNotice: (message: string) => void }) {
  const [country, setCountry] = useState('US');
  const [compensationType, setCompensationType] = useState('hourly');
  const [amount, setAmount] = useState('');
  const [taxStatus, setTaxStatus] = useState('');
  const [bankAccount, setBankAccount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('Bank Transfer');
  const [paymentDetails, setPaymentDetails] = useState('');
  const [frequency, setFrequency] = useState('biweekly');
  const [governmentIds, setGovernmentIds] = useState<Record<string, string>>({});
  const [sensitiveFieldModalOpen, setSensitiveFieldModalOpen] = useState(false);
  const [sensitiveFieldName, setSensitiveFieldName] = useState('');
  const [customSensitiveFieldName, setCustomSensitiveFieldName] = useState('');
  const [sensitiveFieldValue, setSensitiveFieldValue] = useState('');
  const [payrollFields, setPayrollFields] = useState<EmployeePayrollField[]>([]);
  const [addingField, setAddingField] = useState(false);
  const [fieldName, setFieldName] = useState('');
  const [customFieldName, setCustomFieldName] = useState('');
  const [fieldKind, setFieldKind] = useState<'earning' | 'deduction'>('deduction');
  const [fieldCalculation, setFieldCalculation] = useState<'fixed' | 'percentage'>('percentage');
  const [fieldValue, setFieldValue] = useState('');
  const [saving, setSaving] = useState(false);
  const [confirmDialog, setConfirmDialog] = useState<WorkforceConfirmState | null>(null);
  const canCreateFields = canManage;

  useEffect(() => {
    if (!supabase) return;
    void supabase.from('workforce_settings').select('country_code').eq('workspace_id', workspaceId).maybeSingle().then(({ data }) => setCountry(data?.country_code ?? 'US'));
  }, [workspaceId]);

  const loadCompensation = useCallback(async () => {
    if (!supabase || !employee) return;
    const [sensitiveResult, fieldsResult] = await Promise.all([
      supabase.rpc('read_employee_payroll_details', { target_employee_profile_id: employee.id }),
      supabase.from('employee_payroll_fields').select('*').eq('employee_profile_id', employee.id).order('name'),
    ]);
    if (sensitiveResult.error || fieldsResult.error) return onNotice(sensitiveResult.error?.message ?? fieldsResult.error?.message ?? 'Compensation could not be loaded.');
    const value = (sensitiveResult.data ?? {}) as Record<string, unknown>;
    const countryFields = (value.country_fields as Record<string, string>) ?? {};
    setCompensationType(String(value.compensation_type ?? 'hourly'));
    setAmount(String(value.compensation_amount ?? ''));
    setTaxStatus(String(value.tax_status ?? ''));
    setBankAccount(String(value.bank_account ?? ''));
    setPaymentMethod(countryFields.payment_method || 'Bank Transfer');
    setPaymentDetails(countryFields.payment_details || '');
    setFrequency(countryFields.frequency || 'biweekly');
    setGovernmentIds((value.government_ids as Record<string, string>) ?? {});
    setPayrollFields((fieldsResult.data ?? []) as EmployeePayrollField[]);
  }, [employee, onNotice]);

  useEffect(() => { void loadCompensation(); }, [loadCompensation]);

  const save = async () => {
    if (!supabase || !employee) return;
    setSaving(true);
    const { error } = await supabase.rpc('save_employee_payroll_details', {
      target_employee_profile_id: employee.id,
      new_compensation_type: compensationType,
      new_compensation_amount: amount,
      new_tax_status: taxStatus,
      new_bank_account: bankAccount,
      new_government_ids: governmentIds,
      new_country_fields: { payment_method: paymentMethod, payment_details: paymentDetails, frequency },
    });
    setSaving(false);
    if (error) onNotice(error.message); else onNotice('Encrypted compensation records saved.');
  };

  const addSensitiveField = () => {
    const resolvedName = sensitiveFieldName === '__other__' ? customSensitiveFieldName.trim() : sensitiveFieldName.trim();
    if (!resolvedName || !sensitiveFieldValue.trim()) { onNotice('Enter a field name and value.'); return; }
    setGovernmentIds((current) => ({ ...current, [resolvedName]: sensitiveFieldValue.trim() }));
    setSensitiveFieldModalOpen(false);
    setSensitiveFieldName('');
    setCustomSensitiveFieldName('');
    setSensitiveFieldValue('');
  };
  const removeSensitiveField = (name: string) => {
    setConfirmDialog({
      title: 'Delete encrypted field?',
      body: `${name} will be removed from this compensation record. Save the compensation record to persist the change.`,
      confirmLabel: 'Continue',
      onConfirm: async () => {
        setGovernmentIds((current) => { const next = { ...current }; delete next[name]; return next; });
      },
    });
  };

  const addPayrollField = async () => {
    if (!supabase || !employee || !canManage) return;
    const value = Number(fieldValue);
    const resolvedFieldName = fieldName === '__other__' ? customFieldName.trim() : fieldName.trim();
    if (!resolvedFieldName || !Number.isFinite(value) || value < 0) return onNotice('Enter a field name and a valid non-negative value.');
    const { error } = await supabase.from('employee_payroll_fields').insert({
      workspace_id: workspaceId, employee_profile_id: employee.id, name: resolvedFieldName,
      item_kind: fieldKind, calculation_type: fieldCalculation, value,
      country_code: country || null, created_by: userId,
    });
    if (error) return onNotice(error.message);
    setAddingField(false); setFieldName(''); setCustomFieldName(''); setFieldValue(''); setFieldKind('deduction'); setFieldCalculation('percentage');
    await loadCompensation();
  };

  const deletePayrollField = (fieldId: string) => {
    if (!supabase || !canManage) return;
    setConfirmDialog({
      title: 'Delete compensation item?',
      body: 'This employee-specific compensation item will be removed from draft summaries.',
      confirmLabel: 'Delete item',
      onConfirm: async () => {
        const { error } = await supabase.from('employee_payroll_fields').delete().eq('id', fieldId);
        if (error) throw new Error(error.message);
        await loadCompensation();
      },
    });
  };

  if (!employee) return <EmptyState icon={Banknote} title="Select an employee" body="Choose an employee to view or manage compensation records." theme={theme} />;
  const suggestedFields = payrollFieldSuggestions(country);
  return <><div className="mt-5 min-h-0 max-h-[calc(100dvh-310px)] overflow-y-auto pb-24 pr-1 scroll-area"><EmployeeContextHeader employee={employee} profiles={profiles} theme={theme} label="Compensation" /><div className={cn('mt-4 w-full rounded-lg border p-5', panel(theme))}>
    <div className="mb-5 flex flex-wrap items-start justify-between gap-3"><div><h3 className="font-bold">Encrypted Compensation Records</h3><p className={cn('mt-1 text-sm', muted(theme))}>Compensation, payment destination, frequency, and optional payroll-preparation notes are encrypted separately.<br />TriCord stores the information your organization provides for recordkeeping only; it does not process payroll, verify tax treatment, provide HR advice, or determine legal compliance.</p></div>{canManage && <button onClick={() => setSensitiveFieldModalOpen(true)} className={cn('inline-flex h-10 items-center gap-2 rounded-lg border px-4 text-sm font-semibold', buttonSurface(theme))}><Plus className="h-4 w-4" />Add Field</button>}</div>
    <div className="grid gap-4 sm:grid-cols-2">
      <SelectField label="Compensation Type" value={compensationType} options={['hourly', 'daily', 'weekly', 'semimonthly', 'monthly', 'annual']} optionLabels={{ hourly: 'Hourly', daily: 'Daily', weekly: 'Weekly', semimonthly: 'Semi-monthly', monthly: 'Monthly', annual: 'Annual' }} onChange={setCompensationType} theme={theme} />
      <Field label="Compensation Amount" type="number" value={amount} onChange={setAmount} theme={theme} />
      <Field label="Payroll/Tax Note (Recordkeeping Only)" value={taxStatus} onChange={setTaxStatus} theme={theme} />
      <Field label="Payment Destination (Optional)" value={bankAccount} onChange={setBankAccount} theme={theme} />
      <SelectField label="Payment Method" value={paymentMethod} options={['Bank Transfer', 'Check', 'Cash', 'GCash', 'PayPal', 'Zelle', 'Venmo', 'Apple Pay', 'Other']} onChange={setPaymentMethod} theme={theme} />
      <Field label="Payment Details" value={paymentDetails} onChange={setPaymentDetails} theme={theme} />
      <SelectField label="Frequency" value={frequency} options={PAYROLL_FREQUENCY_OPTIONS} optionLabels={PAYROLL_FREQUENCY_LABELS} onChange={setFrequency} theme={theme} />
    </div>
    {Object.keys(governmentIds).length > 0 && <div className="mt-4 grid gap-2 md:grid-cols-2 xl:grid-cols-3">{Object.entries(governmentIds).map(([name, value]) => <div key={name} className="flex items-center justify-between gap-3 rounded-lg border border-current/10 px-3 py-3"><span><strong className="block text-sm">{name}</strong><span className={cn('text-xs', muted(theme))}>{maskSensitiveValue(String(value))}</span></span>{canManage && <IconAction label={`Delete ${name}`} icon={Trash2} onClick={() => removeSensitiveField(name)} />}</div>)}</div>}
    <button onClick={() => void save()} disabled={saving} className="mt-5 h-11 rounded-lg bg-[var(--accent)] px-5 text-sm font-bold text-[var(--accent-ink)]">Save Compensation Record</button>
    <div className={cn('mt-6 border-t pt-5', border(theme))}>
      <div className="flex flex-wrap items-start justify-between gap-3"><div><h3 className="font-bold">Compensation Items</h3><p className={cn('mt-1 text-sm', muted(theme))}>Employee-specific earnings, deductions, or preparation notes for owner-reviewed draft summaries. Verify all items with your payroll provider, tax professional, legal advisor, or HR advisor before use.</p></div>{canCreateFields && <button onClick={() => setAddingField((open) => !open)} className={cn('inline-flex h-10 items-center gap-2 rounded-lg border px-4 text-sm font-semibold', buttonSurface(theme))}><Plus className="h-4 w-4" />Add Field</button>}</div>
      {addingField && <div className={cn('mt-4 rounded-lg border p-4', panel(theme))}>
        <div className="grid gap-3 md:grid-cols-4">
          <SelectField label="Field Name" value={fieldName} options={['', ...suggestedFields, '__other__']} optionLabels={{ '': 'Select item', __other__: 'Other' }} onChange={(value) => setFieldName(value)} theme={theme} />
          {fieldName === '__other__' && <Field label="Custom Field Name" value={customFieldName} onChange={setCustomFieldName} theme={theme} />}
          <SelectField label="Type" value={fieldKind} options={['earning', 'deduction']} onChange={(value) => setFieldKind(value as 'earning' | 'deduction')} theme={theme} />
          <SelectField label="Calculation" value={fieldCalculation} options={['percentage', 'fixed']} onChange={(value) => setFieldCalculation(value as 'fixed' | 'percentage')} theme={theme} />
          <Field label={fieldCalculation === 'percentage' ? 'Percentage' : 'Fixed amount'} type="number" value={fieldValue} onChange={setFieldValue} theme={theme} />
        </div>
        <div className="mt-3 flex justify-end gap-2"><button onClick={() => setAddingField(false)} className={cn('h-9 rounded-lg border px-3 text-sm font-semibold', buttonSurface(theme))}>Cancel</button><button onClick={() => void addPayrollField()} className="h-9 rounded-lg bg-[var(--accent)] px-4 text-sm font-bold text-[var(--accent-ink)]">Save Field</button></div>
      </div>}
      <div className="mt-4 grid gap-2 md:grid-cols-2 xl:grid-cols-3">{payrollFields.map((field) => <div key={field.id} className="flex items-center justify-between gap-3 rounded-lg border border-current/10 px-3 py-3"><span><strong className="block text-sm">{field.name}</strong><span className={cn('text-xs capitalize', muted(theme))}>{field.item_kind} · {field.calculation_type} · {field.value}{field.calculation_type === 'percentage' ? '%' : ''}</span></span>{canCreateFields && <IconAction label="Delete compensation item" icon={Trash2} onClick={() => void deletePayrollField(field.id)} />}</div>)}</div>
      {payrollFields.length === 0 && <p className={cn('mt-4 rounded-lg border border-dashed p-4 text-sm', muted(theme))}>No employee-specific compensation items yet. Common examples for {country}: {suggestedFields.join(', ')}. Verify which items apply to your organization before use.</p>}
    </div>
  </div></div>
  {sensitiveFieldModalOpen && <WorkforceModal title="Add Encrypted Field" theme={theme} onClose={() => setSensitiveFieldModalOpen(false)} footer={<><button type="button" onClick={() => setSensitiveFieldModalOpen(false)} className={cn('h-10 rounded-lg border px-4 text-sm font-semibold', buttonSurface(theme))}>Cancel</button><button type="button" onClick={addSensitiveField} className="h-10 rounded-lg bg-[var(--accent)] px-4 text-sm font-bold text-[var(--accent-ink)]">Add Field</button></>}><div className="grid gap-4 sm:grid-cols-2"><SelectField label="Field Name" value={sensitiveFieldName} options={['', 'SSN', 'ITIN', 'TIN', 'National ID', 'Tax ID', '__other__']} optionLabels={{ '': 'Select Field', __other__: 'Other' }} onChange={setSensitiveFieldName} theme={theme} />{sensitiveFieldName === '__other__' && <Field label="Custom Field Name" value={customSensitiveFieldName} onChange={setCustomSensitiveFieldName} theme={theme} />}<Field label="Field Value" value={sensitiveFieldValue} onChange={setSensitiveFieldValue} theme={theme} wide /></div></WorkforceModal>}
  {confirmDialog && <WorkforceConfirmModal dialog={confirmDialog} theme={theme} onClose={() => setConfirmDialog(null)} onNotice={onNotice} />}
  </>;
}


function ChangeRequestInbox({ requests, targetNames, theme, onReview }: { requests: RecordChangeRequest[]; targetNames: Record<string, string>; theme: Theme; onReview: (id: string, status: 'approved' | 'rejected') => Promise<void> }) {
  const pending = requests.filter((request) => request.status === 'pending');
  if (pending.length === 0) return null;
  return <section className={cn('mt-4 rounded-lg border p-4', panel(theme))}><div className="mb-3 flex items-center justify-between"><h3 className="text-sm font-bold">Change requests</h3><StatusPill value={`${pending.length} pending`} /></div><div className="space-y-2">{pending.map((request) => <div key={request.id} className={cn('flex items-start justify-between gap-3 rounded-lg border p-3', theme === 'dark' ? 'border-white/10' : 'border-[#E7E3EA]')}><div className="min-w-0"><p className="text-sm font-semibold capitalize">{request.request_type} {targetNames[request.target_id] ?? 'record'}</p><p className={cn('mt-1 text-xs', muted(theme))}>{request.details || 'No details provided.'}</p></div><div className="flex shrink-0 gap-2"><IconAction label="Approve request" icon={Check} onClick={() => void onReview(request.id, 'approved')} /><IconAction label="Reject request" icon={X} onClick={() => void onReview(request.id, 'rejected')} /></div></div>)}</div></section>;
}

function useWorkforceRealtime(workspaceId: string, tables: string, reload: () => Promise<void>) {
  useEffect(() => {
    if (!supabase) return;
    let channel = supabase.channel(`workforce-${tables.replaceAll(',', '-')}-${workspaceId}`);
    for (const table of tables.split(',')) channel = channel.on('postgres_changes', { event: '*', schema: 'public', table, filter: `workspace_id=eq.${workspaceId}` }, () => void reload());
    channel.subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [reload, tables, workspaceId]);
}

function WorkforceModal({ title, theme, children, footer, onClose }: { title: string; theme: Theme; children: ReactNode; footer: ReactNode; onClose: () => void }) {
  return <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/45 px-4 py-6 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label={title}><div className={cn('w-full max-w-2xl rounded-xl border p-5 shadow-2xl', panel(theme))}><div className="mb-5 flex items-center justify-between gap-4"><h3 className="text-lg font-bold">{title}</h3><button aria-label="Close" title="Close" onClick={onClose} className={cn('inline-flex h-9 w-9 items-center justify-center rounded-lg border', buttonSurface(theme))}><X className="h-4 w-4" /></button></div>{children}<div className="mt-6 flex justify-end gap-2">{footer}</div></div></div>;
}

function WorkforceConfirmModal({ dialog, theme, onClose, onNotice }: { dialog: WorkforceConfirmState; theme: Theme; onClose: () => void; onNotice: (message: string) => void }) {
  const [submitting, setSubmitting] = useState(false);
  const confirm = async () => {
    setSubmitting(true);
    try {
      await dialog.onConfirm();
      onClose();
    } catch (error) {
      onNotice(errorMessage(error));
      setSubmitting(false);
    }
  };
  return <WorkforceModal title={dialog.title} theme={theme} onClose={onClose} footer={<><button type="button" onClick={onClose} disabled={submitting} className={cn('h-10 rounded-lg border px-4 text-sm font-semibold', buttonSurface(theme))}>Cancel</button><button type="button" onClick={() => void confirm()} disabled={submitting} className={cn('h-10 rounded-lg px-4 text-sm font-bold', dialog.tone === 'accent' ? 'bg-[var(--accent)] text-[var(--accent-ink)]' : 'bg-[#B91C1C] text-white')}>{submitting ? 'Working…' : dialog.confirmLabel}</button></>}><p className={cn('text-sm leading-6', muted(theme))}>{dialog.body}</p></WorkforceModal>;
}

function daysBetweenInclusive(start: string, end: string) { return Math.max(0, Math.round((new Date(`${end}T00:00:00`).getTime() - new Date(`${start}T00:00:00`).getTime()) / 86400000) + 1); }

function ModuleFrame({ icon: Icon, title, subtitle, theme, children, scroll = true }: { icon: typeof Clock3; title: string; subtitle: string; theme: Theme; children: ReactNode; scroll?: boolean }) { return <div className={cn('min-h-0 flex-1 pr-1 pb-10', scroll ? 'overflow-y-auto scroll-area' : 'overflow-hidden pr-0')}><header className={cn('mb-5 flex items-center gap-3 border-b pb-4', border(theme))}><div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[var(--accent-soft)] text-[var(--accent-strong)]"><Icon className="h-5 w-5" /></div><div><h2 className="text-xl font-bold">{title}</h2><p className={cn('text-sm', muted(theme))}>{subtitle}</p></div></header>{children}</div>; }
function Metric({ label, value, theme, accent = false }: { label: string; value: string; theme: Theme; accent?: boolean }) { return <div className={cn('rounded-lg border p-4', panel(theme), accent && 'border-[var(--accent)]')}><p className={cn('text-xs font-semibold uppercase tracking-[0.12em]', muted(theme))}>{label}</p><p className={cn('mt-2 text-2xl font-bold capitalize', accent && 'text-[var(--accent-strong)]')}>{value}</p></div>; }
function DataTable({ headers, theme, children }: { headers: string[]; theme: Theme; children: ReactNode }) { return <div className={cn('overflow-x-auto rounded-lg border', panel(theme))}><table className="w-full min-w-[720px] border-collapse text-left"><thead><tr className={cn('border-b', border(theme))}>{headers.map((header) => <th key={header} className={cn('px-4 py-3 text-xs uppercase tracking-[0.1em]', muted(theme))}>{header}</th>)}</tr></thead><tbody>{children}</tbody></table></div>; }
function Cell({ children, strong = false }: { children: ReactNode; strong?: boolean }) { return <td className={cn('px-4 py-3 text-sm', strong && 'font-semibold')}>{children}</td>; }
function ActionButton({ icon: Icon, label, onClick, disabled, secondary, danger }: { icon: typeof Play; label: string; onClick: () => void; disabled?: boolean; secondary?: boolean; danger?: boolean }) { return <button onClick={onClick} disabled={disabled} className={cn('inline-flex h-12 items-center gap-2 rounded-lg px-5 text-sm font-bold disabled:opacity-50', danger ? 'bg-[#B91C1C] text-white' : secondary ? 'border border-[var(--accent)] bg-transparent text-[var(--accent-strong)]' : 'bg-[var(--accent)] text-[var(--accent-ink)]')}><Icon className="h-4 w-4" />{label}</button>; }
function Field({ label, value, onChange, theme, type = 'text', wide, compact }: { label: string; value: string; onChange: (value: string) => void; theme: Theme; type?: string; wide?: boolean; compact?: boolean }) { return <label className={cn('block', wide && 'sm:col-span-2', compact && 'w-40')}><span className={cn('mb-1 block text-xs font-semibold', muted(theme))}>{label}</span><input type={type} value={value} onChange={(event) => onChange(event.target.value)} className={cn('h-11 w-full rounded-lg border px-3 text-sm outline-none', panel(theme), compact && 'h-10')} /></label>; }
function SmallInput({ label, value, onChange, theme }: { label: string; value: string | number; onChange: (value: string) => void; theme: Theme }) { return <label><span className={cn('mb-1 block text-[11px]', muted(theme))}>{label}</span><input value={value} onChange={(event) => onChange(event.target.value)} className={cn('h-9 w-full rounded-lg border px-2 text-xs', panel(theme))} /></label>; }
function SelectField({ label, value, options, optionLabels, onChange, theme, compact }: { label: string; value: string; options: string[]; optionLabels?: Record<string, string>; onChange: (value: string) => void; theme: Theme; compact?: boolean }) { return <label className={cn('block', compact && 'w-44')}><span className={cn('mb-1 block text-xs font-semibold', muted(theme))}>{label}</span><select value={value} onChange={(event) => onChange(event.target.value)} className={cn('h-11 w-full rounded-lg border px-3 text-sm capitalize', panel(theme), compact && 'h-10')}>{options.map((option) => <option key={option} value={option}>{optionLabels?.[option] ?? (option ? option.replaceAll('_', ' ') : 'Not set')}</option>)}</select></label>; }
function Segmented({ options, value, onChange, theme }: { options: string[][]; value: string; onChange: (value: string) => void; theme: Theme }) { return <div className={cn('inline-flex rounded-lg border p-1', panel(theme))}>{options.map(([key, label]) => <button key={key} onClick={() => onChange(key)} className={cn('h-9 rounded-md px-4 text-sm font-semibold', value === key ? 'bg-[var(--accent)] text-[var(--accent-ink)]' : muted(theme))}>{label}</button>)}</div>; }
function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (checked: boolean) => void; label: string }) { return <label className="flex items-center justify-between gap-3 py-1.5 text-sm"><span>{label}</span><input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} className="h-4 w-4 accent-[var(--accent)]" /></label>; }
function StatusPill({ value }: { value: string }) { return <span className="inline-flex rounded-full bg-[var(--accent-soft)] px-2.5 py-1 text-xs font-semibold capitalize text-[var(--accent-strong)]">{value.replaceAll('_', ' ')}</span>; }
function IconAction({ label, icon: Icon, onClick }: { label: string; icon: typeof Check; onClick: () => void }) { return <button aria-label={label} title={label} onClick={onClick} className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-current/20"><Icon className="h-3.5 w-3.5" /></button>; }
function EmptyState({ icon: Icon, title, body, theme }: { icon: typeof Banknote; title: string; body: string; theme: Theme }) { return <div className={cn('mt-8 flex min-h-56 flex-col items-center justify-center rounded-lg border p-8 text-center', panel(theme))}><Icon className="h-8 w-8 text-[var(--accent)]" /><h3 className="mt-3 font-bold">{title}</h3><p className={cn('mt-1 max-w-md text-sm', muted(theme))}>{body}</p></div>; }
function MiniAvatar({ profile, large = false }: { profile?: AppProfile; large?: boolean }) { const name = profile?.nickname || profile?.display_name || 'E'; return profile?.avatar_url ? <img src={profile.avatar_url} alt="" className={cn('rounded-lg object-cover', large ? 'h-12 w-12' : 'h-9 w-9')} /> : <span className={cn('flex items-center justify-center rounded-lg bg-[var(--accent-soft)] font-bold text-[var(--accent-strong)]', large ? 'h-12 w-12' : 'h-9 w-9 text-sm')}>{name.slice(0, 1).toUpperCase()}</span>; }
function panel(theme: Theme) { return theme === 'dark' ? 'border-white/10 bg-white/[0.04] text-[#FAF9FC]' : 'border-[#E7E3EA] bg-white text-[#17151D]'; }
function border(theme: Theme) { return theme === 'dark' ? 'border-white/10' : 'border-[#E7E3EA]'; }
function muted(theme: Theme) { return theme === 'dark' ? 'text-[#AAA4B3]' : 'text-[#716A78]'; }
function buttonSurface(theme: Theme) { return theme === 'dark' ? 'border-white/15 bg-white/[0.05] hover:bg-white/10' : 'border-[#DCD7E1] bg-white hover:bg-[#F7F6F9]'; }
function employeeName(employee: EmployeeProfile | undefined | null, profiles: Record<string, AppProfile>) { if (!employee) return 'Employee'; const profile = profiles[employee.user_id]; return [employee.first_name, employee.last_name].filter(Boolean).join(' ') || profile?.full_name || profile?.display_name || 'Employee'; }
function hrPersonLabel(role: WorkspaceRole | undefined) { if (role === 'owner') return 'Administrator'; if (role === 'guest') return 'Guest'; return 'Employee'; }
function payrollFieldSuggestions(country: string) {
  if (country === 'US') return ['Medicare', 'Social Security', 'Federal Tax', 'State Income Tax', 'State Disability Insurance'];
  if (country === 'PH') return ['SSS', 'Pag-IBIG', 'PhilHealth', 'Withholding Tax'];
  return ['Income Tax', 'Social Insurance', 'Health Insurance', 'Pension', 'Other Deduction'];
}
function validateWorkforceUpload(file: File, imageOnly = false) {
  if (file.size <= 0) return 'The selected file is empty.';
  if (file.size > MAX_WORKFORCE_UPLOAD_BYTES) return `Workforce uploads must be ${formatFileSize(MAX_WORKFORCE_UPLOAD_BYTES)} or smaller for this release.`;
  if (imageOnly && !file.type.startsWith('image/')) return 'Choose an image file.';
  const extension = file.name.split('.').pop()?.toLowerCase() ?? '';
  if (BLOCKED_WORKFORCE_FILE_EXTENSIONS.has(extension)) return 'This file type is blocked for security.';
  return '';
}

function sanitizeWorkforceFilename(filename: string) {
  const cleaned = filename.normalize('NFKD').replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/^-+|-+$/g, '');
  return cleaned || 'file';
}

function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function workedHours(entry: TimeEntry, now: number) { const end = entry.clock_out ? new Date(entry.clock_out).getTime() : now; const activeBreak = entry.break_started_at ? Math.max(0, now - new Date(entry.break_started_at).getTime()) / 1000 : 0; return Math.max(0, (end - new Date(entry.clock_in).getTime()) / 3600000 - (entry.break_seconds + activeBreak) / 3600); }
function formatDuration(hours: number) { const totalMinutes = Math.max(0, Math.round(hours * 60)); return `${Math.floor(totalMinutes / 60)}h ${String(totalMinutes % 60).padStart(2, '0')}m`; }
function formatTime(value: string) { return new Date(value).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }); }
function formatDate(value: string) { const date = /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(`${value}T00:00:00`) : new Date(value); return date.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' }); }

function toDateTimeLocal(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const offset = date.getTimezoneOffset();
  return new Date(date.getTime() - offset * 60000).toISOString().slice(0, 16);
}

function fromDateTimeLocal(value: string) {
  return new Date(value).toISOString();
}

function maskSensitiveValue(value: string) {
  const trimmed = String(value ?? '').trim();
  if (!trimmed) return 'No value';
  const visible = trimmed.slice(-4);
  return '•'.repeat(Math.max(4, trimmed.length - visible.length)) + visible;
}

const ATTENDANCE_POLICY_NOTICE_KEYS = ['capture_location', 'capture_ip', 'capture_device', 'require_selfie', 'enforce_geofence'] as const;

function attendancePolicyStorageKey(workspaceId: string, employeeProfileId: string) {
  return `tricord-attendance-policy:${workspaceId}:${employeeProfileId}`;
}

function attendancePolicySnapshot(policy: EmployeeTimekeepingPolicy) {
  return {
    capture_location: policy.capture_location,
    capture_ip: policy.capture_ip,
    capture_device: policy.capture_device,
    require_selfie: policy.require_selfie,
    enforce_geofence: policy.enforce_geofence,
  };
}

function attendancePolicySignature(policy: EmployeeTimekeepingPolicy) {
  return JSON.stringify(attendancePolicySnapshot(policy));
}

function pendingAttendanceRequirementKeys(policy: EmployeeTimekeepingPolicy) {
  const pending = policy.pending_requirements ?? {};
  return ATTENDANCE_POLICY_NOTICE_KEYS.filter((key) => pending[key] === true);
}

function attendancePendingRequirementNotice(enabled: string[]) {
  const base = attendanceEnabledNotice(enabled);
  return {
    title: base.title,
    body: `${base.body} Please review and choose Accept to enable this requirement, or Decline if you do not consent.`,
  };
}

function attendancePolicyChangeNotice(previousSignature: string | null, policy: EmployeeTimekeepingPolicy, currentUserId: string) {
  const current = attendancePolicySnapshot(policy);
  if (!previousSignature) {
    if (!policy.updated_by || policy.updated_by === currentUserId) return null;
    const activeRequirements = ATTENDANCE_POLICY_NOTICE_KEYS.filter((key) => current[key]).map(settingLabel);
    if (activeRequirements.length > 0) return attendanceEnabledNotice(activeRequirements);
    return {
      title: 'Attendance Policy Updated',
      body: 'Your organization has updated your attendance policy. No extra clock-in verification requirements are currently enabled.',
    };
  }

  try {
    const previous = JSON.parse(previousSignature) as Record<(typeof ATTENDANCE_POLICY_NOTICE_KEYS)[number], boolean>;
    const enabled = ATTENDANCE_POLICY_NOTICE_KEYS.filter((key) => !previous[key] && current[key]).map(settingLabel);
    const disabled = ATTENDANCE_POLICY_NOTICE_KEYS.filter((key) => previous[key] && !current[key]).map(settingLabel);
    if (enabled.length === 0 && disabled.length === 0) return null;
    if (enabled.length > 0 && disabled.length === 0) return attendanceEnabledNotice(enabled);
    const parts = [];
    if (enabled.length > 0) parts.push(`Enabled: ${enabled.join(', ')}.`);
    if (disabled.length > 0) parts.push(`Disabled: ${disabled.join(', ')}.`);
    return { title: 'Attendance Policy Updated', body: parts.join(' ') };
  } catch {
    return null;
  }
}

function settingLabel(key: keyof Pick<TimekeepingSettings, 'capture_location' | 'capture_ip' | 'capture_device' | 'require_selfie' | 'enforce_geofence'>) { return ({ capture_location: 'GPS location', capture_ip: 'IP address', capture_device: 'Device information', require_selfie: 'Photo verification', enforce_geofence: 'Geofence restriction' })[key]; }

function attendanceEnabledNotice(enabled: string[]) {
  const notices = enabled.map((label) => employeeAttendanceRequirementNotice(label));
  if (notices.length === 1) return notices[0];
  return {
    title: 'Attendance Requirements Updated',
    body: notices.map((notice) => notice.body).join(' '),
  };
}

function employeeAttendanceRequirementNotice(label: string) {
  if (label === 'GPS location') return { title: 'GPS Location Enabled', body: 'Your organization has enabled GPS location capture. Your location may be recorded when you clock in or clock out.' };
  if (label === 'IP address') return { title: 'IP Address Recording Enabled', body: 'Your organization has enabled IP address recording. Your IP address may be recorded when you clock in or clock out.' };
  if (label === 'Device information') return { title: 'Device Information Enabled', body: 'Your organization has enabled device information capture. Information about the device used to clock in or clock out may be recorded.' };
  if (label === 'Photo verification') return { title: 'Photo Verification Enabled', body: 'Your organization has enabled photo verification. A photo may be recorded when you clock in so your organization can review attendance records.' };
  if (label === 'Geofence restriction') return { title: 'Geofence Restriction Enabled', body: 'Your organization has enabled geofence restrictions. You may need to be within the approved work location before clocking in or clocking out.' };
  return { title: 'Attendance Requirement Enabled', body: 'Your organization has enabled ' + label.toLowerCase() + ' for attendance records.' };
}

function attendanceSettingNotice(key: keyof Pick<TimekeepingSettings, 'capture_location' | 'capture_ip' | 'capture_device' | 'require_selfie' | 'enforce_geofence'>) {
  if (key === 'capture_location') return { title: 'Enable GPS location?', body: 'You are about to enable GPS location capture for this employee. After you continue and save the policy, the employee will be notified that their location may be recorded when they clock in or clock out.' };
  if (key === 'capture_ip') return { title: 'Enable IP address recording?', body: 'You are about to enable IP address recording for this employee. After you continue and save the policy, the employee will be notified that their IP address may be recorded when they clock in or clock out.' };
  if (key === 'capture_device') return { title: 'Enable device information?', body: 'You are about to enable device information capture for this employee. After you continue and save the policy, the employee will be notified that device details may be recorded when they clock in or clock out.' };
  if (key === 'require_selfie') return { title: 'Enable photo verification?', body: 'You are about to enable photo verification for this employee. After you continue and save the policy, the employee will be notified that a photo may be recorded when they clock in.' };
  return { title: 'Enable geofence restriction?', body: 'You are about to enable a geofence restriction for this employee. After you continue and save the policy, the employee will be notified that they may need to be within the approved work location before clocking in or clocking out.' };
}
function numberOrNull(value: string) { return value.trim() === '' ? null : Number(value); }
function errorMessage(error: unknown) { return error instanceof Error ? error.message : typeof error === 'object' && error && 'message' in error ? String(error.message) : 'Something went wrong.'; }
function today() { return new Date().toISOString().slice(0, 10); }
function monthStart() { const date = new Date(); date.setDate(1); return date.toISOString().slice(0, 10); }
function dateInTimezone(timezone: string) {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date());
  const value = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${value.year}-${value.month}-${value.day}`;
}
function dayInTimezone(timezone: string) {
  const day = new Intl.DateTimeFormat('en-US', { timeZone: timezone, weekday: 'short' }).format(new Date());
  return ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(day);
}
function parseTimeMinutes(value: string) { const [hours, minutes] = value.split(':').map(Number); return (hours || 0) * 60 + (minutes || 0); }
function timeMinutesInTimezone(value: string, timezone: string) {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: timezone, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(new Date(value));
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return Number(values.hour) * 60 + Number(values.minute);
}
