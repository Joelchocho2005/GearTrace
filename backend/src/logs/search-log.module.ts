import { Module } from '@nestjs/common';
import { SearchLogController } from './search-log.controller';
import { SearchLogService } from './search-log.service';

@Module({
  controllers: [SearchLogController],
  providers: [SearchLogService],
})
export class SearchLogModule {}
