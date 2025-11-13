#!/usr/bin/env node

import { createServer } from '../server';
import { AdapterFactory } from '../adapters/factory';
import { loadConfig, loadServerConfig } from '../config';

async function main() {
  console.log('🚀 CLI Agent OpenAI Adapter');
  console.log('==============================\n');

  // Load configuration
  const config = loadConfig();
  const serverConfig = loadServerConfig();

  console.log('Configuration:');
  console.log(`  Adapter: ${config.type}`);
  console.log(`  Runtime: ${config.runtimeDir}`);
  console.log(`  Timeout: ${config.timeout}ms`);
  console.log(`  Debug: ${config.debug}`);
  console.log(`  Server: http://${serverConfig.host}:${serverConfig.port}\n`);

  // Create adapter
  let adapter;
  try {
    adapter = AdapterFactory.create(config);
  } catch (error: any) {
    console.error(`❌ Failed to create adapter: ${error.message}`);
    process.exit(1);
  }

  // Check if adapter is available
  const isAvailable = await adapter.isAvailable();
  if (!isAvailable) {
    console.error(`❌ ${adapter.getName()} is not available`);
    console.error('   Please make sure the CLI tool is installed and accessible in PATH');
    process.exit(1);
  }

  console.log(`✅ ${adapter.getName()} is available\n`);

  // Create and start server
  const app = createServer(adapter);

  app.listen(serverConfig.port, serverConfig.host, () => {
    console.log(`✅ Server is running at http://${serverConfig.host}:${serverConfig.port}`);
    console.log('\nEndpoints:');
    console.log(`  POST http://${serverConfig.host}:${serverConfig.port}/v1/chat/completions`);
    console.log(`  GET  http://${serverConfig.host}:${serverConfig.port}/v1/models`);
    console.log(`  GET  http://${serverConfig.host}:${serverConfig.port}/health`);
    console.log('\nPress Ctrl+C to stop the server');
  });

  // Graceful shutdown
  process.on('SIGINT', () => {
    console.log('\n\n👋 Shutting down gracefully...');
    process.exit(0);
  });

  process.on('SIGTERM', () => {
    console.log('\n\n👋 Shutting down gracefully...');
    process.exit(0);
  });
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
