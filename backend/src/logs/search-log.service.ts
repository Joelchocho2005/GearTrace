import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class SearchLogService {
  constructor(private readonly prisma: PrismaService) {}

  findRecent() {
    return this.prisma.searchLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: 50,
      select: {
        id: true,
        query: true,
        found: true,
        alexaResponse: true,
        createdAt: true,
      },
    });
  }
}
