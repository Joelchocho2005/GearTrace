import { Controller, Get } from '@nestjs/common';
import { SearchLogService } from './search-log.service';

@Controller('logs')
export class SearchLogController {
  constructor(private readonly searchLogService: SearchLogService) {}

  @Get()
  findRecent() {
    return this.searchLogService.findRecent();
  }
}
