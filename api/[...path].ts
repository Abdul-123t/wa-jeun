// Catch all nested /api/* requests and forward them to the same Express app
// used by local development and conventional Node deployments.
import app from '../server';

export default app;
