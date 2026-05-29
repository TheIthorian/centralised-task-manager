import Joi from 'joi';

export const envSchema = Joi.object({
    MONGODB_URI: Joi.string().required(),
    JWT_SECRET: Joi.string().min(32).optional(),
    ENCRYPTION_KEY: Joi.string().hex().length(64).required(),
    PORT: Joi.number().default(3000),
    NODE_ENV: Joi.string().valid('development', 'production', 'test').default('development'),
    TODOIST_CLIENT_ID: Joi.string().allow('').default(''),
    TODOIST_CLIENT_SECRET: Joi.string().allow('').default(''),
    GOOGLE_CLIENT_ID: Joi.string().allow('').default(''),
    GOOGLE_CLIENT_SECRET: Joi.string().allow('').default(''),
    REDIRECT_BASE_URL: Joi.string().default('http://localhost:3000'),
    WEB_URL: Joi.string().default('http://localhost:3000'),
    RSA_PRIVATE_KEY: Joi.string().required(),
    RSA_PUBLIC_KEY: Joi.string().required(),
    JWT_ACCESS_EXPIRES: Joi.string().default('15m'),
    REFRESH_TOKEN_EXPIRES_DAYS: Joi.number().integer().min(1).default(30),
    DISCORD_CLIENT_ID: Joi.string().allow('').default(''),
    DISCORD_CLIENT_SECRET: Joi.string().allow('').default(''),
    DISCORD_BOT_TOKEN: Joi.string().allow('').default(''),
    EXPORT_DIR: Joi.string().default('./exports'),
});
