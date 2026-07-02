import { Test, TestingModule } from '@nestjs/testing';
import { RiderService } from './rider.service';
import { RiderDb } from './rider.db';

describe('RiderService', () => {
  let service: RiderService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RiderService,
        {
          provide: RiderDb,
          useValue: {},
        },
      ],
    }).compile();

    service = module.get<RiderService>(RiderService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
