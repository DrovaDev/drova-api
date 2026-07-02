import { Injectable } from '@nestjs/common';
import { DataSource, QueryRunner } from 'typeorm';
import { IQueryRunnerFactory } from '../interfaces/query-runner-factory.interface';

@Injectable()
export class QueryRunnerFactory implements IQueryRunnerFactory {
  constructor(private dataSource: DataSource) {}

  createQueryRunner(): QueryRunner {
    return this.dataSource.createQueryRunner();
  }
}
