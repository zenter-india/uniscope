'use client';

import { ADMIN_SECTIONS, SECTION_GROUPS, setColumn, setPermission, type PermissionAction } from '../../../lib/permissions';

export interface PermissionValue {
  fullAccess: boolean;
  permissions: string[];
}

const CHECKBOX = 'h-4 w-4 accent-zinc-900 dark:accent-zinc-100';

/** The permission step: one row per admin-panel section, with a View box (open
 * the section) and an Edit box (change things in it). "Full access" ticks
 * everything, including sections added later. */
export function PermissionMatrix({
  value,
  onChange,
  disabled = false,
}: {
  value: PermissionValue;
  onChange: (next: PermissionValue) => void;
  disabled?: boolean;
}) {
  const { fullAccess, permissions } = value;
  const has = (section: string, action: PermissionAction) =>
    fullAccess || permissions.includes(`${section}:${action}`);
  const allTicked = (action: PermissionAction) =>
    ADMIN_SECTIONS.every((s) => permissions.includes(`${s.key}:${action}`));
  const locked = disabled || fullAccess;

  return (
    <div className="flex flex-col gap-3">
      <label className="flex cursor-pointer items-start gap-3 rounded-md border border-zinc-200 p-3 dark:border-zinc-800">
        <input
          type="checkbox"
          className={`mt-0.5 ${CHECKBOX}`}
          checked={fullAccess}
          disabled={disabled}
          onChange={(e) => onChange({ ...value, fullAccess: e.target.checked })}
        />
        <span>
          <span className="block text-sm font-medium text-zinc-900 dark:text-zinc-100">Full access</span>
          <span className="block text-xs text-zinc-500 dark:text-zinc-400">
            Can open and change every section, including ones added later.
          </span>
        </span>
      </label>

      <div className="overflow-x-auto rounded-md border border-zinc-200 dark:border-zinc-800">
        <table className="w-full text-sm">
          <thead className="bg-zinc-50 text-left text-xs text-zinc-500 dark:bg-zinc-800/40 dark:text-zinc-400">
            <tr>
              <th className="px-3 py-2 font-medium">Section</th>
              {(['view', 'edit'] as const).map((action) => (
                <th key={action} className="w-28 px-3 py-2 text-center font-medium">
                  <label className="inline-flex cursor-pointer items-center gap-1.5">
                    <input
                      type="checkbox"
                      className={CHECKBOX}
                      checked={fullAccess || allTicked(action)}
                      disabled={locked}
                      aria-label={`${action === 'view' ? 'View' : 'Edit'} for every section`}
                      onChange={(e) =>
                        onChange({ ...value, permissions: setColumn(action, e.target.checked, permissions) })
                      }
                    />
                    {action === 'view' ? 'View' : 'Edit'}
                  </label>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {SECTION_GROUPS.map((group) => (
              <GroupRows
                key={group}
                group={group}
                has={has}
                locked={locked}
                onToggle={(section, action, checked) =>
                  onChange({ ...value, permissions: setPermission(permissions, section, action, checked) })
                }
              />
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-zinc-500 dark:text-zinc-400">
        <strong>View</strong> lets them open the section. <strong>Edit</strong> lets them change things in it (it
        needs View, so ticking Edit ticks View too).
      </p>
    </div>
  );
}

function GroupRows({
  group,
  has,
  locked,
  onToggle,
}: {
  group: string;
  has: (section: string, action: PermissionAction) => boolean;
  locked: boolean;
  onToggle: (section: string, action: PermissionAction, checked: boolean) => void;
}) {
  return (
    <>
      <tr>
        <td
          colSpan={3}
          className="bg-zinc-50/60 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-zinc-400 dark:bg-zinc-800/20 dark:text-zinc-500"
        >
          {group}
        </td>
      </tr>
      {ADMIN_SECTIONS.filter((s) => s.group === group).map((s) => (
        <tr key={s.key} className="border-t border-zinc-100 dark:border-zinc-800">
          <td className="px-3 py-2 text-zinc-900 dark:text-zinc-100">{s.label}</td>
          {(['view', 'edit'] as const).map((action) => (
            <td key={action} className="px-3 py-2 text-center">
              <input
                type="checkbox"
                className={CHECKBOX}
                checked={has(s.key, action)}
                disabled={locked}
                aria-label={`${action === 'view' ? 'View' : 'Edit'} ${s.label}`}
                onChange={(e) => onToggle(s.key, action, e.target.checked)}
              />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}
