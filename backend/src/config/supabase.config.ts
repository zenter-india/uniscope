import { registerAs } from '@nestjs/config';

export interface SupabaseConfig {
  url: string;
  anonKey: string;
  serviceRoleKey: string;
  buckets: {
    verificationDocs: string;
    avatars: string;
    messageMedia: string;
  };
}

export const supabaseConfig = registerAs(
  'supabase',
  (): SupabaseConfig => ({
    url: process.env['SUPABASE_URL'] ?? '',
    anonKey: process.env['SUPABASE_ANON_KEY'] ?? '',
    serviceRoleKey: process.env['SUPABASE_SERVICE_ROLE_KEY'] ?? '',
    buckets: {
      verificationDocs: process.env['SUPABASE_BUCKET_VERIFICATION_DOCS'] ?? 'verification-docs',
      avatars: process.env['SUPABASE_BUCKET_AVATARS'] ?? 'avatars',
      messageMedia: process.env['SUPABASE_BUCKET_MESSAGE_MEDIA'] ?? 'message-media',
    },
  }),
);
