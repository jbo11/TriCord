import type { WorkspaceCapabilities, WorkspaceRole } from '../types';

export type CapabilityKey = keyof Omit<WorkspaceCapabilities, 'workspace_id' | 'user_id'>;

export function hasWorkspaceCapability(
  role: WorkspaceRole | undefined,
  capabilities: WorkspaceCapabilities | null | undefined,
  key: CapabilityKey,
) {
  if (role === 'owner') return true;
  if (role !== 'admin') return false;
  return Boolean(capabilities?.[key]);
}

export function canOpenView(
  view: 'feed' | 'tasks' | 'knowledge' | 'timekeeping' | 'hr' | 'payroll' | 'reports' | 'admin',
  role: WorkspaceRole | undefined,
  capabilities?: WorkspaceCapabilities | null,
) {
  if (!role) return false;
  if (view === 'feed' || view === 'tasks') return true;
  if (view === 'knowledge' || view === 'timekeeping' || view === 'hr' || view === 'payroll') return role !== 'guest';
  if (view === 'reports') return hasWorkspaceCapability(role, capabilities, 'view_reports');
  if (view === 'admin') {
    if (role === 'owner') return true;
    return role === 'admin' && (
      Boolean(capabilities?.manage_members)
      || Boolean(capabilities?.manage_rooms)
      || Boolean(capabilities?.manage_knowledge)
      || Boolean(capabilities?.view_audit)
    );
  }
  return false;
}
