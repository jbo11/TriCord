import { describe, expect, it } from 'vitest';
import type { WorkspaceCapabilities, WorkspaceRole } from '../types';
import { canOpenView, hasWorkspaceCapability } from './permissions';

const baseCapabilities: WorkspaceCapabilities = {
  workspace_id: 'hub-1',
  user_id: 'user-1',
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
};

function capabilities(overrides: Partial<WorkspaceCapabilities> = {}): WorkspaceCapabilities {
  return { ...baseCapabilities, ...overrides };
}

describe('hasWorkspaceCapability', () => {
  it('gives owners every capability', () => {
    expect(hasWorkspaceCapability('owner', null, 'manage_payroll')).toBe(true);
    expect(hasWorkspaceCapability('owner', capabilities({ view_reports: false }), 'view_reports')).toBe(true);
  });

  it('requires explicit capabilities for admins', () => {
    expect(hasWorkspaceCapability('admin', capabilities(), 'manage_members')).toBe(false);
    expect(hasWorkspaceCapability('admin', capabilities({ manage_members: true }), 'manage_members')).toBe(true);
  });

  it('does not delegate capabilities to members or guests', () => {
    expect(hasWorkspaceCapability('member', capabilities({ view_reports: true }), 'view_reports')).toBe(false);
    expect(hasWorkspaceCapability('guest', capabilities({ manage_rooms: true }), 'manage_rooms')).toBe(false);
  });
});

describe('canOpenView', () => {
  it.each<WorkspaceRole>(['owner', 'admin', 'member', 'guest'])('allows %s into core collaboration views', (role) => {
    expect(canOpenView('feed', role, null)).toBe(true);
    expect(canOpenView('tasks', role, null)).toBe(true);
  });

  it('keeps guests out of private workforce and knowledge areas', () => {
    expect(canOpenView('knowledge', 'guest', null)).toBe(false);
    expect(canOpenView('timekeeping', 'guest', null)).toBe(false);
    expect(canOpenView('hr', 'guest', null)).toBe(false);
    expect(canOpenView('payroll', 'guest', null)).toBe(false);
  });

  it('requires report capability outside the owner role', () => {
    expect(canOpenView('reports', 'owner', null)).toBe(true);
    expect(canOpenView('reports', 'admin', capabilities())).toBe(false);
    expect(canOpenView('reports', 'admin', capabilities({ view_reports: true }))).toBe(true);
    expect(canOpenView('reports', 'member', capabilities({ view_reports: true }))).toBe(false);
  });

  it('opens admin only for owners or delegated admins', () => {
    expect(canOpenView('admin', 'owner', null)).toBe(true);
    expect(canOpenView('admin', 'admin', capabilities())).toBe(false);
    expect(canOpenView('admin', 'admin', capabilities({ manage_rooms: true }))).toBe(true);
    expect(canOpenView('admin', 'member', capabilities({ manage_members: true }))).toBe(false);
  });
});
