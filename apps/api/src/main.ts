import { buildApp } from './app.js';
import { assertProductionConfig, env } from './config/env.js';

async function main() {
  assertProductionConfig();
  const app = await buildApp();
  try {
    await app.listen({ port: env.port, host: env.host });
    app.log.info(`API listening on ${env.host}:${env.port} (${env.nodeEnv})`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

void main();
