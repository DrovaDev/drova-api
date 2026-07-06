import {
  Injectable,
  BadRequestException,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import {
  UserRegistrationDTO,
  EmailVerificationDTO,
  ForgotPasswordDTO,
  ChangePasswordDTO,
  ResetPasswordDTO,
  SendOTPDTO,
  ValidateOtpDTO,
  ValidateRiderOtpDTO,
  LoginDTO,
} from './dtos/auth.dto';
import { randomUUID } from 'node:crypto';
import * as bcrypt from 'bcrypt';
import { JwtService } from '@nestjs/jwt';
import { IResponse } from 'src/interfaces/response.interface';
import { Helpers } from 'src/helpers/random-generator';
import { normalizePhoneNumber } from 'src/helpers/normalize-phone-number';
import {
  InviteStatus,
  ReviewTargetType,
  RiderStatus,
  UserType,
} from 'src/constants';
import { EmailService } from 'src/services/email.service';
import { EmailMessage } from 'src/interfaces/mail.interface';
import { Auth } from './schemas/auth.schema';
import { AuthenticationDb } from './authentication.db';
import { RiderDb } from 'src/api/rider/rider.db';
import { BusinessDb } from 'src/api/business/business.db';
import { NotificationDb } from 'src/api/notification/notification.db';
import { ReviewsDb } from 'src/api/reviews/reviews.db';

@Injectable()
export class AuthenticationService {
  private readonly logger = new Logger(AuthenticationService.name);
  private static readonly ENVIRONMENT = process.env.NODE_ENV || 'development';

  constructor(
    private readonly authDb: AuthenticationDb,
    private readonly riderDb: RiderDb,
    private readonly businessDb: BusinessDb,
    private readonly notificationDb: NotificationDb,
    private readonly reviewsDb: ReviewsDb,
    private readonly jwtService: JwtService,
    private readonly helpers: Helpers,
    private readonly emailService: EmailService,
  ) {}

  // ─── Private helpers ────────────────────────────────────────────────────────

  private normalizeEmail(email: string): string {
    return email.toLowerCase().trim();
  }

  private async hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, 10);
  }

  private async comparePasswords(
    plain: string,
    hashed: string,
  ): Promise<boolean> {
    return bcrypt.compare(plain, hashed);
  }

  private validatePasswordsMatch(
    newPassword: string,
    confirmPassword: string,
  ): void {
    if (newPassword !== confirmPassword) {
      throw new BadRequestException(
        'New password and confirm password do not match',
      );
    }
  }

  private assertAccountActive(user: Auth): void {
    if (!user.isVerified)
      throw new UnauthorizedException('Account is not verified');
    if (!user.isActive) throw new UnauthorizedException('Account is inactive');
    if (user.isSuspended)
      throw new UnauthorizedException('Account is suspended');
  }

  private async generateAndSaveOtp(authId: string): Promise<string> {
    const otp = this.helpers.generateOTP(6);
    await this.authDb.upsertOtpTransaction({
      authId,
      otpCode: otp,
      expiresAt: new Date(Date.now() + 10 * 60 * 1000),
      isUsed: false,
    });
    return otp;
  }

  private async signTempToken(
    id: string,
    email?: string | null,
  ): Promise<string> {
    return this.jwtService.signAsync({ id, email });
  }

  private async sendEmailSafe(message: EmailMessage): Promise<void> {
    try {
      await this.emailService.sendMail(message);
    } catch (error) {
      this.logger.warn('Failed to send email', error);
    }
  }

  private async findAndValidateOtp(authId: string, otp: string) {
    const otpRecord = await this.authDb.findOtpByAuthId(authId);
    if (!otpRecord)
      throw new NotFoundException('OTP not found. Please request a new one.');
    if (otpRecord.isUsed)
      throw new BadRequestException(
        'OTP has already been used. Please request a new one.',
      );
    if (otpRecord.expiresAt < new Date())
      throw new BadRequestException(
        'OTP has expired. Please request a new one.',
      );
    if (otpRecord.otpCode !== otp)
      throw new UnauthorizedException('Invalid OTP. Please try again.');
    return otpRecord;
  }

  // ─── Login flows ─────────────────────────────────────────────────────────────

  private async loginBusiness(payload: LoginDTO): Promise<IResponse> {
    if (!payload.email)
      throw new BadRequestException('Email is required for business login');
    if (!payload.password)
      throw new BadRequestException('Password is required');

    const user = await this.authDb.findAuthByEmail({
      email: this.normalizeEmail(payload.email),
      userType: UserType.BUSINESS,
    });
    if (!user) throw new UnauthorizedException('Invalid email or password');
    this.assertAccountActive(user);

    const isPasswordValid = await this.comparePasswords(
      payload.password,
      user.password!,
    );
    if (!isPasswordValid)
      throw new UnauthorizedException('Invalid email or password');

    let businessPayload: Record<string, any> | undefined;
    let businessResponse: Record<string, any> | null = null;

    if (user.hasCompletedBusinessProfile) {
      const business = await this.businessDb.findBusinessByAuthId(user.id);
      if (business) {
        businessPayload = {
          businessId: String(business.id),
          businessName: business.businessName,
          businessSlug: business.slug,
          isBusinessVerified: business.isVerified,
        };
        businessResponse = {
          id: business.id,
          businessName: business.businessName,
          slug: business.slug,
          isBusinessVerified: business.isVerified,
        };
      }
    }

    const accessToken = await this.jwtService.signAsync({
      id: String(user.id),
      email: user.email,
      isActive: user.isActive,
      isVerified: user.isVerified,
      isSuspended: user.isSuspended,
      userType: user.userType,
      hasCompletedBusinessProfile: !!user.hasCompletedBusinessProfile,
      ...businessPayload,
    });

    return {
      status: 'success',
      statusCode: 200,
      message: 'Login successful',
      data: {
        accessToken,
        user: {
          id: user.id,
          email: user.email,
          userType: user.userType,
          hasCompletedBusinessProfile: !!user.hasCompletedBusinessProfile,
          business: businessResponse,
        },
      },
    };
  }

  private async loginRider(payload: LoginDTO): Promise<IResponse> {
    if (!payload.telephoneNumber) {
      throw new BadRequestException(
        'telephoneNumber is required for rider login',
      );
    }

    const normalizedPhone = normalizePhoneNumber(
      payload.telephoneNumber.toString().trim(),
    );

    const user = await this.authDb.findAuthByTelephoneNumber({
      telephoneNumber: normalizedPhone,
      userType: UserType.RIDER,
    });
    if (!user) throw new UnauthorizedException('Account not found');
    this.assertAccountActive(user);

    if (AuthenticationService.ENVIRONMENT !== 'development') {
      await this.generateAndSaveOtp(user.id);
    }

    const tempToken = await this.jwtService.signAsync({
      id: String(user.id),
      telephoneNumber: user.telephoneNumber,
      isActive: user.isActive,
      isVerified: user.isVerified,
      isSuspended: user.isSuspended,
      userType: user.userType,
    });

    return {
      status: 'success',
      statusCode: 200,
      message: 'OTP successfully sent',
      data: tempToken,
    };
  }

  // ─── OTP validation ──────────────────────────────────────────────────────────

  private async confirmOTP(userId: string, otp: string): Promise<void> {
    const otpRecord = await this.findAndValidateOtp(userId, otp);
    await this.authDb.markOtpUsedTransaction(String(otpRecord.id));
  }

  // ─── Public methods ──────────────────────────────────────────────────────────

  async login(payload: LoginDTO): Promise<IResponse> {
    if (payload.userType === UserType.RIDER) return this.loginRider(payload);
    if (payload.userType === UserType.BUSINESS)
      return this.loginBusiness(payload);
    throw new BadRequestException('Unsupported user type');
  }

  async validateRiderLoginOTP(
    payload: ValidateRiderOtpDTO,
  ): Promise<IResponse> {
    const decoded = await this.jwtService.verifyAsync(payload.tempToken);
    const userId = decoded.id;

    if (AuthenticationService.ENVIRONMENT === 'production') {
      await this.confirmOTP(userId, payload.otp);
    } else if (payload.otp !== '123456') {
      throw new BadRequestException('Invalid OTP. Please try again.');
    }

    let rider = await this.riderDb.findRiderByAuthId(userId);
    if (rider) {
      // Single-device enforcement
      if (rider.activeDeviceId && rider.activeDeviceId !== payload.deviceId) {
        throw new BadRequestException(
          'You are already logged in on another device. Please log out first.',
        );
      }

      const needsUpdate =
        rider.inviteStatus === InviteStatus.PENDING ||
        rider.status === RiderStatus.PENDING;
      if (needsUpdate) {
        await this.riderDb.updateRiderAfterLoginIfPendingTransaction({
          riderId: rider.id,
        });
        rider = await this.riderDb.findRiderByAuthId(userId);
      }
    }

    const sessionId = randomUUID();

    if (rider) {
      await this.riderDb.saveRiderSession({
        riderId: rider.id,
        activeDeviceId: payload.deviceId,
        sessionId,
      });
    }

    // A partial rider record (created at phone initiation) has no firstName yet.
    const isProfileComplete = !!(
      rider?.firstName &&
      rider?.lastName &&
      rider?.vehicleType
    );

    const accessToken = await this.jwtService.signAsync({
      id: String(userId),
      telephoneNumber: decoded.telephoneNumber,
      isActive: decoded.isActive,
      isVerified: decoded.isVerified,
      isSuspended: decoded.isSuspended,
      userType: decoded.userType,
      riderId: rider ? String(rider.id) : undefined,
      businessId: rider ? String(rider.businessId) : undefined,
      sessionId,
    });

    return {
      status: 'success',
      statusCode: 200,
      message: 'Login successful',
      data: {
        accessToken,
        user: {
          id: userId,
          telephoneNumber: decoded.telephoneNumber,
          userType: decoded.userType,
          rider: isProfileComplete
            ? {
                id: rider!.id,
                businessId: rider!.businessId,
                inviteStatus: rider!.inviteStatus,
                status: rider!.status,
              }
            : null,
        },
      },
    };
  }

  async riderLogout(riderId: string): Promise<IResponse> {
    const rider = await this.riderDb.findRiderByRiderId(riderId);
    if (rider?.authId && rider?.activeDeviceId) {
      await this.notificationDb.deactivateDeviceTokensByDevice({
        authId: rider.authId,
        deviceId: rider.activeDeviceId,
      });
    }
    await this.riderDb.clearRiderSession(riderId);
    return {
      status: 'success',
      statusCode: 200,
      message: 'Logged out successfully',
      data: null,
    };
  }

  async userRegistration(payload: UserRegistrationDTO): Promise<IResponse> {
    const normalizedEmail = this.normalizeEmail(payload.email);

    const emailExists = await this.authDb.findAuthByEmail({
      email: normalizedEmail,
    });
    if (emailExists) throw new BadRequestException('Email already exists');

    const hashedPassword = await this.hashPassword(payload.password);
    const otpCode = this.helpers.generateOTP(6);

    let user: Auth;
    try {
      user = await this.authDb.createAuthWithOtpTransaction({
        auth: {
          email: normalizedEmail,
          password: hashedPassword,
          userType: payload.userType,
        },
        otpCode,
        otpExpiresAt: new Date(Date.now() + 10 * 60 * 1000),
      });
    } catch (error) {
      this.logger.error('Registration failed', error);
      throw new BadRequestException('Registration failed');
    }

    await this.sendEmailSafe({
      to: normalizedEmail,
      subject: 'Email Validation',
      text: `Your email validation OTP is ${otpCode}`,
    });

    return {
      status: 'success',
      statusCode: 201,
      message:
        'User pre-registered successfully. Please verify your email using the OTP sent.',
      data: { userId: user.id, email: user.email },
    };
  }

  async validateUserEmail(payload: EmailVerificationDTO): Promise<IResponse> {
    const normalizedEmail = this.normalizeEmail(payload.email);

    const user = await this.authDb.findAuthByEmail({ email: normalizedEmail });
    if (!user) throw new NotFoundException('User not found');
    if (user.isVerified)
      throw new BadRequestException('Email is already verified');

    const otpRecord = await this.findAndValidateOtp(user.id, payload.otp);

    try {
      await this.authDb.verifyAuthEmailTransaction({
        authId: user.id,
        otpId: otpRecord.id,
      });
    } catch {
      throw new BadRequestException('Email verification failed');
    }

    const welcomeText =
      user.userType === UserType.BUSINESS
        ? 'Your email has been verified successfully. Continue setup to complete your business profile.'
        : 'Your email has been verified successfully. You can now explore our services.';

    await this.sendEmailSafe({
      to: normalizedEmail,
      subject: 'Welcome to Drova',
      text: welcomeText,
    });

    const tempToken = await this.jwtService.signAsync({
      id: String(user.id),
      email: user.email,
      userType: user.userType,
    });

    return {
      status: 'success',
      statusCode: 200,
      message:
        'Email verified successfully. Proceed to set up your business profile.',
      data: { tempToken },
    };
  }

  async resendOTP(payload: SendOTPDTO): Promise<IResponse> {
    const normalizedEmail = this.normalizeEmail(payload.email);

    const user = await this.authDb.findAuthByEmail({ email: normalizedEmail });
    if (!user) throw new NotFoundException('User not found');

    const otp = await this.generateAndSaveOtp(user.id);
    await this.sendEmailSafe({
      to: normalizedEmail,
      subject: 'OTP Code',
      text: `Your new OTP is ${otp}`,
    });

    return {
      status: 'success',
      statusCode: 200,
      message: 'OTP resent successfully. Please check your email.',
    };
  }

  async validateOTP(payload: ValidateOtpDTO): Promise<IResponse> {
    const decoded = await this.jwtService.verifyAsync(payload.tempToken);
    const user = await this.authDb.findAuthByEmail({
      email: this.normalizeEmail(decoded.email),
    });
    if (!user) throw new NotFoundException('User not found');

    await this.confirmOTP(user.id, payload.otp);

    const tempToken = await this.signTempToken(String(user.id), user.email);

    return {
      status: 'success',
      statusCode: 200,
      message: 'OTP validated successfully',
      data: tempToken,
    };
  }

  async forgotPassword(payload: ForgotPasswordDTO): Promise<IResponse> {
    const normalizedEmail = this.normalizeEmail(payload.email);

    const user = await this.authDb.findAuthByEmail({ email: normalizedEmail });
    if (!user) throw new NotFoundException('User not found');

    const otp = await this.generateAndSaveOtp(user.id);

    await this.sendEmailSafe({
      to: normalizedEmail,
      subject: 'Password Reset OTP',
      text: `Your password reset OTP is ${otp}. It expires in 10 minutes.`,
    });

    const tempToken = await this.signTempToken(String(user.id), user.email);

    return {
      status: 'success',
      statusCode: 200,
      message: 'Password reset OTP sent to your email.',
      data: { tempToken },
    };
  }

  async resetPassword(payload: ChangePasswordDTO): Promise<IResponse> {
    this.validatePasswordsMatch(payload.newPassword, payload.confirmPassword);

    const decoded = await this.jwtService.verifyAsync(payload.tempToken);
    const user = await this.authDb.findAuthByEmail({
      email: this.normalizeEmail(decoded.email),
    });
    if (!user) throw new NotFoundException('User not found');

    const hashedPassword = await this.hashPassword(payload.newPassword);
    await this.authDb.updateAuthPasswordTransaction({
      authId: user.id,
      hashedPassword,
    });

    return {
      status: 'success',
      statusCode: 200,
      message: 'Password changed successfully. You can now log in.',
    };
  }

  async getMe(authId: string, userType: UserType): Promise<IResponse> {
    const user = await this.authDb.findAuthById(authId);
    if (!user) throw new NotFoundException('User not found');

    let profile: Record<string, any> | null = null;

    if (userType === UserType.BUSINESS) {
      const business = await this.businessDb.findBusinessByAuthId(authId);
      profile = business
        ? {
            id: business.id,
            businessName: business.businessName,
            slug: business.slug,
            businessAddress: business.businessAddress,
            businessState: business.businessState,
            contactNumber: business.contactNumber,
            businessLogo: business.businessLogo,
            isVerified: business.isVerified,
          }
        : null;
    } else if (userType === UserType.RIDER) {
      const rider = await this.riderDb.findRiderByAuthId(authId);
      if (rider) {
        const averageRating = await this.reviewsDb.getAverageRating(
          rider.id,
          ReviewTargetType.RIDER,
        );
        profile = { ...rider, averageRating };
      }
    }

    return {
      status: 'success',
      statusCode: 200,
      message: 'User fetched successfully',
      data: {
        id: user.id,
        email: user.email,
        telephoneNumber: user.telephoneNumber,
        userType: user.userType,
        isActive: user.isActive,
        isVerified: user.isVerified,
        isSuspended: user.isSuspended,
        profile,
      },
    };
  }

  async changePassword(
    authId: string,
    payload: ResetPasswordDTO,
  ): Promise<IResponse> {
    if (!authId) throw new BadRequestException('authId is required');
    this.validatePasswordsMatch(payload.newPassword, payload.confirmPassword);

    const user = await this.authDb.findAuthById(authId);
    if (!user) throw new NotFoundException('User not found');

    const isCurrentPasswordValid = await this.comparePasswords(
      payload.currentPassword,
      user.password!,
    );
    if (!isCurrentPasswordValid)
      throw new UnauthorizedException('Invalid current password');

    const hashedPassword = await this.hashPassword(payload.newPassword);
    await this.authDb.updateAuthPasswordTransaction({
      authId: user.id,
      hashedPassword,
    });

    if (user.userType === UserType.RIDER) {
      await this.riderDb.setRiderHasChangedPasswordTransaction(user.id);
    }

    return {
      status: 'success',
      statusCode: 200,
      message: 'Password reset successfully',
    };
  }
}
