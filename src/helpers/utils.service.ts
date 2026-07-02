import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PaginationQuery } from '../interfaces/pagination.interface';

@Injectable()
export class UtilsService {
  constructor(private configService: ConfigService) {}

  getPaginationData(query: PaginationQuery, count: number) {
    const skip = query.page ?? 1;
    const limit = query.limit ?? 10;
    const offset = (skip - 1) * limit;
    const totalPages = Math.ceil(count / limit);

    return {
      limit,
      offset,
      totalPages,
    };
  }
}
