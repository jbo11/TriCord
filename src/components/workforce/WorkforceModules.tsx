import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  Banknote, BriefcaseBusiness, CalendarDays, Camera, Check, Clock3, Coffee, FileUp,
  Gauge, Pause, Pencil, Play, Plus, RefreshCw, Search, Square, Users,
  Trash2,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { cn } from '../../lib/utils';
import type { AppMembership, AppProfile, ViewMode, WorkspaceRole } from '../../types';

type Theme = 'light' | 'dark';
type WorkforceView = Extract<ViewMode, 'timekeeping' | 'hr' | 'payroll' | 'reports'>;

interface WorkforceProps {
  view: WorkforceView;
  workspaceId: string;
  userId: string;
  role: WorkspaceRole;
  profiles: Record<string, AppProfile>;
  memberships: AppMembership[];
  theme: Theme;
  onNotice: (message: string) => void;
}

interface EmployeeProfile {
  id: string; workspace_id: string; user_id: string; first_name: string | null; last_name: string | null;
  address: string | null; contact_number: string | null; birthday: string | null;
  emergency_contact_name: string | null; emergency_contact_number: string | null;
  employee_number: string | null; department: string | null; position: string | null;
  manager_user_id: string | null; employment_status: string; hire_date: string | null; employment_type: string | null;
}

interface TimeEntry {
  id: string; workspace_id: string; employee_profile_id: string; work_date: string;
  clock_in: string; clock_out: string | null; break_started_at: string | null; break_seconds: number;
}

interface TimekeepingSettings {
  workspace_id: string; capture_location: boolean; capture_ip: boolean; capture_device: boolean;
  require_selfie: boolean; enforce_geofence: boolean; office_latitude: number | null;
  office_longitude: number | null; geofence_radius_meters: number; standard_daily_hours: number;
  grace_period_minutes: number;
  workday_start: string; workday_end: string; workdays: number[];
}

interface EmployeeTimekeepingPolicy extends TimekeepingSettings {
  employee_profile_id: string;
  enabled: boolean;
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
interface LeaveRequest { id: string; employee_profile_id: string; leave_type_id: string; start_date: string; end_date: string; days: number; reason: string | null; status: string; created_at: string }
interface LeaveBalance { id: string; employee_profile_id: string; leave_type_id: string; year: number; allocated: number; used: number }
interface PayrollPeriod { id: string; name: string; period_start: string; period_end: string; pay_date: string; status: string; currency_code: string }
interface PayrollItem { id: string; payroll_period_id: string; employee_profile_id: string; regular_hours: number; overtime_hours: number; gross_pay: number; deductions: number; net_pay: number }
interface PayrollRule { id: string; name: string; rule_kind: 'earning' | 'deduction'; calculation_type: 'fixed' | 'percentage'; value: number; country_code: string | null; active: boolean }
interface WorkforceHoliday { id: string; holiday_date: string; name: string; country_code: string | null; paid: boolean }

export function WorkforceModule(props: WorkforceProps) {
  if (props.view === 'timekeeping') return <TimekeepingPage {...props} />;
  if (props.view === 'hr') return <HrPage {...props} />;
  if (props.view === 'payroll') return <PayrollPage {...props} />;
  return <ReportsPage {...props} />;
}

function TimekeepingPage({ workspaceId, userId, role, profiles, theme, onNotice }: WorkforceProps) {
  const [employee, setEmployee] = useState<EmployeeProfile | null>(null);
  const [employees, setEmployees] = useState<EmployeeProfile[]>([]);
  const [entries, setEntries] = useState<TimeEntry[]>([]);
  const [policies, setPolicies] = useState<EmployeeTimekeepingPolicy[]>([]);
  const [selectedPolicyEmployeeId, setSelectedPolicyEmployeeId] = useState('');
  const [settings, setSettings] = useState<EmployeeTimekeepingPolicy | null>(null);
  const [adminCanManageEntries, setAdminCanManageEntries] = useState(false);
  const [adminCanManageSettings, setAdminCanManageSettings] = useState(false);
  const [saving, setSaving] = useState(false);
  const [now, setNow] = useState(Date.now());
  const [selfie, setSelfie] = useState<File | null>(null);
  const selfieRef = useRef<HTMLInputElement | null>(null);
  const canConfigure = role === 'owner' || (role === 'admin' && adminCanManageSettings);
  const canClock = role === 'admin' || role === 'member';
  const canManageEntries = role === 'owner' || (role === 'admin' && adminCanManageEntries);

  const load = useCallback(async () => {
    if (!supabase) return;
    const [employeeResult, employeesResult, entriesResult, policiesResult, permissionResult] = await Promise.all([
      supabase.from('employee_profiles').select('*').eq('workspace_id', workspaceId).eq('user_id', userId).maybeSingle(),
      supabase.from('employee_profiles').select('*').eq('workspace_id', workspaceId),
      supabase.from('time_entries').select('*').eq('workspace_id', workspaceId).order('clock_in', { ascending: false }).limit(50),
      supabase.from('employee_timekeeping_policies').select('*').eq('workspace_id', workspaceId),
      supabase.from('workforce_permissions').select('manage_time_entries, manage_timekeeping_settings').eq('workspace_id', workspaceId).eq('user_id', userId).maybeSingle(),
    ]);
    if (employeeResult.error || employeesResult.error || entriesResult.error || policiesResult.error || permissionResult.error) {
      onNotice(employeeResult.error?.message ?? employeesResult.error?.message ?? entriesResult.error?.message ?? policiesResult.error?.message ?? permissionResult.error?.message ?? 'Timekeeping could not be loaded.');
      return;
    }
    const ownEmployee = employeeResult.data as EmployeeProfile | null;
    const nextEmployees = (employeesResult.data ?? []) as EmployeeProfile[];
    const nextPolicies = (policiesResult.data ?? []) as EmployeeTimekeepingPolicy[];
    setEmployee(ownEmployee);
    setEmployees(nextEmployees);
    setEntries((entriesResult.data ?? []) as TimeEntry[]);
    setPolicies(nextPolicies);
    setAdminCanManageEntries(Boolean(permissionResult.data?.manage_time_entries));
    setAdminCanManageSettings(Boolean(permissionResult.data?.manage_timekeeping_settings));
    if (role === 'owner' || (role === 'admin' && permissionResult.data?.manage_timekeeping_settings)) {
      setSelectedPolicyEmployeeId((current) => current && nextPolicies.some((policy) => policy.employee_profile_id === current) ? current : nextPolicies[0]?.employee_profile_id ?? '');
    } else {
      setSettings(nextPolicies.find((policy) => policy.employee_profile_id === ownEmployee?.id) ?? null);
    }
  }, [onNotice, userId, workspaceId]);

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
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [load, workspaceId]);

  const ownEntries = entries.filter((entry) => entry.employee_profile_id === employee?.id);
  const visibleEntries = role === 'owner' || role === 'admin' ? entries : ownEntries;
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
        selfiePath = `${workspaceId}/${userId}/selfies/${crypto.randomUUID()}-${selfie.name}`;
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
    const { error } = await supabase.from('employee_timekeeping_policies').update({
      capture_location: settings.capture_location, capture_ip: settings.capture_ip,
      capture_device: settings.capture_device, require_selfie: settings.require_selfie,
      enforce_geofence: settings.enforce_geofence, office_latitude: settings.office_latitude,
      office_longitude: settings.office_longitude, geofence_radius_meters: settings.geofence_radius_meters,
      standard_daily_hours: settings.standard_daily_hours, grace_period_minutes: settings.grace_period_minutes,
      workday_start: settings.workday_start, workday_end: settings.workday_end, workdays: settings.workdays,
      updated_at: new Date().toISOString(), updated_by: userId,
    }).eq('employee_profile_id', settings.employee_profile_id);
    setSaving(false);
    if (error) onNotice(error.message); else { onNotice('Employee timekeeping policy saved.'); await load(); }
  };
  const adjustEntry = async (entry: TimeEntry) => {
    if (!supabase || !canManageEntries) return;
    const clockIn = window.prompt('Clock in (ISO date/time)', entry.clock_in); if (!clockIn) return;
    const clockOut = window.prompt('Clock out (ISO date/time, blank if active)', entry.clock_out ?? '');
    const { error } = await supabase.from('time_entries').update({ clock_in: new Date(clockIn).toISOString(), clock_out: clockOut ? new Date(clockOut).toISOString() : null, updated_at: new Date().toISOString() }).eq('id', entry.id);
    if (error) onNotice(error.message); else { onNotice('Attendance entry updated.'); await load(); }
  };
  const deleteEntry = async (entry: TimeEntry) => {
    if (!supabase || !canManageEntries || !window.confirm('Delete this attendance entry?')) return;
    const { error } = await supabase.from('time_entries').delete().eq('id', entry.id);
    if (error) onNotice(error.message); else { onNotice('Attendance entry deleted.'); await load(); }
  };

  return (
    <ModuleFrame icon={Clock3} title="Timekeeping" subtitle="Attendance and working hours" theme={theme}>
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
          <DataTable headers={[...(role === 'owner' || role === 'admin' ? ['Employee'] : []), 'Date', 'Clock in', 'Clock out', 'Break', 'Hours', ...(canManageEntries ? ['Actions'] : [])]} theme={theme}>
            {visibleEntries.map((entry) => <tr key={entry.id} className={cn('border-b last:border-0', border(theme))}>
              {(role === 'owner' || role === 'admin') && <Cell strong>{employeeName(employees.find((item) => item.id === entry.employee_profile_id), profiles)}</Cell>}<Cell>{formatDate(entry.work_date)}</Cell><Cell>{formatTime(entry.clock_in)}</Cell><Cell>{entry.clock_out ? formatTime(entry.clock_out) : 'Active'}</Cell><Cell>{formatDuration(entry.break_seconds / 3600)}</Cell><Cell strong>{formatDuration(workedHours(entry, now))}</Cell>{canManageEntries && <Cell><div className="flex gap-2"><IconAction label="Edit attendance" icon={Pencil} onClick={() => void adjustEntry(entry)} /><IconAction label="Delete attendance" icon={Trash2} onClick={() => void deleteEntry(entry)} /></div></Cell>}
            </tr>)}
          </DataTable>
        </div>
        {canConfigure && <aside className={cn('h-fit rounded-lg border p-4', panel(theme))}>
          <h3 className="font-bold">Employee clock-in policy</h3>
          <p className={cn('mt-1 text-xs leading-5', muted(theme))}>Requirements are configured separately for each Admin or Member.</p>
          <label className="mt-4 block"><span className={cn('mb-1 block text-xs font-semibold', muted(theme))}>Employee</span><select value={selectedPolicyEmployeeId} onChange={(event) => setSelectedPolicyEmployeeId(event.target.value)} className={cn('h-11 w-full rounded-lg border px-3 text-sm font-semibold', panel(theme))}>{policies.map((policy) => <option key={policy.employee_profile_id} value={policy.employee_profile_id}>{employeeName(employees.find((item) => item.id === policy.employee_profile_id), profiles)}</option>)}</select></label>
          {settings && <div className={cn('mt-4 border-t pt-4', border(theme))}>
            {(['capture_location', 'capture_ip', 'capture_device', 'require_selfie', 'enforce_geofence'] as const).map((key) => <div key={key}><Toggle checked={settings[key]} onChange={(checked) => setSettings({ ...settings, [key]: checked })} label={settingLabel(key)} /></div>)}
            {settings.enforce_geofence && <div className="mt-3 grid grid-cols-2 gap-2"><SmallInput label="Latitude" value={settings.office_latitude ?? ''} onChange={(value) => setSettings({ ...settings, office_latitude: numberOrNull(value) })} theme={theme} /><SmallInput label="Longitude" value={settings.office_longitude ?? ''} onChange={(value) => setSettings({ ...settings, office_longitude: numberOrNull(value) })} theme={theme} /><SmallInput label="Radius (m)" value={settings.geofence_radius_meters} onChange={(value) => setSettings({ ...settings, geofence_radius_meters: Number(value) })} theme={theme} /></div>}
            <div className="mt-4 grid grid-cols-2 gap-2"><SmallInput label="Workday starts" value={settings.workday_start?.slice(0, 5) ?? '09:00'} onChange={(value) => setSettings({ ...settings, workday_start: value })} theme={theme} /><SmallInput label="Workday ends" value={settings.workday_end?.slice(0, 5) ?? '17:00'} onChange={(value) => setSettings({ ...settings, workday_end: value })} theme={theme} /><SmallInput label="Grace (minutes)" value={settings.grace_period_minutes} onChange={(value) => setSettings({ ...settings, grace_period_minutes: Number(value) })} theme={theme} /></div>
            <div className="mt-3 flex gap-1">{['S','M','T','W','T','F','S'].map((day, index) => <button key={`${day}-${index}`} type="button" title={['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'][index]} onClick={() => setSettings({ ...settings, workdays: settings.workdays.includes(index) ? settings.workdays.filter((value) => value !== index) : [...settings.workdays, index].sort() })} className={cn('h-8 w-8 rounded-md text-xs font-bold', settings.workdays.includes(index) ? 'bg-[var(--accent)] text-[var(--accent-ink)]' : buttonSurface(theme))}>{day}</button>)}</div>
            <button onClick={() => void saveSettings()} disabled={saving} className="mt-4 h-10 w-full rounded-lg bg-[var(--accent)] px-4 text-sm font-bold text-[var(--accent-ink)]">Save settings</button>
          </div>}
          {!settings && <p className={cn('mt-4 text-sm', muted(theme))}>No Admin or Member employee profiles are available.</p>}
        </aside>}
      </div>
    </ModuleFrame>
  );
}

function HrPage({ workspaceId, userId, role, profiles, theme, onNotice }: WorkforceProps) {
  const [employees, setEmployees] = useState<EmployeeProfile[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [query, setQuery] = useState('');
  const [leaveTypes, setLeaveTypes] = useState<LeaveType[]>([]);
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>([]);
  const [leaveBalances, setLeaveBalances] = useState<LeaveBalance[]>([]);
  const [tab, setTab] = useState<'people' | 'leave' | 'documents' | 'performance' | 'compensation'>('people');
  const [editing, setEditing] = useState<EmployeeProfile | null>(null);
  const [saving, setSaving] = useState(false);
  const canManage = role === 'owner' || role === 'admin';

  const load = useCallback(async () => {
    if (!supabase) return;
    const [employeesResult, typesResult, requestsResult, balancesResult] = await Promise.all([
      supabase.from('employee_profiles').select('*').eq('workspace_id', workspaceId).order('last_name'),
      supabase.from('leave_types').select('*').eq('workspace_id', workspaceId).eq('active', true).order('name'),
      supabase.from('leave_requests').select('*').eq('workspace_id', workspaceId).order('created_at', { ascending: false }),
      supabase.from('leave_balances').select('*').eq('workspace_id', workspaceId),
    ]);
    if (employeesResult.error || typesResult.error || requestsResult.error || balancesResult.error) { onNotice(employeesResult.error?.message ?? typesResult.error?.message ?? requestsResult.error?.message ?? balancesResult.error?.message ?? 'HR data could not be loaded.'); return; }
    const next = (employeesResult.data ?? []) as EmployeeProfile[];
    setEmployees(next); setLeaveTypes((typesResult.data ?? []) as LeaveType[]); setLeaveRequests((requestsResult.data ?? []) as LeaveRequest[]); setLeaveBalances((balancesResult.data ?? []) as LeaveBalance[]);
    setSelectedId((current) => current || next.find((employee) => employee.user_id === userId)?.id || next[0]?.id || '');
  }, [onNotice, userId, workspaceId]);
  useEffect(() => { void load(); }, [load]);
  useWorkforceRealtime(workspaceId, 'employee_profiles,leave_requests,leave_balances,employee_documents,performance_records', load);

  const selected = employees.find((employee) => employee.id === selectedId) ?? null;
  useEffect(() => { setEditing(selected ? { ...selected } : null); }, [selected]);
  const filtered = employees.filter((employee) => employeeName(employee, profiles).toLowerCase().includes(query.toLowerCase()) || (employee.department ?? '').toLowerCase().includes(query.toLowerCase()));

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

  const requestLeave = async () => {
    if (!supabase || !selected) return;
    const leaveTypeId = leaveTypes[0]?.id;
    if (!leaveTypeId) return onNotice('No leave types are configured.');
    const start = window.prompt('Leave start date (YYYY-MM-DD)'); if (!start) return;
    const end = window.prompt('Leave end date (YYYY-MM-DD)', start); if (!end) return;
    const reason = window.prompt('Reason (optional)') ?? '';
    const days = Math.max(1, Math.round((new Date(end).getTime() - new Date(start).getTime()) / 86400000) + 1);
    const { error } = await supabase.from('leave_requests').insert({ workspace_id: workspaceId, employee_profile_id: selected.id, leave_type_id: leaveTypeId, start_date: start, end_date: end, days, reason });
    if (error) onNotice(error.message); else { onNotice('Leave request submitted.'); await load(); }
  };

  const reviewLeave = async (id: string, status: 'approved' | 'rejected') => {
    if (!supabase) return; const { error } = await supabase.from('leave_requests').update({ status, reviewed_by: userId, reviewed_at: new Date().toISOString() }).eq('id', id);
    if (error) onNotice(error.message); else await load();
  };
  const setLeaveAllocation = async (leaveTypeId: string) => {
    if (!supabase || !selected || !canManage) return;
    const current = leaveBalances.find((balance) => balance.employee_profile_id === selected.id && balance.leave_type_id === leaveTypeId && balance.year === new Date().getFullYear());
    const allocated = Number(window.prompt('Annual leave allocation', String(current?.allocated ?? 0))); if (!Number.isFinite(allocated) || allocated < 0) return;
    const { error } = await supabase.from('leave_balances').upsert({ workspace_id: workspaceId, employee_profile_id: selected.id, leave_type_id: leaveTypeId, year: new Date().getFullYear(), allocated, used: current?.used ?? 0 }, { onConflict: 'employee_profile_id,leave_type_id,year' });
    if (error) onNotice(error.message); else await load();
  };

  return <ModuleFrame icon={BriefcaseBusiness} title="HR" subtitle={canManage ? 'People, leave, documents, and performance' : 'Your employment profile and leave'} theme={theme}>
    <Segmented options={[['people', canManage ? 'People' : 'Profile'], ['leave', 'Leave'], ['documents', 'Documents'], ['performance', 'Performance'], ...(canManage ? [['compensation', 'Compensation']] : [])]} value={tab} onChange={(value) => setTab(value as typeof tab)} theme={theme} />
    {tab === 'people' && <div className={cn('mt-5 grid min-h-0 gap-5', canManage ? 'lg:grid-cols-[280px_minmax(0,1fr)]' : 'max-w-4xl')}>
      {canManage && <div><label className={cn('flex h-10 items-center gap-2 rounded-lg border px-3', panel(theme))}><Search className="h-4 w-4" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search employees" className="min-w-0 flex-1 bg-transparent text-sm outline-none" /></label><div className="mt-3 space-y-1">{filtered.map((employee) => <button key={employee.id} onClick={() => setSelectedId(employee.id)} className={cn('flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left', selectedId === employee.id ? 'bg-[var(--accent-soft)] text-[var(--accent-strong)]' : theme === 'dark' ? 'hover:bg-white/5' : 'hover:bg-[#F0EDF3]')}><MiniAvatar profile={profiles[employee.user_id]} /><span className="min-w-0"><strong className="block truncate text-sm">{employeeName(employee, profiles)}</strong><span className={cn('block truncate text-xs', muted(theme))}>{employee.position || employee.department || 'Employee'}</span></span></button>)}</div></div>}
      {editing && <div className={cn('rounded-lg border p-5', panel(theme))}><div className="mb-5 flex items-center gap-3"><MiniAvatar profile={profiles[editing.user_id]} large /><div><h3 className="text-lg font-bold">{employeeName(editing, profiles)}</h3><p className={cn('text-sm', muted(theme))}>{profiles[editing.user_id]?.email}</p></div></div><div className="grid gap-4 sm:grid-cols-2"><Field label="First name" value={editing.first_name ?? ''} onChange={(value) => setEditing({ ...editing, first_name: value })} theme={theme} /><Field label="Last name" value={editing.last_name ?? ''} onChange={(value) => setEditing({ ...editing, last_name: value })} theme={theme} /><Field label="Contact number" value={editing.contact_number ?? ''} onChange={(value) => setEditing({ ...editing, contact_number: value })} theme={theme} /><Field label="Birthday" type="date" value={editing.birthday ?? ''} onChange={(value) => setEditing({ ...editing, birthday: value || null })} theme={theme} /><Field label="Address" value={editing.address ?? ''} onChange={(value) => setEditing({ ...editing, address: value })} theme={theme} wide /><Field label="Emergency contact" value={editing.emergency_contact_name ?? ''} onChange={(value) => setEditing({ ...editing, emergency_contact_name: value })} theme={theme} /><Field label="Emergency number" value={editing.emergency_contact_number ?? ''} onChange={(value) => setEditing({ ...editing, emergency_contact_number: value })} theme={theme} />{canManage && <><Field label="Employee number" value={editing.employee_number ?? ''} onChange={(value) => setEditing({ ...editing, employee_number: value || null })} theme={theme} /><Field label="Department" value={editing.department ?? ''} onChange={(value) => setEditing({ ...editing, department: value || null })} theme={theme} /><Field label="Position" value={editing.position ?? ''} onChange={(value) => setEditing({ ...editing, position: value || null })} theme={theme} /><Field label="Hire date" type="date" value={editing.hire_date ?? ''} onChange={(value) => setEditing({ ...editing, hire_date: value || null })} theme={theme} /><SelectField label="Employment type" value={editing.employment_type ?? ''} options={['', 'full_time', 'part_time', 'contractor', 'temporary', 'intern']} onChange={(value) => setEditing({ ...editing, employment_type: value || null })} theme={theme} /><SelectField label="Status" value={editing.employment_status} options={['active', 'inactive', 'on_leave', 'terminated']} onChange={(value) => setEditing({ ...editing, employment_status: value })} theme={theme} /><label className="block"><span className={cn('mb-1 block text-xs font-semibold', muted(theme))}>Manager</span><select value={editing.manager_user_id ?? ''} onChange={(event) => setEditing({ ...editing, manager_user_id: event.target.value || null })} className={cn('h-11 w-full rounded-lg border px-3 text-sm', panel(theme))}><option value="">Not assigned</option>{employees.filter((employee) => employee.id !== editing.id).map((employee) => <option key={employee.id} value={employee.user_id}>{employeeName(employee, profiles)}</option>)}</select></label></>}</div><button onClick={() => void saveProfile()} disabled={saving} className="mt-5 h-11 rounded-lg bg-[var(--accent)] px-5 text-sm font-bold text-[var(--accent-ink)]">Save profile</button></div>}
    </div>}
    {tab === 'leave' && <div className="mt-5"><div className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{leaveTypes.map((type) => { const balance = leaveBalances.find((item) => item.employee_profile_id === selected?.id && item.leave_type_id === type.id && item.year === new Date().getFullYear()); const remaining = Number(balance?.allocated ?? type.annual_allowance) - Number(balance?.used ?? 0); return <button key={type.id} type="button" onClick={() => void setLeaveAllocation(type.id)} disabled={!canManage} className={cn('rounded-lg border p-4 text-left', panel(theme))}><span className={cn('text-xs font-semibold', muted(theme))}>{type.name}</span><strong className="mt-1 block text-xl">{remaining} days</strong></button>; })}</div><div className="mb-4 flex items-center justify-between"><div><h3 className="font-bold">Leave requests</h3><p className={cn('text-sm', muted(theme))}>{leaveRequests.length} requests</p></div><button onClick={() => void requestLeave()} className="inline-flex h-10 items-center gap-2 rounded-lg bg-[var(--accent)] px-4 text-sm font-bold text-[var(--accent-ink)]"><Plus className="h-4 w-4" />Request leave</button></div><DataTable headers={['Employee', 'Type', 'Dates', 'Days', 'Status', 'Actions']} theme={theme}>{leaveRequests.map((request) => <tr key={request.id} className={cn('border-b last:border-0', border(theme))}><Cell strong>{employeeName(employees.find((employee) => employee.id === request.employee_profile_id), profiles)}</Cell><Cell>{leaveTypes.find((type) => type.id === request.leave_type_id)?.name ?? 'Leave'}</Cell><Cell>{formatDate(request.start_date)} – {formatDate(request.end_date)}</Cell><Cell>{request.days}</Cell><Cell><StatusPill value={request.status} /></Cell><Cell>{canManage && request.status === 'pending' ? <div className="flex gap-2"><IconAction label="Approve" icon={Check} onClick={() => void reviewLeave(request.id, 'approved')} /><IconAction label="Reject" icon={Square} onClick={() => void reviewLeave(request.id, 'rejected')} /></div> : '—'}</Cell></tr>)}</DataTable></div>}
    {tab === 'documents' && <DocumentPanel workspaceId={workspaceId} userId={userId} employee={selected} canManage={canManage} theme={theme} onNotice={onNotice} />}
    {tab === 'performance' && <PerformancePanel workspaceId={workspaceId} userId={userId} employee={selected} canManage={canManage} theme={theme} onNotice={onNotice} />}
    {tab === 'compensation' && canManage && <CompensationPanel workspaceId={workspaceId} userId={userId} employee={selected} role={role} theme={theme} onNotice={onNotice} />}
  </ModuleFrame>;
}

function PayrollPage({ workspaceId, userId, role, profiles, theme, onNotice }: WorkforceProps) {
  const [periods, setPeriods] = useState<PayrollPeriod[]>([]); const [items, setItems] = useState<PayrollItem[]>([]); const [employees, setEmployees] = useState<EmployeeProfile[]>([]); const [settings, setSettings] = useState<WorkforceSettings | null>(null); const [rules, setRules] = useState<PayrollRule[]>([]); const [selectedPeriod, setSelectedPeriod] = useState(''); const [busy, setBusy] = useState(false);
  const canManage = role === 'owner' || role === 'admin';
  const load = useCallback(async () => { if (!supabase) return; const [p, i, e, s, r] = await Promise.all([supabase.from('payroll_periods').select('*').eq('workspace_id', workspaceId).order('period_start', { ascending: false }), supabase.from('payroll_items').select('*').eq('workspace_id', workspaceId), supabase.from('employee_profiles').select('*').eq('workspace_id', workspaceId), supabase.from('workforce_settings').select('*').eq('workspace_id', workspaceId).maybeSingle(), supabase.from('payroll_rules').select('*').eq('workspace_id', workspaceId).order('name')]); const error = p.error ?? i.error ?? e.error ?? s.error ?? r.error; if (error) return onNotice(error.message); setPeriods((p.data ?? []) as PayrollPeriod[]); setItems((i.data ?? []) as PayrollItem[]); setEmployees((e.data ?? []) as EmployeeProfile[]); setSettings(s.data as WorkforceSettings | null); setRules((r.data ?? []) as PayrollRule[]); setSelectedPeriod((current) => current || p.data?.[0]?.id || ''); }, [onNotice, workspaceId]);
  useEffect(() => { void load(); }, [load]);
  useWorkforceRealtime(workspaceId, 'payroll_periods,payroll_items,payroll_rules', load);
  const period = periods.find((item) => item.id === selectedPeriod); const periodItems = items.filter((item) => item.payroll_period_id === selectedPeriod); const formatter = new Intl.NumberFormat(settings?.locale ?? 'en-US', { style: 'currency', currency: settings?.currency_code ?? 'USD' });
  const createPeriod = async () => { if (!supabase || !settings) return; const start = window.prompt('Period start (YYYY-MM-DD)'); if (!start) return; const end = window.prompt('Period end (YYYY-MM-DD)'); if (!end) return; const payDate = window.prompt('Pay date (YYYY-MM-DD)', end); if (!payDate) return; const { error } = await supabase.from('payroll_periods').insert({ workspace_id: workspaceId, name: `${formatDate(start)} – ${formatDate(end)}`, period_start: start, period_end: end, pay_date: payDate, currency_code: settings.currency_code, created_by: userId }); if (error) onNotice(error.message); else await load(); };
  const generate = async () => { if (!supabase || !period) return; setBusy(true); const { data, error } = await supabase.rpc('generate_payroll', { target_payroll_period_id: period.id }); setBusy(false); if (error) onNotice(error.message); else { onNotice(`Payroll calculated for ${data ?? 0} employees.`); await load(); } };
  const setStatus = async (status: string) => { if (!supabase || !period) return; const { error } = await supabase.from('payroll_periods').update({ status, ...(status === 'approved' ? { approved_by: userId, approved_at: new Date().toISOString() } : {}) }).eq('id', period.id); if (error) onNotice(error.message); else await load(); };
  const saveHubSettings = async () => { if (!supabase || !settings || role !== 'owner') return; const { error } = await supabase.from('workforce_settings').update({ country_code: settings.country_code, currency_code: settings.currency_code, locale: settings.locale, timezone: settings.timezone, payroll_frequency: settings.payroll_frequency, updated_at: new Date().toISOString() }).eq('workspace_id', workspaceId); if (error) onNotice(error.message); else onNotice('Payroll settings saved.'); };
  const addRule = async () => { if (!supabase || !settings) return; const name = window.prompt('Payroll rule name'); if (!name) return; const kind = window.prompt('Type: earning or deduction', 'deduction'); if (kind !== 'earning' && kind !== 'deduction') return onNotice('Rule type must be earning or deduction.'); const calculation = window.prompt('Calculation: fixed or percentage', 'percentage'); if (calculation !== 'fixed' && calculation !== 'percentage') return onNotice('Calculation must be fixed or percentage.'); const value = Number(window.prompt(calculation === 'percentage' ? 'Percentage value' : `Fixed amount (${settings.currency_code})`, '0')); if (!Number.isFinite(value) || value < 0) return onNotice('Enter a valid non-negative value.'); const { error } = await supabase.from('payroll_rules').insert({ workspace_id: workspaceId, name, rule_kind: kind, calculation_type: calculation, value, country_code: settings.country_code }); if (error) onNotice(error.message); else await load(); };
  const deleteRule = async (ruleId: string) => { if (!supabase || !window.confirm('Delete this payroll rule?')) return; const { error } = await supabase.from('payroll_rules').delete().eq('id', ruleId); if (error) onNotice(error.message); else await load(); };
  return <ModuleFrame icon={Banknote} title="Payroll" subtitle={canManage ? 'Pay periods and compensation' : 'Your pay statements'} theme={theme}>
    {role === 'owner' && settings && <details className={cn('mb-5 rounded-lg border p-4', panel(theme))}><summary className="cursor-pointer font-bold">Hub payroll settings</summary><div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5"><Field label="Country" value={settings.country_code} onChange={(value) => setSettings({ ...settings, country_code: value.toUpperCase() })} theme={theme} /><Field label="Currency" value={settings.currency_code} onChange={(value) => setSettings({ ...settings, currency_code: value.toUpperCase() })} theme={theme} /><Field label="Locale" value={settings.locale} onChange={(value) => setSettings({ ...settings, locale: value })} theme={theme} /><Field label="Time zone" value={settings.timezone} onChange={(value) => setSettings({ ...settings, timezone: value })} theme={theme} /><SelectField label="Frequency" value={settings.payroll_frequency} options={['weekly', 'biweekly', 'semimonthly', 'monthly']} onChange={(value) => setSettings({ ...settings, payroll_frequency: value })} theme={theme} /></div><button onClick={() => void saveHubSettings()} className="mt-4 h-10 rounded-lg bg-[var(--accent)] px-4 text-sm font-bold text-[var(--accent-ink)]">Save Hub settings</button></details>}
    {canManage && <details className={cn('mb-5 rounded-lg border p-4', panel(theme))}><summary className="cursor-pointer font-bold">Payroll rules ({rules.length})</summary><div className="mt-3 space-y-2">{rules.map((rule) => <div key={rule.id} className="flex items-center justify-between gap-3 rounded-lg border border-current/10 px-3 py-2"><span><strong className="block text-sm">{rule.name}</strong><span className={cn('text-xs capitalize', muted(theme))}>{rule.rule_kind} · {rule.calculation_type} · {rule.value}{rule.calculation_type === 'percentage' ? '%' : ` ${settings?.currency_code ?? ''}`}</span></span><button aria-label="Delete payroll rule" title="Delete payroll rule" onClick={() => void deleteRule(rule.id)} className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-[#FCA5A5] text-[#B91C1C]"><Trash2 className="h-3.5 w-3.5" /></button></div>)}</div><button onClick={() => void addRule()} className={cn('mt-3 inline-flex h-9 items-center gap-2 rounded-lg border px-3 text-sm font-semibold', buttonSurface(theme))}><Plus className="h-4 w-4" />Add rule</button></details>}
    <div className="flex flex-wrap items-center justify-between gap-3"><select value={selectedPeriod} onChange={(event) => setSelectedPeriod(event.target.value)} className={cn('h-11 min-w-64 rounded-lg border px-3 text-sm', panel(theme))}><option value="">Select pay period</option>{periods.map((item) => <option key={item.id} value={item.id}>{item.name} · {item.status}</option>)}</select>{canManage && <div className="flex gap-2"><button onClick={() => void createPeriod()} className={cn('inline-flex h-10 items-center gap-2 rounded-lg border px-4 text-sm font-semibold', buttonSurface(theme))}><Plus className="h-4 w-4" />New period</button>{period && <button onClick={() => void generate()} disabled={busy} className="inline-flex h-10 items-center gap-2 rounded-lg bg-[var(--accent)] px-4 text-sm font-bold text-[var(--accent-ink)]"><RefreshCw className="h-4 w-4" />Calculate</button>}</div>}</div>
    {period && <><div className="mt-5 grid gap-4 sm:grid-cols-3"><Metric label="Gross payroll" value={formatter.format(periodItems.reduce((sum, item) => sum + Number(item.gross_pay), 0))} theme={theme} /><Metric label="Net payroll" value={formatter.format(periodItems.reduce((sum, item) => sum + Number(item.net_pay), 0))} theme={theme} /><Metric label="Status" value={period.status} accent theme={theme} /></div>{canManage && period.status === 'calculated' && <button onClick={() => void setStatus('approved')} className="mt-4 h-10 rounded-lg bg-[#16A34A] px-4 text-sm font-bold text-white">Approve payroll</button>}{canManage && period.status === 'approved' && <button onClick={() => void setStatus('paid')} className="mt-4 h-10 rounded-lg bg-[var(--accent)] px-4 text-sm font-bold text-[var(--accent-ink)]">Mark paid</button>}<div className="mt-5"><DataTable headers={['Employee', 'Regular hours', 'Overtime', 'Gross', 'Deductions', 'Net']} theme={theme}>{periodItems.map((item) => <tr key={item.id} className={cn('border-b last:border-0', border(theme))}><Cell strong>{employeeName(employees.find((employee) => employee.id === item.employee_profile_id), profiles)}</Cell><Cell>{Number(item.regular_hours).toFixed(2)}</Cell><Cell>{Number(item.overtime_hours).toFixed(2)}</Cell><Cell>{formatter.format(item.gross_pay)}</Cell><Cell>{formatter.format(item.deductions)}</Cell><Cell strong>{formatter.format(item.net_pay)}</Cell></tr>)}</DataTable></div></>}
    {!period && <EmptyState icon={Banknote} title="No payroll period selected" body={canManage ? 'Create the first pay period to calculate payroll from attendance.' : 'Your pay statements will appear here.'} theme={theme} />}
  </ModuleFrame>;
}

function ReportsPage({ workspaceId, profiles, theme, onNotice, userId }: WorkforceProps) {
  const [employees, setEmployees] = useState<EmployeeProfile[]>([]); const [entries, setEntries] = useState<TimeEntry[]>([]); const [leave, setLeave] = useState<LeaveRequest[]>([]); const [payroll, setPayroll] = useState<PayrollItem[]>([]); const [settings, setSettings] = useState<WorkforceSettings | null>(null); const [timeSettings, setTimeSettings] = useState<TimekeepingSettings | null>(null); const [holidays, setHolidays] = useState<WorkforceHoliday[]>([]); const [from, setFrom] = useState(monthStart()); const [to, setTo] = useState(today()); const [department, setDepartment] = useState('all'); const [employeeId, setEmployeeId] = useState('all');
  const load = useCallback(async () => { if (!supabase) return; const [e, t, l, p, s, ts, h] = await Promise.all([supabase.from('employee_profiles').select('*').eq('workspace_id', workspaceId), supabase.from('time_entries').select('*').eq('workspace_id', workspaceId).gte('work_date', from).lte('work_date', to), supabase.from('leave_requests').select('*').eq('workspace_id', workspaceId).lte('start_date', to).gte('end_date', from), supabase.from('payroll_items').select('*').eq('workspace_id', workspaceId), supabase.from('workforce_settings').select('*').eq('workspace_id', workspaceId).maybeSingle(), supabase.from('timekeeping_settings').select('*').eq('workspace_id', workspaceId).maybeSingle(), supabase.from('workforce_holidays').select('*').eq('workspace_id', workspaceId).gte('holiday_date', from).lte('holiday_date', to).order('holiday_date')]); const error = e.error ?? t.error ?? l.error ?? p.error ?? s.error ?? ts.error ?? h.error; if (error) return onNotice(error.message); setEmployees((e.data ?? []) as EmployeeProfile[]); setEntries((t.data ?? []) as TimeEntry[]); setLeave((l.data ?? []) as LeaveRequest[]); setPayroll((p.data ?? []) as PayrollItem[]); setSettings(s.data as WorkforceSettings | null); setTimeSettings(ts.data as TimekeepingSettings | null); setHolidays((h.data ?? []) as WorkforceHoliday[]); }, [from, onNotice, to, workspaceId]); useEffect(() => { void load(); }, [load]);
  useWorkforceRealtime(workspaceId, 'employee_profiles,time_entries,leave_requests,payroll_items,workforce_holidays', load);
  const localToday = dateInTimezone(settings?.timezone ?? 'UTC'); const filteredEmployees = employees.filter((employee) => (department === 'all' || employee.department === department) && (employeeId === 'all' || employee.id === employeeId)); const ids = new Set(filteredEmployees.map((employee) => employee.id)); const filteredEntries = entries.filter((entry) => ids.has(entry.employee_profile_id)); const filteredLeave = leave.filter((request) => ids.has(request.employee_profile_id)); const filteredPayroll = payroll.filter((item) => ids.has(item.employee_profile_id)); const todayEntries = filteredEntries.filter((entry) => entry.work_date === localToday); const presentIds = new Set(todayEntries.map((entry) => entry.employee_profile_id)); const leaveTodayIds = new Set(filteredLeave.filter((request) => request.status === 'approved' && request.start_date <= localToday && request.end_date >= localToday).map((request) => request.employee_profile_id)); const holidayToday = holidays.some((holiday) => holiday.holiday_date === localToday); const scheduledToday = Boolean(timeSettings?.workdays?.includes(dayInTimezone(settings?.timezone ?? 'UTC')) && !holidayToday); const absent = scheduledToday ? filteredEmployees.filter((employee) => employee.employment_status === 'active' && !presentIds.has(employee.id) && !leaveTodayIds.has(employee.id)).length : 0; const startMinutes = parseTimeMinutes(timeSettings?.workday_start ?? '09:00') + Number(timeSettings?.grace_period_minutes ?? 0); const late = todayEntries.filter((entry) => timeMinutesInTimezone(entry.clock_in, settings?.timezone ?? 'UTC') > startMinutes).length; const totalHours = filteredEntries.reduce((sum, entry) => sum + workedHours(entry, Date.now()), 0); const overtime = filteredEntries.reduce((sum, entry) => sum + Math.max(0, workedHours(entry, Date.now()) - 8), 0); const formatter = new Intl.NumberFormat(settings?.locale ?? 'en-US', { style: 'currency', currency: settings?.currency_code ?? 'USD' }); const departments = [...new Set(employees.map((employee) => employee.department).filter(Boolean))] as string[];
  const addHoliday = async () => { if (!supabase) return; const date = window.prompt('Holiday date (YYYY-MM-DD)'); if (!date) return; const name = window.prompt('Holiday name'); if (!name) return; const { error } = await supabase.from('workforce_holidays').insert({ workspace_id: workspaceId, holiday_date: date, name, country_code: settings?.country_code, paid: true }); if (error) onNotice(error.message); else await load(); };
  const deleteHoliday = async (id: string) => { if (!supabase) return; const { error } = await supabase.from('workforce_holidays').delete().eq('id', id); if (error) onNotice(error.message); else await load(); };
  return <ModuleFrame icon={Gauge} title="Reports" subtitle="Workforce health and payroll overview" theme={theme}><div className="mb-5 flex flex-wrap gap-3"><Field label="From" type="date" value={from} onChange={setFrom} theme={theme} compact /><Field label="To" type="date" value={to} onChange={setTo} theme={theme} compact /><SelectField label="Department" value={department} options={['all', ...departments]} onChange={setDepartment} theme={theme} compact /><select aria-label="Employee filter" value={employeeId} onChange={(event) => setEmployeeId(event.target.value)} className={cn('mt-6 h-10 rounded-lg border px-3 text-sm', panel(theme))}><option value="all">All employees</option>{employees.map((employee) => <option key={employee.id} value={employee.id}>{employeeName(employee, profiles)}</option>)}</select></div><div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><Metric label="Employees present" value={String(presentIds.size)} theme={theme} accent /><Metric label="Employees late" value={String(late)} theme={theme} /><Metric label="Employees absent" value={String(absent)} theme={theme} /><Metric label="Employees on leave" value={String(leaveTodayIds.size)} theme={theme} /><Metric label="Total hours" value={formatDuration(totalHours)} theme={theme} /><Metric label="Overtime" value={formatDuration(overtime)} theme={theme} /><Metric label="Payroll total" value={formatter.format(filteredPayroll.reduce((sum, item) => sum + Number(item.net_pay), 0))} theme={theme} /><Metric label="Pending leave" value={String(filteredLeave.filter((request) => request.status === 'pending').length)} theme={theme} /></div><div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]"><div><h3 className="mb-3 font-bold">Attendance summary</h3><DataTable headers={['Employee', 'Department', 'Days recorded', 'Hours', 'Overtime']} theme={theme}>{filteredEmployees.map((employee) => { const own = filteredEntries.filter((entry) => entry.employee_profile_id === employee.id); const hours = own.reduce((sum, entry) => sum + workedHours(entry, Date.now()), 0); return <tr key={employee.id} className={cn('border-b last:border-0', border(theme))}><Cell strong>{employeeName(employee, profiles)}</Cell><Cell>{employee.department || '—'}</Cell><Cell>{new Set(own.map((entry) => entry.work_date)).size}</Cell><Cell>{formatDuration(hours)}</Cell><Cell>{formatDuration(own.reduce((sum, entry) => sum + Math.max(0, workedHours(entry, Date.now()) - 8), 0))}</Cell></tr>; })}</DataTable></div><aside className={cn('h-fit rounded-lg border p-4', panel(theme))}><div className="flex items-center justify-between"><h3 className="font-bold">Holidays</h3><button aria-label="Add holiday" title="Add holiday" onClick={() => void addHoliday()} className={cn('inline-flex h-8 w-8 items-center justify-center rounded-md border', buttonSurface(theme))}><Plus className="h-4 w-4" /></button></div><div className="mt-3 space-y-2">{holidays.map((holiday) => <div key={holiday.id} className="flex items-center justify-between gap-2 text-sm"><span><strong className="block">{holiday.name}</strong><span className={muted(theme)}>{formatDate(holiday.holiday_date)}</span></span><button aria-label="Delete holiday" title="Delete holiday" onClick={() => void deleteHoliday(holiday.id)} className="text-[#B91C1C]"><Trash2 className="h-4 w-4" /></button></div>)}{holidays.length === 0 && <p className={cn('text-sm', muted(theme))}>No holidays in this range.</p>}</div></aside></div></ModuleFrame>;
}

function DocumentPanel({ workspaceId, userId, employee, canManage, theme, onNotice }: { workspaceId: string; userId: string; employee: EmployeeProfile | null; canManage: boolean; theme: Theme; onNotice: (message: string) => void }) {
  const [documents, setDocuments] = useState<{ id: string; document_type: string; filename: string; object_path: string; created_at: string }[]>([]);
  const load = useCallback(async () => { if (!supabase || !employee) return; const { data, error } = await supabase.from('employee_documents').select('*').eq('employee_profile_id', employee.id).order('created_at', { ascending: false }); if (error) onNotice(error.message); else setDocuments(data ?? []); }, [employee, onNotice]); useEffect(() => { void load(); }, [load]);
  const upload = async (file: File) => { if (!supabase || !employee) return; const allowed = ['resume', 'offer_letter', 'employment_contract', 'nda', 'tax_form', 'identity', 'certificate', 'other']; const requestedType = window.prompt('Document type: resume, offer_letter, employment_contract, nda, tax_form, identity, certificate, or other', 'other') ?? 'other'; const documentType = allowed.includes(requestedType) ? requestedType : 'other'; const path = `${workspaceId}/${employee.user_id}/documents/${crypto.randomUUID()}-${file.name}`; const { error: uploadError } = await supabase.storage.from('employee-documents').upload(path, file); if (uploadError) return onNotice(uploadError.message); const { error } = await supabase.from('employee_documents').insert({ workspace_id: workspaceId, employee_profile_id: employee.id, document_type: documentType, filename: file.name, object_path: path, uploaded_by: userId }); if (error) onNotice(error.message); else await load(); };
  if (!employee) return <EmptyState icon={FileUp} title="Select an employee" body="Choose an employee to view documents." theme={theme} />;
  return <div className="mt-5"><label className={cn('inline-flex h-10 cursor-pointer items-center gap-2 rounded-lg border px-4 text-sm font-semibold', buttonSurface(theme))}><FileUp className="h-4 w-4" />Upload document<input type="file" className="hidden" onChange={(event) => { const file = event.target.files?.[0]; if (file) void upload(file); }} /></label><div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{documents.map((document) => <div key={document.id} className={cn('rounded-lg border p-4', panel(theme))}><strong className="block truncate text-sm">{document.filename}</strong><span className={cn('text-xs capitalize', muted(theme))}>{document.document_type.replaceAll('_', ' ')} · {formatDate(document.created_at)}</span></div>)}</div>{documents.length === 0 && <EmptyState icon={FileUp} title="No documents" body={canManage ? 'Upload employment records and certificates.' : 'Your employment documents will appear here.'} theme={theme} />}</div>;
}

function PerformancePanel({ workspaceId, userId, employee, canManage, theme, onNotice }: { workspaceId: string; userId: string; employee: EmployeeProfile | null; canManage: boolean; theme: Theme; onNotice: (message: string) => void }) {
  const [records, setRecords] = useState<{ id: string; record_type: string; title: string; details: string | null; review_date: string; rating: number | null }[]>([]); const load = useCallback(async () => { if (!supabase || !employee) return; const { data, error } = await supabase.from('performance_records').select('*').eq('employee_profile_id', employee.id).order('review_date', { ascending: false }); if (error) onNotice(error.message); else setRecords(data ?? []); }, [employee, onNotice]); useEffect(() => { void load(); }, [load]); const add = async () => { if (!supabase || !employee) return; const title = window.prompt('Record title'); if (!title) return; const type = window.prompt('Type: review, achievement, warning, or goal', 'goal') ?? 'goal'; const details = window.prompt('Details') ?? ''; const { error } = await supabase.from('performance_records').insert({ workspace_id: workspaceId, employee_profile_id: employee.id, record_type: type, title, details, created_by: userId }); if (error) onNotice(error.message); else await load(); };
  return <div className="mt-5">{canManage && <button onClick={() => void add()} className="inline-flex h-10 items-center gap-2 rounded-lg bg-[var(--accent)] px-4 text-sm font-bold text-[var(--accent-ink)]"><Plus className="h-4 w-4" />Add record</button>}<div className="mt-4 space-y-3">{records.map((record) => <div key={record.id} className={cn('rounded-lg border p-4', panel(theme))}><div className="flex items-center justify-between"><strong>{record.title}</strong><StatusPill value={record.record_type} /></div><p className={cn('mt-2 text-sm', muted(theme))}>{record.details || 'No details'}</p><span className={cn('mt-2 block text-xs', muted(theme))}>{formatDate(record.review_date)}{record.rating != null ? ` · ${record.rating}/5` : ''}</span></div>)}</div>{records.length === 0 && <EmptyState icon={Gauge} title="No performance records" body="Reviews, achievements, warnings, and goals will appear here." theme={theme} />}</div>;
}

function CompensationPanel({ workspaceId, userId, employee, role, theme, onNotice }: { workspaceId: string; userId: string; employee: EmployeeProfile | null; role: WorkspaceRole; theme: Theme; onNotice: (message: string) => void }) {
  const [country, setCountry] = useState('US');
  const [compensationType, setCompensationType] = useState('hourly');
  const [amount, setAmount] = useState('');
  const [taxStatus, setTaxStatus] = useState('');
  const [bankAccount, setBankAccount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('Bank Transfer');
  const [paymentDetails, setPaymentDetails] = useState('');
  const [governmentIds, setGovernmentIds] = useState<Record<string, string>>({});
  const [payrollFields, setPayrollFields] = useState<EmployeePayrollField[]>([]);
  const [addingField, setAddingField] = useState(false);
  const [fieldName, setFieldName] = useState('');
  const [fieldKind, setFieldKind] = useState<'earning' | 'deduction'>('deduction');
  const [fieldCalculation, setFieldCalculation] = useState<'fixed' | 'percentage'>('percentage');
  const [fieldValue, setFieldValue] = useState('');
  const [saving, setSaving] = useState(false);
  const canCreateFields = role === 'owner';
  const idFields = country === 'PH' ? ['TIN', 'SSS Number', 'PhilHealth Number', 'Pag-IBIG Number'] : country === 'US' ? ['SSN', 'TIN'] : ['Tax ID', 'Government ID'];

  useEffect(() => {
    if (!supabase) return;
    void supabase.from('workforce_settings').select('country_code').eq('workspace_id', workspaceId).maybeSingle().then(({ data }) => setCountry(data?.country_code ?? 'US'));
  }, [workspaceId]);

  const loadCompensation = useCallback(async () => {
    if (!supabase || !employee) return;
    const [sensitiveResult, fieldsResult] = await Promise.all([
      supabase.rpc('get_employee_sensitive_payroll', { target_employee_profile_id: employee.id }),
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
    setGovernmentIds((value.government_ids as Record<string, string>) ?? {});
    setPayrollFields((fieldsResult.data ?? []) as EmployeePayrollField[]);
  }, [employee, onNotice]);

  useEffect(() => { void loadCompensation(); }, [loadCompensation]);

  const save = async () => {
    if (!supabase || !employee) return;
    setSaving(true);
    const { error } = await supabase.rpc('upsert_employee_sensitive_payroll', {
      target_employee_profile_id: employee.id,
      new_compensation_type: compensationType,
      new_compensation_amount: amount,
      new_tax_status: taxStatus,
      new_bank_account: bankAccount,
      new_government_ids: governmentIds,
      new_country_fields: { payment_method: paymentMethod, payment_details: paymentDetails },
    });
    setSaving(false);
    if (error) onNotice(error.message); else onNotice('Encrypted payroll information saved.');
  };

  const addPayrollField = async () => {
    if (!supabase || !employee || role !== 'owner') return;
    const value = Number(fieldValue);
    if (!fieldName.trim() || !Number.isFinite(value) || value < 0) return onNotice('Enter a field name and a valid non-negative value.');
    const { error } = await supabase.from('employee_payroll_fields').insert({
      workspace_id: workspaceId, employee_profile_id: employee.id, name: fieldName.trim(),
      item_kind: fieldKind, calculation_type: fieldCalculation, value,
      country_code: country || null, created_by: userId,
    });
    if (error) return onNotice(error.message);
    setAddingField(false); setFieldName(''); setFieldValue(''); setFieldKind('deduction'); setFieldCalculation('percentage');
    await loadCompensation();
  };

  const deletePayrollField = async (fieldId: string) => {
    if (!supabase || role !== 'owner' || !window.confirm('Delete this payroll field?')) return;
    const { error } = await supabase.from('employee_payroll_fields').delete().eq('id', fieldId);
    if (error) onNotice(error.message); else await loadCompensation();
  };

  if (!employee) return <EmptyState icon={Banknote} title="Select an employee" body="Choose an employee to manage compensation." theme={theme} />;
  const suggestedFields = payrollFieldSuggestions(country);
  return <div className={cn('mt-5 max-w-5xl rounded-lg border p-5', panel(theme))}>
    <div className="mb-5"><h3 className="font-bold">Encrypted payroll information</h3><p className={cn('mt-1 text-sm', muted(theme))}>Compensation, payment, tax, and government details are encrypted separately.</p></div>
    <div className="grid gap-4 sm:grid-cols-2">
      <SelectField label="Compensation type" value={compensationType} options={['hourly', 'daily', 'weekly', 'semimonthly', 'monthly', 'annual']} onChange={setCompensationType} theme={theme} />
      <Field label="Compensation amount" type="number" value={amount} onChange={setAmount} theme={theme} />
      <Field label="Tax status" value={taxStatus} onChange={setTaxStatus} theme={theme} />
      <Field label="Bank account / E-wallet" value={bankAccount} onChange={setBankAccount} theme={theme} />
      <SelectField label="Payment method" value={paymentMethod} options={['Bank Transfer', 'Check', 'Cash', 'GCash', 'PayPal', 'Zelle', 'Venmo', 'Apple Pay', 'Other']} onChange={setPaymentMethod} theme={theme} />
      <Field label="Payment details" value={paymentDetails} onChange={setPaymentDetails} theme={theme} />
      {idFields.map((field) => <div key={field}><Field label={field} value={governmentIds[field] ?? ''} onChange={(value) => setGovernmentIds({ ...governmentIds, [field]: value })} theme={theme} /></div>)}
    </div>
    <button onClick={() => void save()} disabled={saving} className="mt-5 h-11 rounded-lg bg-[var(--accent)] px-5 text-sm font-bold text-[var(--accent-ink)]">Save encrypted details</button>
    <div className={cn('mt-6 border-t pt-5', border(theme))}>
      <div className="flex flex-wrap items-start justify-between gap-3"><div><h3 className="font-bold">Payroll items</h3><p className={cn('mt-1 text-sm', muted(theme))}>Employee-specific earnings and deductions included in payroll calculations.</p></div>{canCreateFields && <button onClick={() => setAddingField((open) => !open)} className={cn('inline-flex h-10 items-center gap-2 rounded-lg border px-4 text-sm font-semibold', buttonSurface(theme))}><Plus className="h-4 w-4" />Add field</button>}</div>
      {addingField && <div className={cn('mt-4 rounded-lg border p-4', panel(theme))}>
        <div className="grid gap-3 md:grid-cols-4">
          <label className="md:col-span-2"><span className={cn('mb-1 block text-xs font-semibold', muted(theme))}>Field name</span><input list="payroll-field-suggestions" value={fieldName} onChange={(event) => setFieldName(event.target.value)} placeholder="e.g. Medicare" className={cn('h-11 w-full rounded-lg border px-3 text-sm', panel(theme))} /><datalist id="payroll-field-suggestions">{suggestedFields.map((name) => <option key={name} value={name} />)}</datalist></label>
          <SelectField label="Type" value={fieldKind} options={['earning', 'deduction']} onChange={(value) => setFieldKind(value as 'earning' | 'deduction')} theme={theme} />
          <SelectField label="Calculation" value={fieldCalculation} options={['percentage', 'fixed']} onChange={(value) => setFieldCalculation(value as 'fixed' | 'percentage')} theme={theme} />
          <Field label={fieldCalculation === 'percentage' ? 'Percentage' : 'Fixed amount'} type="number" value={fieldValue} onChange={setFieldValue} theme={theme} />
        </div>
        <div className="mt-3 flex justify-end gap-2"><button onClick={() => setAddingField(false)} className={cn('h-9 rounded-lg border px-3 text-sm font-semibold', buttonSurface(theme))}>Cancel</button><button onClick={() => void addPayrollField()} className="h-9 rounded-lg bg-[var(--accent)] px-4 text-sm font-bold text-[var(--accent-ink)]">Save field</button></div>
      </div>}
      <div className="mt-4 grid gap-2 sm:grid-cols-2">{payrollFields.map((field) => <div key={field.id} className="flex items-center justify-between gap-3 rounded-lg border border-current/10 px-3 py-3"><span><strong className="block text-sm">{field.name}</strong><span className={cn('text-xs capitalize', muted(theme))}>{field.item_kind} · {field.calculation_type} · {field.value}{field.calculation_type === 'percentage' ? '%' : ''}</span></span>{canCreateFields && <IconAction label="Delete payroll field" icon={Trash2} onClick={() => void deletePayrollField(field.id)} />}</div>)}</div>
      {payrollFields.length === 0 && <p className={cn('mt-4 rounded-lg border border-dashed p-4 text-sm', muted(theme))}>No employee-specific payroll items yet. Suggested for {country}: {suggestedFields.join(', ')}.</p>}
    </div>
  </div>;
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

function ModuleFrame({ icon: Icon, title, subtitle, theme, children }: { icon: typeof Clock3; title: string; subtitle: string; theme: Theme; children: ReactNode }) { return <div className="min-h-0 flex-1 overflow-y-auto pr-1 scroll-area"><header className={cn('mb-5 flex items-center gap-3 border-b pb-4', border(theme))}><div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[var(--accent-soft)] text-[var(--accent-strong)]"><Icon className="h-5 w-5" /></div><div><h2 className="text-xl font-bold">{title}</h2><p className={cn('text-sm', muted(theme))}>{subtitle}</p></div></header>{children}</div>; }
function Metric({ label, value, theme, accent = false }: { label: string; value: string; theme: Theme; accent?: boolean }) { return <div className={cn('rounded-lg border p-4', panel(theme), accent && 'border-[var(--accent)]')}><p className={cn('text-xs font-semibold uppercase tracking-[0.12em]', muted(theme))}>{label}</p><p className={cn('mt-2 text-2xl font-bold capitalize', accent && 'text-[var(--accent-strong)]')}>{value}</p></div>; }
function DataTable({ headers, theme, children }: { headers: string[]; theme: Theme; children: ReactNode }) { return <div className={cn('overflow-x-auto rounded-lg border', panel(theme))}><table className="w-full min-w-[720px] border-collapse text-left"><thead><tr className={cn('border-b', border(theme))}>{headers.map((header) => <th key={header} className={cn('px-4 py-3 text-xs uppercase tracking-[0.1em]', muted(theme))}>{header}</th>)}</tr></thead><tbody>{children}</tbody></table></div>; }
function Cell({ children, strong = false }: { children: ReactNode; strong?: boolean }) { return <td className={cn('px-4 py-3 text-sm', strong && 'font-semibold')}>{children}</td>; }
function ActionButton({ icon: Icon, label, onClick, disabled, secondary, danger }: { icon: typeof Play; label: string; onClick: () => void; disabled?: boolean; secondary?: boolean; danger?: boolean }) { return <button onClick={onClick} disabled={disabled} className={cn('inline-flex h-12 items-center gap-2 rounded-lg px-5 text-sm font-bold disabled:opacity-50', danger ? 'bg-[#B91C1C] text-white' : secondary ? 'border border-[var(--accent)] bg-transparent text-[var(--accent-strong)]' : 'bg-[var(--accent)] text-[var(--accent-ink)]')}><Icon className="h-4 w-4" />{label}</button>; }
function Field({ label, value, onChange, theme, type = 'text', wide, compact }: { label: string; value: string; onChange: (value: string) => void; theme: Theme; type?: string; wide?: boolean; compact?: boolean }) { return <label className={cn('block', wide && 'sm:col-span-2', compact && 'w-40')}><span className={cn('mb-1 block text-xs font-semibold', muted(theme))}>{label}</span><input type={type} value={value} onChange={(event) => onChange(event.target.value)} className={cn('h-11 w-full rounded-lg border px-3 text-sm outline-none', panel(theme), compact && 'h-10')} /></label>; }
function SmallInput({ label, value, onChange, theme }: { label: string; value: string | number; onChange: (value: string) => void; theme: Theme }) { return <label><span className={cn('mb-1 block text-[11px]', muted(theme))}>{label}</span><input value={value} onChange={(event) => onChange(event.target.value)} className={cn('h-9 w-full rounded-lg border px-2 text-xs', panel(theme))} /></label>; }
function SelectField({ label, value, options, onChange, theme, compact }: { label: string; value: string; options: string[]; onChange: (value: string) => void; theme: Theme; compact?: boolean }) { return <label className={cn('block', compact && 'w-44')}><span className={cn('mb-1 block text-xs font-semibold', muted(theme))}>{label}</span><select value={value} onChange={(event) => onChange(event.target.value)} className={cn('h-11 w-full rounded-lg border px-3 text-sm capitalize', panel(theme), compact && 'h-10')}>{options.map((option) => <option key={option} value={option}>{option ? option.replaceAll('_', ' ') : 'Not set'}</option>)}</select></label>; }
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
function payrollFieldSuggestions(country: string) {
  if (country === 'US') return ['Medicare', 'Social Security', 'Federal Tax', 'State Income Tax', 'State Disability Insurance'];
  if (country === 'PH') return ['SSS', 'Pag-IBIG', 'PhilHealth', 'Withholding Tax'];
  return ['Income Tax', 'Social Insurance', 'Health Insurance', 'Pension', 'Other Deduction'];
}
function workedHours(entry: TimeEntry, now: number) { const end = entry.clock_out ? new Date(entry.clock_out).getTime() : now; const activeBreak = entry.break_started_at ? Math.max(0, now - new Date(entry.break_started_at).getTime()) / 1000 : 0; return Math.max(0, (end - new Date(entry.clock_in).getTime()) / 3600000 - (entry.break_seconds + activeBreak) / 3600); }
function formatDuration(hours: number) { const totalMinutes = Math.max(0, Math.round(hours * 60)); return `${Math.floor(totalMinutes / 60)}h ${String(totalMinutes % 60).padStart(2, '0')}m`; }
function formatTime(value: string) { return new Date(value).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }); }
function formatDate(value: string) { const date = /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(`${value}T00:00:00`) : new Date(value); return date.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' }); }
function settingLabel(key: keyof Pick<TimekeepingSettings, 'capture_location' | 'capture_ip' | 'capture_device' | 'require_selfie' | 'enforce_geofence'>) { return ({ capture_location: 'GPS location', capture_ip: 'IP address', capture_device: 'Device information', require_selfie: 'Selfie verification', enforce_geofence: 'Geofence restriction' })[key]; }
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
