import { Test, TestingModule } from '@nestjs/testing';
import { BusinessService } from './business.service';
import { BusinessDb } from './business.db';
import { BusinessValidationService } from 'src/services/business-validation.service';

describe('BusinessService', () => {
  let service: BusinessService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BusinessService,
        {
          provide: BusinessDb,
          useValue: {},
        },
        {
          provide: BusinessValidationService,
          useValue: { lookupBusinessTIN: jest.fn() },
        },
      ],
    }).compile();

    service = module.get<BusinessService>(BusinessService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
