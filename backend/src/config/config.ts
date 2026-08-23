import path from 'node:path';
import dotenv from 'dotenv';
import Joi from 'joi';

dotenv.config({ path: path.resolve(process.cwd(), '../.env') });
dotenv.config({ path: path.resolve(process.cwd(), '../env/dev/backend.env'), override: false });
dotenv.config({ path: path.resolve(process.cwd(), '.env'), override: false });

const envVarsSchema = Joi.object()
  .keys({
    NODE_ENV: Joi.string().valid('production', 'development', 'test').required(),
    PORT: Joi.number().default(3000),
    DATABASE_URL: Joi.string().required().description('PostgreSQL database URL'),
    JWT_SECRET: Joi.string().required().description('JWT secret key'),
    JWT_ACCESS_EXPIRATION_MINUTES: Joi.number().default(30).description('minutes after which access tokens expire'),
    JWT_REFRESH_EXPIRATION_DAYS: Joi.number().default(30).description('days after which refresh tokens expire'),
    OTP_EXPIRES_MINUTES: Joi.number().default(5).description('minutes after which code expires'),
    OTP_MAX_ATTEMPTS: Joi.number().default(5).description('max OTP attempts'),
    SMTP_HOST: Joi.string()
      .when('NODE_ENV', { is: 'production', then: Joi.required() })
      .description('server that will send login OTP emails'),
    SMTP_PORT: Joi.number()
      .when('NODE_ENV', { is: 'production', then: Joi.required() })
      .description('port to connect to the email server'),
    SMTP_USERNAME: Joi.string()
      .when('NODE_ENV', { is: 'production', then: Joi.required() })
      .description('username for email server'),
    SMTP_PASSWORD: Joi.string()
      .when('NODE_ENV', { is: 'production', then: Joi.required() })
      .description('password for email server'),
    EMAIL_FROM: Joi.string()
      .when('NODE_ENV', { is: 'production', then: Joi.required() })
      .description('the from field in login OTP emails'),
    FRONTEND_URL: Joi.string().uri().default('http://localhost:5173').description('front-end app URL'),
  })
  .unknown();

const { value: envVars, error } = envVarsSchema.prefs({ errors: { label: 'key' } }).validate(process.env);

if (error) {
  throw new Error(`Config validation error: ${error.message}`);
}

const smtpAuth =
  envVars.SMTP_USERNAME && envVars.SMTP_PASSWORD
    ? {
        auth: {
          user: envVars.SMTP_USERNAME,
          pass: envVars.SMTP_PASSWORD,
        },
      }
    : {};

const config = {
  env: envVars.NODE_ENV,
  port: envVars.PORT,
  database: {
    url: envVars.DATABASE_URL,
    logging: false,
  },
  jwt: {
    secret: envVars.JWT_SECRET,
    accessExpirationMinutes: envVars.JWT_ACCESS_EXPIRATION_MINUTES,
    refreshExpirationDays: envVars.JWT_REFRESH_EXPIRATION_DAYS,
  },
  email: {
    smtp: {
      host: envVars.SMTP_HOST,
      port: envVars.SMTP_PORT,
      ...smtpAuth,
    },
    from: envVars.EMAIL_FROM,
  },
  otp: {
    expiresMinutes: envVars.OTP_EXPIRES_MINUTES,
    maxAttempts: envVars.OTP_MAX_ATTEMPTS,
  },
  frontendUrl: envVars.FRONTEND_URL,
};

export default config;
