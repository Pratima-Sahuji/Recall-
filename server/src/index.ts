import { createApp } from './app';
import { config } from './config';
import { connectDatabase } from './config/prisma';

async function bootstrap() {
  const app = createApp();

  await connectDatabase();

  app.listen(config.port, () => {
    console.log(`=========================================`);
    console.log(` Recall Server running on port ${config.port}`);
    console.log(` Environment: ${config.nodeEnv}`);
    console.log(` Health check: http://localhost:${config.port}/api/health`);
    console.log(`=========================================`);
  });
}

bootstrap().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});

