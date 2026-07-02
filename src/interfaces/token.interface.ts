import { UserType } from 'src/constants';
export interface ITokenPayload {
  id: string;
  email: string;
  telephoneNumber?: string;
  userType: UserType;
  hasCompletedBusinessProfile?: boolean;
  isActive?: boolean;
  isVerified?: boolean;
  isSuspended?: boolean;
  businessId?: string;
  riderId?: string;
  sessionId?: string;
  businessName?: string;
  businessSlug?: string;
  isBusinessVerified?: boolean;
}
