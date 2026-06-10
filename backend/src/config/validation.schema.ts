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
  APP_NAME: Joi.string().default('MedConnect API'),
  API_PREFIX: Joi.string().default('api/v1'),

  // Database
  DATABASE_URL: Joi.string().uri().required(),

  // Supabase
  SUPABASE_URL: Joi.string().uri().required(),
  SUPABASE_ANON_KEY: Joi.string().required(),
  SUPABASE_SERVICE_ROLE_KEY: Joi.string().required(),

  // Firebase
  FIREBASE_PROJECT_ID: Joi.string().required(),
  FIREBASE_SERVICE_ACCOUNT_KEY_PATH: Joi.string().default('./firebase-service-account.json'),

  // JWT (Sprint 1)
  JWT_ACCESS_SECRET: Joi.string().min(16).required(),
  JWT_REFRESH_SECRET: Joi.string().min(16).required(),
  JWT_ACCESS_TTL: Joi.number().integer().positive().default(900),
  JWT_REFRESH_TTL: Joi.number().integer().positive().default(604800),

  // Redis (Sprint 1)
  REDIS_HOST: Joi.string().default('localhost'),
  REDIS_PORT: Joi.number().integer().positive().default(6379),
  REDIS_PASSWORD: Joi.string().allow('').default(''),
  REDIS_OTP_TTL: Joi.number().integer().positive().default(600),
}).options({ allowUnknown: true });
