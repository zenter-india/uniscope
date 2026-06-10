import { Provider } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_CLIENT } from './supabase.constants.js';

/**
 * Factory provider that initialises the Supabase client using the service-role key.
 * Service-role key bypasses Row Level Security — all access control is enforced
 * in the NestJS service layer instead.
 */
export const supabaseProvider: Provider = {
  provide: SUPABASE_CLIENT,
  inject: [ConfigService],
  useFactory: (configService: ConfigService): SupabaseClient => {
    const url = configService.getOrThrow<string>('supabase.url');
    const serviceRoleKey = configService.getOrThrow<string>('supabase.serviceRoleKey');

    return createClient(url, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });
  },
};
