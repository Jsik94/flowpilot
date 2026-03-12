import { Body, Controller, Post } from '@nestjs/common';
import { RecommendRequest, RecommendService } from './recommend.service';

@Controller('recommend')
export class RecommendController {
  constructor(private readonly recommendService: RecommendService) {}

  @Post()
  recommend(@Body() payload: RecommendRequest) {
    return this.recommendService.recommend(payload);
  }
}
