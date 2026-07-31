import Joi from 'joi';

export const envSchema = Joi.object({
    CTM_API_BASE_URL: Joi.string().uri().required(),
    CTM_PUBLIC_URL: Joi.string().uri().required(),
    MCP_PUBLIC_URL: Joi.string().uri().required(),
    RSA_PUBLIC_KEY: Joi.string().required(),
    PORT: Joi.number().required(),
    NODE_ENV: Joi.string().valid('development', 'production', 'test').required(),
    LOG_LEVEL: Joi.string().valid('trace', 'debug', 'info', 'warn', 'error', 'fatal').required(),
});
