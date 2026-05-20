import Joi from 'joi';

export const envSchema = Joi.object({
    MONGODB_URI: Joi.string().required(),
    JWT_SECRET: Joi.string().min(32).required(),
    ENCRYPTION_KEY: Joi.string().hex().length(64).required(),
    PORT: Joi.number().default(3000),
    NODE_ENV: Joi.string().valid('development', 'production', 'test').default('development'),
});
