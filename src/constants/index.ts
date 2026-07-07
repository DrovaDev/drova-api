export enum UserType {
  BUSINESS = 'business',
  RIDER = 'rider',
}

export enum DeliveryScope {
  INTRACITY = 'intracity',
  INTERSTATE = 'interstate',
}

export const QUERY_RUNNER_FACTORY = Symbol('QUERY_RUNNER_FACTORY');

export enum VehicleType {
  BIKE = 'bike',
  CAR = 'car',
  VAN = 'van',
  TRUCK = 'truck',
  BICYCLE = 'bicycle',
}

export enum PackageType {
  DOCUMENT = 'document',
  PARCEL = 'parcel',
  FOOD = 'food',
  MEDICAL = 'medical',
  CLOTHING = 'clothing',
  ELECTRONICS = 'electronics',
  CONFECTIONERY = 'confectionery',
  BULKY = 'bulky',
  FURNITURE = 'furniture',
  GROCERY = 'grocery',
  FRAGILE = 'fragile',
}

export enum RiderStatus {
  PENDING = 'pending',
  ACTIVE = 'active',
  SUSPENDED = 'suspended',
  INACTIVE = 'inactive',
}

export enum AvailabilityStatus {
  AVAILABLE = 'available',
  ON_TRIP = 'on_trip',
  OFFLINE = 'offline',
}

export enum NigerianState {
  ABIA = 'Abia',
  ADAMAWA = 'Adamawa',
  AKWA_IBOM = 'Akwa Ibom',
  ANAMBRA = 'Anambra',
  BAUCHI = 'Bauchi',
  BAYELSA = 'Bayelsa',
  BENUE = 'Benue',
  BORNO = 'Borno',
  CROSS_RIVER = 'Cross River',
  DELTA = 'Delta',
  EBONYI = 'Ebonyi',
  EDO = 'Edo',
  EKITI = 'Ekiti',
  ENUGU = 'Enugu',
  GOMBE = 'Gombe',
  IMO = 'Imo',
  JIGAWA = 'Jigawa',
  KADUNA = 'Kaduna',
  KANO = 'Kano',
  KATSINA = 'Katsina',
  KEBBI = 'Kebbi',
  KOGI = 'Kogi',
  KWARA = 'Kwara',
  LAGOS = 'Lagos',
  NASARAWA = 'Nasarawa',
  NIGER = 'Niger',
  OGUN = 'Ogun',
  ONDO = 'Ondo',
  OSUN = 'Osun',
  OYO = 'Oyo',
  PLATEAU = 'Plateau',
  RIVERS = 'Rivers',
  SOKOTO = 'Sokoto',
  TARABA = 'Taraba',
  YOBE = 'Yobe',
  ZAMFARA = 'Zamfara',
  FCT = 'FCT Abuja',
}

export enum SubscriptionPlan {
  FREE = 'free',
  STARTER = 'starter',
  PROFESSIONAL = 'professional',
  ENTERPRISE = 'enterprise',
}

export enum BusinessDayOfWeek {
  MONDAY = 'monday',
  TUESDAY = 'tuesday',
  WEDNESDAY = 'wednesday',
  THURSDAY = 'thursday',
  FRIDAY = 'friday',
  SATURDAY = 'saturday',
  SUNDAY = 'sunday',
}

export enum BusinessOperatingStatus {
  OPEN = 'open',
  CLOSED = 'closed',
}

export type BusinessOperatingHour = {
  day: BusinessDayOfWeek;
  opensAt: string | null;
  closesAt: string | null;
  status: BusinessOperatingStatus;
};

export enum RiderTierLevel {
  BRONZE = 'bronze', // Entry level (default)
  SILVER = 'silver', // Intermediate
  GOLD = 'gold', // Advanced
  RUBY = 'ruby', // Premium
  DIAMOND = 'diamond', // Elite
  PLATINUM = 'platinum', // Highest tier
}

export enum RiderBadge {
  // ─── Delivery Milestones ──────────────────────────────────────────────────────

  FIRST_MOVE = 'first_move',
  // Awarded on completing the very first delivery.
  // The starting point of every rider's journey on Drova.

  CENTURY_RIDER = 'century_rider',
  // Awarded on completing 100 total deliveries.
  // Marks the transition from a new rider to an experienced one.

  HALF_THOUSAND = 'half_thousand',
  // Awarded on completing 500 total deliveries.
  // Recognises a rider who has become a platform veteran.

  THOUSAND_STRONG = 'thousand_strong',
  // Awarded on completing 1,000 total deliveries.
  // Elite milestone — fewer than 5% of riders ever reach this.

  FIVE_THOUSAND_CLUB = 'five_thousand_club',
  // Awarded on completing 5,000 total deliveries.
  // Reserved for the top tier of Drova's most dedicated riders.

  // ─── Speed & Efficiency ───────────────────────────────────────────────────────

  QUICK_DRAW = 'quick_draw',
  // Awarded for accepting an assigned order within 60 seconds
  // on 10 consecutive occasions. Signals high responsiveness.

  SPEED_DEMON = 'speed_demon',
  // Awarded for completing 10 consecutive deliveries
  // within the estimated delivery time. Consistently fast.

  LIGHTNING_RUN = 'lightning_run',
  // Awarded for completing a delivery in under 50% of
  // the estimated time. A single exceptional performance badge.

  PRECISION_PILOT = 'precision_pilot',
  // Awarded for maintaining an on-time delivery rate
  // above 95% over a minimum of 50 deliveries.

  // ─── Ratings & Customer Satisfaction ─────────────────────────────────────────

  CROWD_FAVOURITE = 'crowd_favourite',
  // Awarded for receiving 50 five-star reviews in total.
  // Demonstrates consistent customer satisfaction.

  GOLDEN_GLOVE = 'golden_glove',
  // Awarded for maintaining a 4.8+ average rating
  // across a minimum of 100 reviews.

  FIVE_STAR_STREAK = 'five_star_streak',
  // Awarded for receiving 10 consecutive five-star ratings
  // without a single rating below 4 stars in between.

  ZERO_COMPLAINTS = 'zero_complaints',
  // Awarded for completing 100 deliveries with
  // zero disputes raised against the rider.

  CUSTOMER_CHAMPION = 'customer_champion',
  // Awarded when a rider is mentioned by name
  // in 20 positive written reviews by customers.

  // ─── Streaks & Consistency ────────────────────────────────────────────────────

  HEAT_SEEKER = 'heat_seeker',
  // Awarded for completing at least one delivery
  // every day for 7 consecutive days.

  IRON_RIDER = 'iron_rider',
  // Awarded for completing at least one delivery
  // every day for 30 consecutive days without a break.

  UNSTOPPABLE = 'unstoppable',
  // Awarded for completing at least one delivery
  // every day for 60 consecutive days.

  MONTH_KING = 'month_king',
  // Awarded for being the highest-earning rider
  // within a business for an entire calendar month.

  WEEKEND_WARRIOR = 'weekend_warrior',
  // Awarded for completing deliveries on every
  // Saturday and Sunday for 4 consecutive weekends.

  // ─── Package & Service Specialisation ────────────────────────────────────────

  FOOD_FLEET = 'food_fleet',
  // Awarded for completing 200 food delivery orders.
  // Recognises specialisation in time-sensitive food logistics.

  MEDICAL_COURIER = 'medical_courier',
  // Awarded for completing 100 medical or pharmacy deliveries.
  // Highlights a rider trusted with sensitive health cargo.

  FRAGILE_HANDLER = 'fragile_handler',
  // Awarded for completing 50 fragile package deliveries
  // with zero damage disputes. Careful and trustworthy.

  BULK_MOVER = 'bulk_mover',
  // Awarded for completing 50 bulk or furniture
  // deliveries without a single cancellation.

  LONG_HAULER = 'long_hauler',
  // Awarded for completing 25 interstate deliveries.
  // Recognises riders who handle cross-state logistics.

  // ─── Earnings ─────────────────────────────────────────────────────────────────

  FIRST_PAY = 'first_pay',
  // Awarded on receiving the first payout from a business.
  // Marks the moment a rider earns real money on Drova.

  NAIRA_CHASER = 'naira_chaser',
  // Awarded for earning a total of ₦100,000 on the platform.

  HIGH_EARNER = 'high_earner',
  // Awarded for earning a total of ₦500,000 on the platform.

  MONEY_MACHINE = 'money_machine',
  // Awarded for earning a total of ₦1,000,000 on the platform.
  // A prestige badge for top-performing riders.

  PEAK_HOUR_PRO = 'peak_hour_pro',
  // Awarded for completing 100 deliveries during peak hours
  // (7–9am or 5–8pm). Reliable during the most demanding windows.

  // ─── Trust & Verification ─────────────────────────────────────────────────────

  VERIFIED_RIDER = 'verified_rider',
  // Awarded when NIN verification and bank account
  // linking are both completed. A baseline trust badge.

  TRUSTED_COURIER = 'trusted_courier',
  // Awarded after 6 months on the platform with
  // an average rating above 4.5 and zero suspensions.

  GUARANTOR_BACKED = 'guarantor_backed',
  // Awarded when a valid guarantor has been submitted
  // and verified by the business owner.

  // ─── Gamification Levels (auto-awarded on level change) ──────────────────────

  BRONZE_WINGS = 'bronze_wings',
  // Automatically awarded when a rider reaches Bronze level
  // (0–499 points). Given to all riders on first delivery.

  SILVER_WINGS = 'silver_wings',
  // Automatically awarded when a rider reaches Silver level
  // (500–1,499 points).

  GOLD_WINGS = 'gold_wings',
  // Automatically awarded when a rider reaches Gold level
  // (1,500–3,999 points).

  PLATINUM_WINGS = 'platinum_wings',
  // Automatically awarded when a rider reaches Platinum level
  // (4,000+ points). The highest level badge on the platform.

  // ─── Special & Seasonal ───────────────────────────────────────────────────────

  EARLY_ADOPTER = 'early_adopter',
  // Awarded to riders who joined the platform during
  // the closed beta (first 50 riders ever onboarded on Drova).

  BETA_LEGEND = 'beta_legend',
  // Awarded to riders who completed 50+ deliveries
  // during the closed beta period. A rare founding badge.

  COMEBACK_KID = 'comeback_kid',
  // Awarded when a rider returns to active status after
  // being inactive for 30+ days and completes 10 deliveries within a week.

  ALL_TERRAIN = 'all_terrain',
  // Awarded for completing deliveries in at least
  // 3 different Nigerian states on the same account.

  NIGHT_OWL = 'night_owl',
  // Awarded for completing 50 deliveries between
  // 9pm and 5am. Reliable in off-peak hours.

  RAINY_DAY_RIDER = 'rainy_day_rider',
  // Awarded for completing deliveries on 10 separate days
  // flagged as adverse weather conditions. Goes above and beyond.
}

export enum InviteStatus {
  PENDING = 'pending',
  ACCEPTED = 'accepted',
  REJECTED = 'rejected',
}

export enum Gender {
  MALE = 'male',
  FEMALE = 'female',
  OTHER = 'other',
}

export enum WalletOwnerType {
  BUSINESS = 'BUSINESS',
  RIDER = 'RIDER',
  PLATFORM = 'PLATFORM',
  CLEARING = 'CLEARING',
}

export enum WalletStatus {
  ACTIVE = 'ACTIVE',
  SUSPENDED = 'SUSPENDED',
  READY = 'READY',
}

export enum WalletProvider {
  DROVA = 'DROVA',
}

export enum PickupMethod {
  BUSINESS_PICKUP = 'business_pickup', // Business rider comes to customer
  WALK_IN = 'walk_in', // Customer brings package to office/warehouse
}

export enum DeliveryPriority {
  EXPRESS = 'express', // Same-day delivery
  SCHEDULED = 'scheduled', // Customer selects expected delivery date
}

export enum OrderStatus {
  PENDING = 'pending',
  INVOICED = 'invoiced',
  CONFIRMED = 'payment_confirmed',
  OFFER_PENDING = 'offer_pending',
  ASSIGNED = 'assigned',
  EN_ROUTE_PICKUP = 'en_route_pickup',
  PICKED_UP = 'picked_up',
  IN_TRANSIT = 'in_transit',
  ARRIVED_AT_DELIVERY = 'arrived_at_delivery',
  COMPLETED = 'completed',
  DISPUTED = 'disputed',
  CANCELLED = 'cancelled',
}

export enum PaymentStatus {
  PENDING = 'pending',
  HELD = 'held', // Funds in escrow
  RELEASED = 'released', // Released to business
  REFUNDED = 'refunded',
  FAILED = 'failed',
}

export enum CancelledBy {
  CUSTOMER = 'customer',
  BUSINESS = 'business',
  ADMIN = 'admin',
  SYSTEM = 'system',
}

export enum PaymentMethod {
  BANK_TRANSFER = 'bank_transfer',
  CARD = 'card',
  PAYMENT_LINK = 'payment_link',
}

export enum JournalType {
  ORDER_SETTLEMENT = 'order_settlement',
  BUSINESS_TO_RIDER_PAYOUT = 'business_to_rider_payout',
  PLATFORM_FEE_SPLIT = 'platform_fee_split',
  RIDER_WITHDRAWAL = 'rider_withdrawal',
  BUSINESS_WITHDRAWAL = 'business_withdrawal',
  ESCROW_HOLD = 'escrow_hold',
  ESCROW_RELEASE = 'escrow_release',
  ESCROW_REFUND = 'escrow_refund',
  TRANSFER_FEE = 'transfer_fee',
  REVERSAL = 'reversal',
  ADJUSTMENT = 'adjustment',
}

export enum JournalStatus {
  PENDING = 'pending', // Created but not yet posted
  POSTED = 'posted', // Finalized — balances updated
  REVERSED = 'reversed', // Undone by a REVERSAL journal
  FAILED = 'failed', // Could not be posted (provider error)
}

export enum LedgerEntryDirection {
  DEBIT = 'debit',
  CREDIT = 'credit',
}

export enum PayoutStatus {
  REQUESTED = 'requested',
  PROCESSING = 'processing',
  SUCCESS = 'success',
  FAILED = 'failed',
  CANCELED = 'canceled',
}

export enum PayoutProvider {
  NOMBA = 'nomba',
}

export enum ReviewTargetType {
  BUSINESS = 'BUSINESS',
  RIDER = 'RIDER',
}

export enum InAppNotificationType {
  // Rider notifications
  ORDER_OFFER = 'ORDER_OFFER',
  ORDER_ASSIGNED = 'ORDER_ASSIGNED',
  ORDER_STATUS_UPDATE = 'ORDER_STATUS_UPDATE',
  ORDER_COMPLETED = 'ORDER_COMPLETED',
  ORDER_UNASSIGNED = 'ORDER_UNASSIGNED',
  WALLET_CREDITED = 'WALLET_CREDITED',

  // Business notifications
  NEW_ORDER = 'NEW_ORDER',
  ORDER_OFFER_EXPIRED = 'ORDER_OFFER_EXPIRED',
  ORDER_OFFER_REJECTED = 'ORDER_OFFER_REJECTED',
}
