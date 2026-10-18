/** Treat every deployed Vercel runtime as production for persistence and safety guards. */
export function isProductionRuntime(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.NODE_ENV === 'production' || env.VERCEL === '1' || Boolean(env.VERCEL_ENV);
}
