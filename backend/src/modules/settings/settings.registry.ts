/**
 * The full set of admin-tunable operational knobs. Deliberately narrow —
 * only numeric values that are read in one contained place and safe to
 * change without re-deriving other logic (contrast e.g. the flat mentor
 * ₹10/min rate or the free-tier grant, which are load-bearing for the
 * Uniminute conversion / DB column defaults and are NOT here — see
 * CLAUDE.md's locked-in business model decisions).
 *
 * Add a new setting by adding a row here and reading it via
 * `SettingsService.getNumber(key)` wherever the old hardcoded constant was
 * used — nothing else needs to change; a setting with no row in the DB
 * just falls back to `default`.
 */
export interface SettingDef {
  key: string;
  label: string;
  description: string;
  unit: string;
  default: number;
  min: number;
  max: number;
}

export const SETTINGS_REGISTRY: SettingDef[] = [
  {
    key: 'payoutCooldownDays',
    label: 'Payout request cooldown',
    description:
      'How often a mentor may request a payout — once every N days, for whatever they\'ve earned since their last request. Also used as the cooldown for the "you have earnings to withdraw" reminder.',
    unit: 'days',
    default: 7,
    min: 1,
    max: 30,
  },
  {
    key: 'payoutOverdueHours',
    label: 'Payout overdue SLA',
    description:
      'How long a PENDING/PROCESSING payout request can sit before the admin panel flags it "Overdue". Display-only — never blocks or auto-processes anything.',
    unit: 'hours',
    default: 48,
    min: 1,
    max: 336,
  },
];

export const SETTINGS_BY_KEY = new Map(SETTINGS_REGISTRY.map((d) => [d.key, d]));
