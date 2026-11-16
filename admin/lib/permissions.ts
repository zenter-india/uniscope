// What each admin may open and change in the admin panel. Pure helpers, shared
// by the browser (nav, the permissions matrix) and the server (middleware,
// the write guard) — keep this file free of server-only imports.

export type SectionGroup = 'Operations' | 'Directory' | 'Admin';

export interface AdminSection {
  /** Stored in permission keys as "<key>:view" / "<key>:edit". */
  key: string;
  label: string;
  group: SectionGroup;
  /** The address the section lives under. */
  path: string;
}

export const ADMIN_SECTIONS: readonly AdminSection[] = [
  { key: 'overview', label: 'Overview', group: 'Operations', path: '/dashboard' },
  { key: 'leads', label: 'Leads', group: 'Operations', path: '/dashboard/leads' },
  { key: 'verification', label: 'Verification', group: 'Operations', path: '/dashboard/verification' },
  { key: 'moderation', label: 'Moderation', group: 'Operations', path: '/dashboard/moderation' },
  { key: 'reviews', label: 'Reviews', group: 'Operations', path: '/dashboard/reviews' },
  { key: 'sessions', label: 'Sessions', group: 'Operations', path: '/dashboard/sessions' },
  { key: 'payouts', label: 'Payouts', group: 'Operations', path: '/dashboard/payouts' },
  { key: 'support', label: 'Support', group: 'Operations', path: '/dashboard/support' },
  { key: 'broadcasts', label: 'Announcements', group: 'Operations', path: '/dashboard/broadcasts' },
  { key: 'users', label: 'Users', group: 'Directory', path: '/dashboard/users' },
  { key: 'universities', label: 'Universities', group: 'Directory', path: '/dashboard/universities' },
  { key: 'degrees', label: 'Custom degrees', group: 'Directory', path: '/dashboard/degrees' },
  { key: 'specializations', label: 'College specializations', group: 'Directory', path: '/dashboard/specializations' },
  { key: 'data-import', label: 'Data Import', group: 'Directory', path: '/dashboard/data-import' },
  { key: 'admins', label: 'Admins', group: 'Admin', path: '/dashboard/admins' },
  { key: 'health', label: 'Health', group: 'Admin', path: '/dashboard/health' },
  { key: 'integrations', label: 'Integrations', group: 'Admin', path: '/dashboard/integrations' },
  { key: 'settings', label: 'Settings', group: 'Admin', path: '/dashboard/settings' },
];

export const SECTION_GROUPS: readonly SectionGroup[] = ['Operations', 'Directory', 'Admin'];

export type PermissionAction = 'view' | 'edit';

export interface Access {
  /** Every section, view and edit (also sections added later). */
  fullAccess: boolean;
  /** Used when fullAccess is false: keys like "users:view", "users:edit". */
  permissions: string[];
}

export const FULL_ACCESS: Access = { fullAccess: true, permissions: [] };
export const NO_ACCESS: Access = { fullAccess: false, permissions: [] };

/** Shown to anyone signed in, whatever they may open. */
export const NO_ACCESS_PATH = '/dashboard/no-access';

export const permissionKey = (section: string, action: PermissionAction) => `${section}:${action}`;

/** The section an address belongs to, or null when it is not one of them. */
export function sectionForPath(pathname: string): AdminSection | null {
  const path = pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname;
  if (path === '/dashboard') return ADMIN_SECTIONS[0];
  for (const s of ADMIN_SECTIONS) {
    if (s.path === '/dashboard') continue;
    if (path === s.path || path.startsWith(`${s.path}/`)) return s;
  }
  return null;
}

export const canView = (access: Access, section: string) =>
  access.fullAccess || access.permissions.includes(permissionKey(section, 'view'));

export const canEdit = (access: Access, section: string) =>
  access.fullAccess || access.permissions.includes(permissionKey(section, 'edit'));

/** May this admin open this address? A page that is not a known section is
 * closed to everyone but full-access admins (so a new page can't be reached
 * by accident before it has been given a section), except the "no access"
 * page itself. */
export function canOpenPath(access: Access, pathname: string): boolean {
  if (access.fullAccess) return true;
  if (pathname === NO_ACCESS_PATH || pathname.startsWith(`${NO_ACCESS_PATH}/`)) return true;
  const section = sectionForPath(pathname);
  return section ? canView(access, section.key) : false;
}

/** Ticks or unticks one box, keeping the two actions consistent: edit needs
 * view, so ticking edit also ticks view, and unticking view also unticks edit. */
export function setPermission(
  permissions: readonly string[],
  section: string,
  action: PermissionAction,
  checked: boolean,
): string[] {
  const set = new Set(permissions);
  const view = permissionKey(section, 'view');
  const edit = permissionKey(section, 'edit');
  if (action === 'view') {
    if (checked) set.add(view);
    else {
      set.delete(view);
      set.delete(edit);
    }
  } else if (checked) {
    set.add(edit);
    set.add(view);
  } else {
    set.delete(edit);
  }
  return [...set].sort();
}

/** Ticks or unticks one action for every section at once. */
export function setColumn(
  action: PermissionAction,
  checked: boolean,
  current: readonly string[],
): string[] {
  let next = [...current];
  for (const s of ADMIN_SECTIONS) next = setPermission(next, s.key, action, checked);
  return next;
}
