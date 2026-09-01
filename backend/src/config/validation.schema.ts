import Joi from 'joi';

/**
 * Joi validation schema for required environment variables.
 * Applied in ConfigModule.forRoot({ validate }) so the app fails fast
 * on startup if any required variable is missing or malformed.
 */
export const validationSchema = Joi.object({
  // App
  NODE_ENV: Joi.string().valid('development', 'production', 'test').default('development'),
  PORT: Joi.number().integer().positive().default(3000),
  APP_NAME: Joi.string().default('Uniscope API'),
  API_PREFIX: Joi.string().default('api/v1'),

  // Database
  DATABASE_URL: Joi.string().uri().required(),

  // Supabase (required in production; placeholder allowed in local dev)
  SUPABASE_URL: Joi.string().default('https://placeholder.supabase.co'),
  SUPABASE_ANON_KEY: Joi.string().default('placeholder-anon-key'),
  SUPABASE_SERVICE_ROLE_KEY: Joi.string().default('placeholder-service-role-key'),

  // Firebase (optional in local dev — set FIREBASE_DISABLED=true to skip)
  FIREBASE_PROJECT_ID: Joi.string().default('uniscope-local'),
  FIREBASE_SERVICE_ACCOUNT_KEY_PATH: Joi.string().default('./firebase-service-account.json'),
  // Alternative to the file path above — base64-encoded key JSON, for hosts
  // with no mounted-secret-file feature (e.g. Railway).
  FIREBASE_SERVICE_ACCOUNT_KEY_BASE64: Joi.string().optional(),
  FIREBASE_DISABLED: Joi.string().valid('true', 'false').default('false'),

  // JWT (Sprint 1)
  JWT_ACCESS_SECRET: Joi.string().min(16).required(),
  JWT_REFRESH_SECRET: Joi.string().min(16).required(),
  JWT_ACCESS_TTL: Joi.number().integer().positive().default(900),
  JWT_REFRESH_TTL: Joi.number().integer().positive().default(604800),

  // Redis — either REDIS_URL (Upstash/TLS) or REDIS_HOST/PORT (local)
  REDIS_URL: Joi.string().uri().optional(),
  REDIS_HOST: Joi.string().default('localhost'),
  REDIS_PORT: Joi.number().integer().positive().default(6379),
  REDIS_PASSWORD: Joi.string().allow('').default(''),
  REDIS_OTP_TTL: Joi.number().integer().positive().default(600),

  // OTP provider
  OTP_PROVIDER_TYPE: Joi.string().valid('twilio', 'msg91', 'mock').default('mock'),

  // Twilio Verify (required when OTP_PROVIDER_TYPE=twilio)
  TWILIO_ACCOUNT_SID: Joi.string().when('OTP_PROVIDER_TYPE', {
    is: 'twilio',
    then: Joi.required(),
    otherwise: Joi.optional(),
  }),
  TWILIO_AUTH_TOKEN: Joi.string().when('OTP_PROVIDER_TYPE', {
    is: 'twilio',
    then: Joi.required(),
    otherwise: Joi.optional(),
  }),
  TWILIO_VERIFY_SERVICE_SID: Joi.string().when('OTP_PROVIDER_TYPE', {
    is: 'twilio',
    then: Joi.required(),
    otherwise: Joi.optional(),
  }),
  // Delivery channel for Twilio Verify OTPs ('whatsapp' requires the
  // Verify service to have a WhatsApp sender/sandbox configured).
  OTP_CHANNEL: Joi.string().valid('sms', 'whatsapp').default('sms'),

  // MSG91 OTP (required when OTP_PROVIDER_TYPE=msg91) — templateId must be
  // a DLT-approved OTP template from the MSG91 panel, an India SMS
  // regulatory requirement independent of MSG91 itself.
  MSG91_AUTH_KEY: Joi.string().when('OTP_PROVIDER_TYPE', {
    is: 'msg91',
    then: Joi.required(),
    otherwise: Joi.optional(),
  }),
  MSG91_TEMPLATE_ID: Joi.string().when('OTP_PROVIDER_TYPE', {
    is: 'msg91',
    then: Joi.required(),
    otherwise: Joi.optional(),
  }),

  // Razorpay — wallet topups
  RAZORPAY_KEY_ID: Joi.string().default(''),
  RAZORPAY_KEY_SECRET: Joi.string().default(''),
  RAZORPAY_WEBHOOK_SECRET: Joi.string().default(''),

  // Stream Chat — session messaging
  STREAM_API_KEY: Joi.string().default(''),
  STREAM_API_SECRET: Joi.string().default(''),

  // LiveKit Cloud (Mumbai/ap-south) — audio calls, replaces Agora
  LIVEKIT_URL: Joi.string().default(''),
  LIVEKIT_API_KEY: Joi.string().default(''),
  LIVEKIT_API_SECRET: Joi.string().default(''),

  // Ops alerts (Slack incoming webhook) — optional. Unset means alerts
  // are silently skipped rather than the app failing to start; see
  // SlackNotifierService.
  SLACK_WEBHOOK_URL: Joi.string().uri().optional(),
}).options({ allowUnknown: true });
