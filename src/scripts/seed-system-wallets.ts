import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { AppModule } from '../app.module';
import { DataSource } from 'typeorm';
import { WalletOwnerType, WalletStatus, WalletProvider } from '../constants';

const SYSTEM_WALLETS = [
  {
    ownerType: WalletOwnerType.CLEARING,
    label: 'Clearing',
  },
  {
    ownerType: WalletOwnerType.PLATFORM,
    label: 'Platform',
  },
];

async function bootstrap() {
  const logger = new Logger('SeedSystemWallets');
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['log', 'error', 'warn'],
  });

  const dataSource = app.get(DataSource);

  for (const { ownerType, label } of SYSTEM_WALLETS) {
    const existing = await dataSource.query(
      `SELECT id FROM wallet WHERE "ownerType" = $1 LIMIT 1`,
      [ownerType],
    );

    if (existing.length > 0) {
      logger.log(
        `${label} wallet already exists (id=${existing[0].id}) — skipping`,
      );
      continue;
    }

    const result = await dataSource.query(
      `INSERT INTO wallet ("ownerType", "ownerId", currency, balance, "ledgerBalance", status, provider)
       VALUES ($1, gen_random_uuid(), 'NGN', 0, 0, $2, $3)
       RETURNING id`,
      [ownerType, WalletStatus.READY, WalletProvider.DROVA],
    );

    logger.log(`Created ${label} wallet (id=${result[0].id})`);
  }

  await app.close();
  process.exit(0);
}

bootstrap().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
