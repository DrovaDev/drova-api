import { QueryRunner } from 'typeorm';

export interface IQueryRunnerFactory {
  createQueryRunner(): QueryRunner;
}
