import { Module } from '@nestjs/common';
import { AnalyzeController } from './analyze/analyze.controller';
import { AnalyzeService } from './analyze/analyze.service';
import { HealthController } from './health/health.controller';
import { RecommendController } from './recommend/recommend.controller';
import { RecommendService } from './recommend/recommend.service';

@Module({
  controllers: [HealthController, AnalyzeController, RecommendController],
  providers: [AnalyzeService, RecommendService],
})
export class AppModule {}
