import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_BUCKETS, SUPABASE_CLIENT } from '../../supabase/index.js';
import {
  AVATAR_ACCESSORIES,
  AVATAR_CLOTHES_COLORS,
  AVATAR_CLOTHING,
  AVATAR_EYEBROWS,
  AVATAR_EYES,
  AVATAR_FACIAL_HAIR,
  AVATAR_HAIR_COLORS,
  AVATAR_MOUTHS,
  AVATAR_SKIN_COLORS,
  AVATAR_TOPS,
  AvatarConfig,
} from './avatar.constants.js';

/**
 * DiceBear v9 is ESM-only, and this backend compiles to CommonJS. A static
 * import is a TypeScript error under `nodenext`, and `require()` of ESM only
 * works on Node >=20.19/22.12 — which `engines` doesn't guarantee. A cached
 * dynamic import sidesteps both: it stays a real `import()` in the emitted
 * JS and works on every supported Node.
 */
// Typed structurally rather than via `typeof import(...)`: under nodenext,
// TypeScript refuses to resolve named exports of an ESM package from a
// CommonJS file, even though the runtime import works fine.
type AvatarResult = { toString(): string };
type CreateAvatarFn = (
  style: unknown,
  options: Record<string, unknown>,
) => AvatarResult;

type DicebearModules = {
  createAvatar: CreateAvatarFn;
  avataaars: unknown;
};

let dicebearPromise: Promise<DicebearModules> | null = null;

function loadDicebear(): Promise<DicebearModules> {
  dicebearPromise ??= (async () => {
    // Namespaces are cast rather than typed: @dicebear ships a bare
    // `"exports": "./lib/index.js"` string with no `types` condition, so
    // under nodenext TypeScript can't see the named exports even though
    // the declarations exist on disk and the runtime import is fine.
    const [core, collection] = (await Promise.all([
      import('@dicebear/core'),
      import('@dicebear/collection'),
    ])) as unknown as [
      { createAvatar: CreateAvatarFn },
      Record<string, unknown>,
    ];
    return {
      createAvatar: core.createAvatar,
      avataaars: collection['avataaars'],
    };
  })();
  return dicebearPromise;
}

function pick<T>(values: readonly T[]): T {
  return values[Math.floor(Math.random() * values.length)]!;
}

/**
 * Generates, renders and stores the illustrated avatars shown everywhere a
 * user appears. Avatars are SVG (not PNG) on purpose — rendering PNG needs a
 * native rasteriser (`sharp`/`resvg`), which is a heavy dependency for a
 * Railway container, and Flutter renders SVG natively via flutter_svg.
 *
 * Each user's file lives at a deterministic path (`{userId}.svg`), so the
 * public URL never has to be stored — only the config that produced it.
 */
@Injectable()
export class AvatarService {
  private bucketReady = false;

  constructor(
    @Inject(SUPABASE_CLIENT) private readonly supabase: SupabaseClient,
    private readonly config: ConfigService,
  ) {}

  /** A random but always-valid config, used to give every new user an
   * avatar without asking them anything during signup. */
  randomConfig(): AvatarConfig {
    return {
      top: pick(AVATAR_TOPS),
      hairColor: pick(AVATAR_HAIR_COLORS),
      eyes: pick(AVATAR_EYES),
      eyebrows: pick(AVATAR_EYEBROWS),
      mouth: pick(AVATAR_MOUTHS),
      facialHair: pick(AVATAR_FACIAL_HAIR),
      accessories: pick(AVATAR_ACCESSORIES),
      clothing: pick(AVATAR_CLOTHING),
      clothesColor: pick(AVATAR_CLOTHES_COLORS),
      skinColor: pick(AVATAR_SKIN_COLORS),
    };
  }

  /** Every field is checked against the catalogue rather than trusted —
   * an arbitrary string here would end up inside a stored SVG. */
  validateConfig(input: unknown): AvatarConfig {
    if (typeof input !== 'object' || input === null) {
      throw new BadRequestException('Avatar config must be an object');
    }
    const raw = input as Record<string, unknown>;

    const required = <T extends string>(
      key: string,
      allowed: readonly T[],
    ): T => {
      const value = raw[key];
      if (typeof value !== 'string' || !allowed.includes(value as T)) {
        throw new BadRequestException(`Invalid avatar option '${key}'`);
      }
      return value as T;
    };

    const nullable = <T extends string>(
      key: string,
      allowed: readonly (T | null)[],
    ): T | null => {
      const value = raw[key];
      if (value === null || value === undefined) return null;
      if (typeof value !== 'string' || !allowed.includes(value as T)) {
        throw new BadRequestException(`Invalid avatar option '${key}'`);
      }
      return value as T;
    };

    return {
      top: required('top', AVATAR_TOPS),
      hairColor: required('hairColor', AVATAR_HAIR_COLORS),
      eyes: required('eyes', AVATAR_EYES),
      eyebrows: required('eyebrows', AVATAR_EYEBROWS),
      mouth: required('mouth', AVATAR_MOUTHS),
      facialHair: nullable('facialHair', AVATAR_FACIAL_HAIR),
      accessories: nullable('accessories', AVATAR_ACCESSORIES),
      clothing: required('clothing', AVATAR_CLOTHING),
      clothesColor: required('clothesColor', AVATAR_CLOTHES_COLORS),
      skinColor: required('skinColor', AVATAR_SKIN_COLORS),
    };
  }

  async renderSvg(config: AvatarConfig): Promise<string> {
    const { createAvatar, avataaars } = await loadDicebear();

    return createAvatar(avataaars, {
      top: [config.top],
      hairColor: [config.hairColor],
      eyes: [config.eyes],
      eyebrows: [config.eyebrows],
      mouth: [config.mouth],
      clothing: [config.clothing],
      clothesColor: [config.clothesColor],
      skinColor: [config.skinColor],
      // DiceBear expresses "none" as a zero probability rather than an
      // absent value, so both have to be set together.
      facialHair: config.facialHair ? [config.facialHair] : [],
      facialHairProbability: config.facialHair ? 100 : 0,
      accessories: config.accessories ? [config.accessories] : [],
      accessoriesProbability: config.accessories ? 100 : 0,
      backgroundColor: ['transparent'],
    }).toString();
  }

  /** Renders and uploads, overwriting any previous avatar for this user.
   * Returns the config so callers can persist it in `avatarKey`. */
  async renderAndStore(userId: string, config: AvatarConfig): Promise<AvatarConfig> {
    const svg = await this.renderSvg(config);
    await this.ensureBucket();

    const { error } = await this.supabase.storage
      .from(SUPABASE_BUCKETS.AVATARS)
      .upload(`${userId}.svg`, Buffer.from(svg, 'utf8'), {
        contentType: 'image/svg+xml',
        upsert: true,
      });
    if (error) {
      throw new BadRequestException(`Failed to store avatar: ${error.message}`);
    }
    return config;
  }

  /**
   * Public URL for a user's avatar, or null if they have no config yet.
   * The `v` param busts CDN and client image caches when the avatar
   * changes — the path itself is stable, so without it a customised
   * avatar would keep showing the old picture.
   */
  publicUrl(userId: string, avatarKey: string | null, updatedAt: Date): string | null {
    if (!avatarKey) return null;
    const base = this.config.get<string>('supabase.url', '');
    if (!base) return null;
    return `${base}/storage/v1/object/public/${SUPABASE_BUCKETS.AVATARS}/${userId}.svg?v=${updatedAt.getTime()}`;
  }

  /** Avatars are world-readable — they're the user's public face and are
   * fetched by other users' clients, so a signed URL would be pointless
   * churn. Created lazily; the bucket isn't pre-provisioned. */
  private async ensureBucket(): Promise<void> {
    if (this.bucketReady) return;
    const { error } = await this.supabase.storage.createBucket(
      SUPABASE_BUCKETS.AVATARS,
      { public: true },
    );
    if (error && !/already exists/i.test(error.message)) {
      throw new BadRequestException(
        `Failed to prepare avatar bucket: ${error.message}`,
      );
    }
    this.bucketReady = true;
  }
}
