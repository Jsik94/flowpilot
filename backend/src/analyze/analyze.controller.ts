import { Body, Controller, Post } from '@nestjs/common';
import { AnalyzeRequest, AnalyzeService } from './analyze.service';

@Controller('analyze')
export class AnalyzeController {
  constructor(private readonly analyzeService: AnalyzeService) {}

  @Post()
  analyze(@Body() payload: AnalyzeRequest) {
    return this.analyzeService.analyze(payload);
  }
}
