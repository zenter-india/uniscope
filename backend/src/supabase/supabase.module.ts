import { Global, Module } from '@nestjs/common';
import { supabaseProvider } from './supabase.provider.js';
import { SUPABASE_CLIENT } from './supabase.constants.js';

/**
 * Global Supabase module.
 * Provides the initialised SupabaseClient (service-role) as SUPABASE_CLIENT.
 * Marked @Global() so any module can inject the client without re-importing SupabaseModule.
 */
@Global()
@Module({
  providers: [supabaseProvider],
  exports: [SUPABASE_CLIENT],
})
export class SupabaseModule {}
