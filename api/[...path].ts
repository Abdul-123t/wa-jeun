// Vercel compiles this TypeScript function and bundles its imported source.
// Importing server.ts avoids relying on dist/server.js being copied alongside
// the function in Vercel's serverless artifact.
import app from '../server.ts';

export default app;
