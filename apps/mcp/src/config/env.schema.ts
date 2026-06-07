import Joi from 'joi';

export const envSchema = Joi.object({
    CTM_API_BASE_URL: Joi.string().uri().required(),
    MCP_PUBLIC_URL: Joi.string().uri().required(),
    RSA_PUBLIC_KEY: Joi.string().required(),
    PORT: Joi.number().default(3002),
    NODE_ENV: Joi.string().valid('development', 'production', 'test').default('development'),
});
