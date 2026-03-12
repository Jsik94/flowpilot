import { Module } from '@nestjs/common';
import { AnalyzeController } from './analyze/analyze.controller';
import { AnalyzeService } from './analyze/analyze.service';
import { HealthController } from './health/health.controller';

@Module({
  controllers: [HealthController, AnalyzeController],
  providers: [AnalyzeService],
})
export class AppModule {}
