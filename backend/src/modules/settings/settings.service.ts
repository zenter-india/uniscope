import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma/prisma.service.js';
import { SETTINGS_BY_KEY, SETTINGS_REGISTRY } from './settings.registry.js';

export interface SettingView {
  key: string;
  label: string;
  description: string;
  unit: string;
  value: number;
  default: number;
  min: number;
  max: number;
  isDefault: boolean;
}

@Injectable()
export class SettingsService {
  constructor(private readonly prisma: PrismaService) {}

  /** A single numeric setting, for a consuming service to call in place of
   * the old hardcoded constant. Falls back to the registry default for a
   * missing row, an unparseable value, or an unknown key (never throws —
   * a bad row must never take down whatever depends on it). */
  async getNumber(key: string): Promise<number> {
    const def = SETTINGS_BY_KEY.get(key);
    if (!def) return 0;
    const row = await this.prisma.appSetting.findUnique({ where: { key } });
    if (!row) return def.default;
    const n = Number(row.value);
    return Number.isFinite(n) ? n : def.default;
  }

  /** Every setting in the registry, with its current effective value (DB
   * row if set, else the default) — what the admin Settings page renders. */
  async getAll(): Promise<SettingView[]> {
    const rows = await this.prisma.appSetting.findMany({
      where: { key: { in: SETTINGS_REGISTRY.map((d) => d.key) } },
    });
    const byKey = new Map(rows.map((r) => [r.key, r.value]));

    return SETTINGS_REGISTRY.map((def) => {
      const raw = byKey.get(def.key);
      const parsed = raw !== undefined ? Number(raw) : undefined;
      const isDefault = parsed === undefined || !Number.isFinite(parsed);
      return {
        key: def.key,
        label: def.label,
        description: def.description,
        unit: def.unit,
        default: def.default,
        min: def.min,
        max: def.max,
        value: isDefault ? def.default : parsed!,
        isDefault,
      };
    });
  }

  /** Validates every entry against its registry bounds before writing
   * anything — either the whole batch applies or none of it does. */
  async setMany(updates: Record<string, number>): Promise<SettingView[]> {
    const entries = Object.entries(updates);
    for (const [key, value] of entries) {
      const def = SETTINGS_BY_KEY.get(key);
      if (!def) {
        throw new BadRequestException(`Unknown setting '${key}'`);
      }
      if (!Number.isFinite(value)) {
        throw new BadRequestException(`${def.label} must be a number`);
      }
      if (value < def.min || value > def.max) {
        throw new BadRequestException(
          `${def.label} must be between ${def.min} and ${def.max} ${def.unit}`,
        );
      }
    }

    await this.prisma.$transaction(
      entries.map(([key, value]) =>
        this.prisma.appSetting.upsert({
          where: { key },
          create: { key, value: String(value) },
          update: { value: String(value) },
        }),
      ),
    );

    return this.getAll();
  }
}
