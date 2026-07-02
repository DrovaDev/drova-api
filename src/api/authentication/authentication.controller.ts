import { Controller } from '@nestjs/common';
import {
  ApiBearerAuth,
  
  ApiTags,
  ApiParam,
  ApiBody,
  ApiOperation,
  ApiResponse,
} from '@nestjs/swagger';
import { Body, ForbiddenException, Get, Param, Post, UseGuards } from '@nestjs/common';
import { AuthenticationService } from './authentication.service';
import { Auth, Roles } from 'src/interfaces/customs.decorator';
import type { ITokenPayload } from 'src/interfaces/token.interface';
import { AuthGuard } from './guards/authentication.guard';
import {
  UserRegistrationDTO,
  ValidatUserPasswordDTO,
  EmailVerificationDTO,
  ForgotPasswordDTO,
  ChangePasswordDTO,
  ResetPasswordDTO,
  SendOTPDTO,
  ValidateOtpDTO,
  ValidateRiderOtpDTO,
  LoginDTO,
} from './dtos/auth.dto';
import { UserType } from 'src/constants';

@Controller('authentication')
@ApiTags('authentication')
export class AuthenticationController {
  constructor(private readonly authService: AuthenticationService) {}

  @Post('register')
  @ApiBody({
    type: UserRegistrationDTO,
    description: 'user registration payload',
  })
  async userRegistration(@Body() payload: UserRegistrationDTO) {
    return await this.authService.userRegistration(payload);
  }

  @Post('validate-email')
  @ApiBody({
    type: EmailVerificationDTO,
    description: 'email verification payload',
  })
  async validateEmail(@Body() payload: EmailVerificationDTO) {
    return await this.authService.validateUserEmail(payload);
  }

  @Post('resend-otp')
  @ApiBody({ type: SendOTPDTO, description: 'Send OTP paylaod' })
  async sendOTP(@Body() payload: SendOTPDTO) {
    return await this.authService.resendOTP(payload);
  }

  @Post('forgot-password')
  @ApiBody({ type: ForgotPasswordDTO, description: 'forgot password payload' })
  @ApiOperation({ summary: 'Send OTP to email for password reset' })
  async forgotPassword(@Body() payload: ForgotPasswordDTO) {
    return await this.authService.forgotPassword(payload);
  }

  @Post('validate-otp')
  @ApiBody({ type: ValidateOtpDTO, description: 'Validate OTP payload' })
  async validateOTP(@Body() payload: ValidateOtpDTO) {
    return await this.authService.validateOTP(payload);
  }

  @Post('reset-password')
  @ApiBody({ type: ChangePasswordDTO, description: 'change password payload' })
  @ApiOperation({ summary: 'Change password using OTP received via email' })
  async changePassword(@Body() payload: ChangePasswordDTO) {
    return await this.authService.resetPassword(payload);
  }

  @Post('login')
  @ApiBody({ type: LoginDTO, description: 'login payload' })
  async login(@Body() payload: LoginDTO) {
    return await this.authService.login(payload);
  }

  @Post('validate-rider-login-otp')
  @ApiBody({ type: ValidateRiderOtpDTO, description: 'Validate rider OTP payload' })
  @ApiOperation({ summary: 'Validate OTP for rider login — requires deviceId for single-device enforcement' })
  async validateRiderLoginOTP(@Body() payload: ValidateRiderOtpDTO) {
    return await this.authService.validateRiderLoginOTP(payload);
  }

  @Post('rider/logout')
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Log out rider — clears device lock and session, invalidating all existing tokens' })
  async riderLogout(@Auth() auth: ITokenPayload) {
    if (!auth.riderId) {
      throw new ForbiddenException('Rider context is required');
    }
    return await this.authService.riderLogout(auth.riderId);
  }

  @Get('me')
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get the currently authenticated user and their profile' })
  async getMe(@Auth() auth: ITokenPayload) {
    return await this.authService.getMe(auth.id, auth.userType);
  }

  @Post('change-password')
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @ApiBody({ type: ResetPasswordDTO, description: 'reset password payload' })
  async resetPassword(
    @Auth() auth: { id: string },
    @Body() payload: ResetPasswordDTO,
  ) {
    return await this.authService.changePassword(auth.id, payload);
  }
}
