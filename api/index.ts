// Vercel Function for the /api base path. All API behavior remains in the
// shared Express app, including authentication and the JSON 404 handler.
import app from '../server';

export default app;
