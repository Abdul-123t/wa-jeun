// Vercel Function for the /api base path. Vercel compiles and bundles the
// imported TypeScript source with this function instead of relying on a
// separately generated dist/server.js artifact.
import app from '../server.ts';

export default app;
