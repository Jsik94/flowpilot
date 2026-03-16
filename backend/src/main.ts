import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { loadLocalEnv } from './load-local-env';

loadLocalEnv();

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const origin = process.env.FRONTEND_URL ?? 'http://localhost:5173';

  app.enableCors({
    origin,
  });
  app.setGlobalPrefix('api');

  const port = Number(process.env.PORT ?? 3001);
  await app.listen(port);
  console.log(`FlowPilot backend listening on http://localhost:${port}`);
}

bootstrap();
