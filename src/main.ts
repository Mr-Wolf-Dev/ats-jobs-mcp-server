import { pathToFileURL } from 'node:url';
import { runActorBatch, type AtsBillingEvent } from './adapters/apify-actor.js';
import { AtsHttpClient } from './adapters/ats-http-client.js';
import { createConfiguredMcpServer, createAtsMcpHttpServer } from './adapters/mcp-server.js';
import { runDualModeActor } from './shared/actor-runner.js';
import { createApifyBillingMeter } from './shared/billing-meter.js';

export async function main(): Promise<void> {
  const source = new AtsHttpClient();
  const billing = createApifyBillingMeter<AtsBillingEvent>();

  await runDualModeActor({
    runBatch: () => runActorBatch(source, billing),
    createMcpServer: () => createAtsMcpHttpServer({ source, billing }),
    createStdioMcpServer: () => createConfiguredMcpServer({ source, billing }),
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  void main();
}
