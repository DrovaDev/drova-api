import { Controller, Body, Get, Post, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiTags,
  ApiBody,
  ApiOperation,
} from '@nestjs/swagger';
import { Auth, Roles } from 'src/interfaces/customs.decorator';
import { AuthGuard } from '../authentication/guards/authentication.guard';
import type { ITokenPayload } from 'src/interfaces/token.interface';
import { BusinessService } from './business.service';
import { RolesGuard } from '../authentication/guards/roles.guard';
import { UserType } from 'src/constants';
import {
  BusinessProfileSetupDTO,
  EditBusinessProfileDTO,
  ValidateBusinessTinDTO,
} from './dtos/business.dto';

@Controller('business')
@ApiTags('business')
export class BusinessController {
  constructor(private readonly businessService: BusinessService) {}

  @Get('profile')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles(UserType.BUSINESS)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get my business profile (business)' })
  async getMyBusinessProfile(@Auth() auth: ITokenPayload) {
    return await this.businessService.getMyBusinessProfile(auth.id);
  }

  @Post('profile/setup')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles(UserType.BUSINESS)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Setup business profile' })
  @ApiBody({
    type: BusinessProfileSetupDTO,
    description: 'business profile setup payload',
  })
  async setupBusinessProfile(
    @Auth() auth: ITokenPayload,
    @Body() payload: BusinessProfileSetupDTO,
  ) {
    return await this.businessService.setupBusinessProfile(auth.id, payload);
  }

  @Post('profile/edit')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles(UserType.BUSINESS)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Edit business profile' })
  @ApiBody({
    type: EditBusinessProfileDTO,
    description: 'business profile edit payload',
  })
  async editBusinessProfile(
    @Auth() auth: ITokenPayload,
    @Body() payload: EditBusinessProfileDTO,
  ) {
    return await this.businessService.editBusinessProfile(auth.id, payload);
  }

  @Post('validate-tin')
  @ApiOperation({ summary: 'Validate business name and TIN using RC number' })
  @ApiBody({
    type: ValidateBusinessTinDTO,
    description: 'business validation payload',
  })
  async validateBusinessNameAndTin(@Body() payload: ValidateBusinessTinDTO) {
    return await this.businessService.validateBusinessNameAndTin(payload);
  }

  @Get('states')
  @ApiOperation({ summary: 'Get list of Nigerian states' })
  getNigerianStates() {
    return this.businessService.getNigerianStates();
  }

  @Get('lookups')
  @ApiOperation({ summary: 'Get lookup values used for onboarding forms' })
  getBusinessLookups() {
    return this.businessService.getBusinessLookups();
  }

}
