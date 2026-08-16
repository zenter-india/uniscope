import { spawn } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { DataImportStatus, DataImportType, Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma/prisma.service.js';
import { ApplyDataImportDto } from './dto/apply-data-import.dto.js';

const SCRIPTS_DIR = join(process.cwd(), 'scripts', 'data');

interface UgCaptured {
  name: string;
  state: string;
  city: string | null;
  type: 'GOVERNMENT' | 'PRIVATE' | null;
  stream: string;
  levels: string[];
  mbbsSeats: number | null;
  nirfRank: number | null;
}

interface PgMatch {
  universityId: string;
  universityName: string;
  mccCode: string;
  mccName: string;
  score: number;
  confidence: 'high' | 'medium';
}

interface DiffAdded {
  key: string;
  name: string;
  detail: string;
  /** PG matches only — lets the admin UI default-check high-confidence
   * items and leave medium-confidence ones for explicit review, without
   * parsing `detail`'s free text. See match_pg.py's module docstring for
   * why medium-confidence PG matches genuinely need a human look. */
  confidence?: 'high' | 'medium';
}

interface DiffChanged {
  key: string;
  name: string;
  detail: string;
}

interface Diff {
  added: DiffAdded[];
  changed: DiffChanged[];
  unchanged: number;
  sourceCount: number;
}

/**
 * Runs the same capture pipeline the dataset was originally built from
 * (backend/scripts/data/refresh_ug.py, refresh_pg.py) on demand, from an
 * admin-triggered background job — see AGENTS/CLAUDE.md for the source
 * provenance these re-derive from.
 *
 * Never writes to the DB from the capture step. `run()` only populates
 * `diffJson`; a human has to call `apply()` with the specific keys they
 * reviewed and approved, so a source-site change (or an admin's own prior
 * manual correction) can't be silently overwritten. This mirrors the rest
 * of the app's non-destructive conventions (deactivate not delete, no
 * automatic refunds) — see ReportsService.resolve for the same pattern
 * applied to a different kind of write.
 */
@Injectable()
export class DataImportService {
  private readonly logger = new Logger(DataImportService.name);

  constructor(private readonly prisma: PrismaService) {}

  async run(type: DataImportType) {
    const job = await this.prisma.dataImportJob.create({
      data: { type, status: DataImportStatus.RUNNING },
    });

    // Fire-and-forget: the admin panel polls GET /:id for status rather than
    // holding the request open — a slow/flaky source site (MCC's in
    // particular) shouldn't be able to time out an HTTP request.
    this.executeCapture(job.id, type).catch((err) => {
      this.logger.error(`data-import job ${job.id} crashed outside its own try/catch`, err);
    });

    return job;
  }

  async getJob(id: string) {
    const job = await this.prisma.dataImportJob.findUnique({ where: { id } });
    if (!job) throw new NotFoundException(`Data import job '${id}' not found`);
    return job;
  }

  async listJobs(type?: DataImportType) {
    return this.prisma.dataImportJob.findMany({
      where: type ? { type } : undefined,
      orderBy: { startedAt: 'desc' },
      take: 20,
    });
  }

  async apply(id: string, adminUserId: string, dto: ApplyDataImportDto) {
    const job = await this.getJob(id);
    if (job.status !== DataImportStatus.COMPLETED) {
      throw new BadRequestException(
        `Job is '${job.status}', not COMPLETED — nothing to apply, or it was already applied`,
      );
    }
    const diff = job.diffJson as unknown as Diff;
    const approved = new Set(dto.approvedKeys);

    const addedToApply = diff.added.filter((a) => approved.has(a.key));
    const changedToApply = diff.changed.filter((c) => approved.has(c.key));

    if (job.type === DataImportType.UG) {
      await this.applyUg(addedToApply, changedToApply);
    } else {
      await this.applyPg(addedToApply);
    }

    return this.prisma.dataImportJob.update({
      where: { id },
      data: {
        status: DataImportStatus.APPLIED,
        appliedAt: new Date(),
        appliedBy: adminUserId,
        appliedJson: {
          addedKeys: addedToApply.map((a) => a.key),
          changedKeys: changedToApply.map((c) => c.key),
        },
      },
    });
  }

  // ── capture + diff ────────────────────────────────────────────────────

  private async executeCapture(jobId: string, type: DataImportType) {
    try {
      const diff =
        type === DataImportType.UG ? await this.captureUg() : await this.capturePg();
      await this.prisma.dataImportJob.update({
        where: { id: jobId },
        data: {
          status: DataImportStatus.COMPLETED,
          diffJson: diff as unknown as Prisma.InputJsonValue,
          completedAt: new Date(),
        },
      });
    } catch (err) {
      this.logger.error(`data-import job ${jobId} failed`, err);
      await this.prisma.dataImportJob.update({
        where: { id: jobId },
        data: {
          status: DataImportStatus.FAILED,
          error: err instanceof Error ? err.message : String(err),
          completedAt: new Date(),
        },
      });
    }
  }

  private async captureUg(): Promise<Diff> {
    const captured = await runPython<UgCaptured[]>('refresh_ug.py', []);

    const existing = await this.prisma.university.findMany({
      select: { id: true, name: true, type: true, city: true, mbbsSeats: true, nirfRank: true },
    });
    const byName = new Map(existing.map((u) => [normalizeName(u.name), u]));

    const added: DiffAdded[] = [];
    const changed: DiffChanged[] = [];
    let unchanged = 0;

    for (const c of captured) {
      const match = byName.get(normalizeName(c.name));
      if (!match) {
        added.push({
          key: c.name,
          name: c.name,
          detail: `${c.type ?? 'unknown type'} · ${c.state}${c.mbbsSeats ? ` · ${c.mbbsSeats} seats` : ''}${c.nirfRank ? ` · NIRF #${c.nirfRank}` : ''}`,
        });
        continue;
      }
      const fieldDiffs: string[] = [];
      if (c.type && c.type !== match.type) fieldDiffs.push(`type ${match.type} → ${c.type}`);
      if (c.mbbsSeats !== match.mbbsSeats)
        fieldDiffs.push(`seats ${match.mbbsSeats ?? '—'} → ${c.mbbsSeats ?? '—'}`);
      if (c.nirfRank !== match.nirfRank)
        fieldDiffs.push(`NIRF ${match.nirfRank ?? '—'} → ${c.nirfRank ?? '—'}`);
      if (c.city && c.city !== match.city) fieldDiffs.push(`city ${match.city ?? '—'} → ${c.city}`);

      if (fieldDiffs.length === 0) {
        unchanged += 1;
      } else {
        changed.push({ key: match.id, name: c.name, detail: fieldDiffs.join(', ') });
      }
    }

    return { added, changed, unchanged, sourceCount: captured.length };
  }

  private async capturePg(): Promise<Diff> {
    const mcc = await runPython<{ code: string; name: string }[]>('refresh_pg.py', []);

    const ours = await this.prisma.university.findMany({
      where: { isActive: true },
      select: { id: true, name: true, state: true, levels: true },
    });

    const tmpDir = await mkdtemp(join(tmpdir(), 'uniscope-pg-match-'));
    try {
      const mccPath = join(tmpDir, 'mcc.json');
      const oursPath = join(tmpDir, 'ours.json');
      await writeFile(mccPath, JSON.stringify(mcc));
      await writeFile(
        oursPath,
        JSON.stringify(ours.map((u) => ({ id: u.id, name: u.name, state: u.state }))),
      );

      const matches = await runPython<PgMatch[]>('match_pg.py', [mccPath, oursPath]);
      const levelsById = new Map(ours.map((u) => [u.id, u.levels]));

      const added: DiffAdded[] = [];
      let unchanged = 0;
      for (const m of matches) {
        const levels = levelsById.get(m.universityId) ?? [];
        if (levels.includes('PG')) {
          unchanged += 1;
          continue;
        }
        added.push({
          key: m.universityId,
          name: m.universityName,
          detail: `matched MCC "${m.mccName}" (${m.confidence} confidence, score ${m.score})`,
          confidence: m.confidence,
        });
      }

      return { added, changed: [], unchanged, sourceCount: mcc.length };
    } finally {
      await rm(tmpDir, { recursive: true, force: true });
    }
  }

  // ── apply ────────────────────────────────────────────────────────────

  private async applyUg(added: DiffAdded[], changed: DiffChanged[]) {
    // Re-run capture rather than trust stale detail strings for the actual
    // write — diffJson.detail is a human-readable summary, not the source
    // of truth. Cheapest correct option: re-capture and re-filter to just
    // the approved names/ids, since a second run happens on the same page
    // load an admin is already looking at.
    const captured = await runPython<UgCaptured[]>('refresh_ug.py', []);
    const byName = new Map(captured.map((c) => [normalizeName(c.name), c]));

    for (const item of added) {
      const c = byName.get(normalizeName(item.name));
      if (!c) continue;
      const slug = await this.uniqueSlugFor(c.name);
      await this.prisma.university.create({
        data: {
          name: c.name,
          slug,
          state: c.state,
          city: c.city,
          stream: c.stream,
          levels: c.levels,
          mbbsSeats: c.mbbsSeats,
          nirfRank: c.nirfRank,
          // NIRF-only institutes have no sourced ownership (see
          // seed-universities.mjs for the original version of this same
          // call) — seeded inactive rather than defaulted to a guessed
          // type, so a wrong "Private" badge never lands on e.g. PGIMER.
          type: c.type ?? 'PRIVATE',
          isActive: Boolean(c.type),
        },
      });
    }

    for (const item of changed) {
      const c = byName.get(normalizeName(item.name));
      if (!c) continue;
      await this.prisma.university.update({
        where: { id: item.key },
        data: {
          ...(c.type ? { type: c.type } : {}),
          ...(c.mbbsSeats !== null ? { mbbsSeats: c.mbbsSeats } : {}),
          ...(c.nirfRank !== null ? { nirfRank: c.nirfRank } : {}),
          ...(c.city ? { city: c.city } : {}),
        },
      });
    }
  }

  private async applyPg(added: DiffAdded[]) {
    for (const item of added) {
      const current = await this.prisma.university.findUnique({
        where: { id: item.key },
        select: { levels: true },
      });
      if (!current || current.levels.includes('PG')) continue;
      await this.prisma.university.update({
        where: { id: item.key },
        data: { levels: [...current.levels, 'PG'] },
      });
    }
  }

  private async uniqueSlugFor(name: string): Promise<string> {
    const base =
      name
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '') || 'university';
    let slug = base;
    let suffix = 1;
    while (await this.prisma.university.findUnique({ where: { slug } })) {
      suffix += 1;
      slug = `${base}-${suffix}`;
    }
    return slug;
  }
}

function normalizeName(name: string): string {
  return name.toLowerCase().trim().replace(/\s+/g, ' ');
}

function runPython<T>(script: string, args: string[]): Promise<T> {
  return new Promise((resolve, reject) => {
    const proc = spawn('python3', [join(SCRIPTS_DIR, script), ...args], {
      cwd: SCRIPTS_DIR,
    });
    let stdout = '';
    let stderr = '';
    proc.stdout.on('data', (d) => (stdout += d));
    proc.stderr.on('data', (d) => (stderr += d));
    proc.on('error', reject);
    proc.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`${script} exited ${code}: ${stderr.slice(-2000)}`));
        return;
      }
      try {
        resolve(JSON.parse(stdout) as T);
      } catch (e) {
        reject(new Error(`${script} did not print valid JSON: ${(e as Error).message}`));
      }
    });
  });
}
