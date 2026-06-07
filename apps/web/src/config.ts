const config = {
    apiUrl: import.meta.env['VITE_API_URL'],
    isDev: import.meta.env.DEV as boolean,
} as const;

export default config;
