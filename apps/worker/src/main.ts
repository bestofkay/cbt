/**
 * Background jobs (grading, email, webhooks) run in-process inside the API.
 * This process is optional and kept for compatibility with older scripts.
 */
console.info(
  'CBT worker: no separate Redis/BullMQ worker is required. Jobs are handled by the API runtime.',
);

// Keep process alive so `pnpm --filter @cbt/worker dev` does not exit immediately.
setInterval(() => {
  /* heartbeat */
}, 60_000);

process.on('SIGINT', () => process.exit(0));
process.on('SIGTERM', () => process.exit(0));
