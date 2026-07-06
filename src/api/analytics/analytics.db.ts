import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

@Injectable()
export class AnalyticsDb {
  constructor(
    @InjectDataSource()
    private readonly dataSource: DataSource,
  ) {}

  private dateParams(
    opts: { startDate?: string; endDate?: string },
    params: any[],
    col: string,
  ): string {
    let clause = '';
    if (opts.startDate) {
      params.push(opts.startDate);
      clause += ` AND ${col} >= $${params.length}`;
    }
    if (opts.endDate) {
      params.push(opts.endDate);
      clause += ` AND ${col} <= $${params.length}`;
    }
    return clause;
  }

  private num(v: any): number {
    return v === null || v === undefined ? 0 : Number(v);
  }

  async getBusinessSummary(opts: {
    businessId: string;
    startDate?: string;
    endDate?: string;
  }) {
    const params: any[] = [opts.businessId];
    const dateClause = this.dateParams(opts, params, 'o."createdAt"');

    const [row] = await this.dataSource.query<any[]>(
      `SELECT
         COUNT(*)::int                                                                             AS "total",
         COUNT(*) FILTER (WHERE o.status IN ('pending','invoiced'))::int                          AS "quotations",
         COUNT(*) FILTER (WHERE o.status NOT IN
           ('pending','invoiced','completed','cancelled','disputed'))::int                         AS "active",
         COUNT(*) FILTER (WHERE o.status = 'completed')::int                                      AS "completed",
         COUNT(*) FILTER (WHERE o.status = 'cancelled')::int                                      AS "cancelled",
         COUNT(*) FILTER (WHERE o.status = 'disputed')::int                                       AS "disputed",
         COALESCE(SUM(o."totalAmount") FILTER (WHERE o."paymentStatus" = 'held'),    0)::numeric  AS "inEscrow",
         COALESCE(SUM(o."totalAmount") FILTER (WHERE o."paymentStatus" = 'released'),0)::numeric  AS "totalCollected",
         COALESCE(SUM(o."platformCommission")
           FILTER (WHERE o."paymentStatus" IN ('held','released')),                  0)::numeric  AS "platformFeesPaid"
       FROM orders o
       WHERE o."businessId" = $1
         AND o."isDeleted" = false
         ${dateClause}`,
      params,
    );

    return {
      total: row.total,
      quotations: row.quotations,
      active: row.active,
      completed: row.completed,
      cancelled: row.cancelled,
      disputed: row.disputed,
      inEscrow: this.num(row.inEscrow),
      totalCollected: this.num(row.totalCollected),
      platformFeesPaid: this.num(row.platformFeesPaid),
    };
  }

  async getBusinessOrdersTrend(opts: {
    businessId: string;
    granularity: 'day' | 'week' | 'month';
    startDate?: string;
    endDate?: string;
  }) {
    const g = ['day', 'week', 'month'].includes(opts.granularity)
      ? opts.granularity
      : 'day';
    const params: any[] = [opts.businessId];
    const dateClause = this.dateParams(opts, params, 'o."createdAt"');

    return this.dataSource.query<any[]>(
      `SELECT
         DATE_TRUNC('${g}', o."createdAt")                                AS "period",
         COUNT(*)::int                                                     AS "total",
         COUNT(*) FILTER (WHERE o.status = 'completed')::int              AS "completed",
         COUNT(*) FILTER (WHERE o.status = 'cancelled')::int              AS "cancelled"
       FROM orders o
       WHERE o."businessId" = $1
         AND o."isDeleted" = false
         ${dateClause}
       GROUP BY 1
       ORDER BY 1 ASC`,
      params,
    );
  }

  async getBusinessOrdersBreakdown(opts: {
    businessId: string;
    startDate?: string;
    endDate?: string;
  }) {
    const params: any[] = [opts.businessId];
    const dateClause = this.dateParams(opts, params, 'o."createdAt"');

    const [statusRows, priorityRows] = await Promise.all([
      this.dataSource.query<any[]>(
        `SELECT o.status, COUNT(*)::int AS "count"
         FROM orders o
         WHERE o."businessId" = $1 AND o."isDeleted" = false ${dateClause}
         GROUP BY o.status`,
        params,
      ),
      this.dataSource.query<any[]>(
        `SELECT o."deliveryPriority" AS "priority", COUNT(*)::int AS "count"
         FROM orders o
         WHERE o."businessId" = $1 AND o."isDeleted" = false ${dateClause}
         GROUP BY o."deliveryPriority"`,
        params,
      ),
    ]);

    return { statusBreakdown: statusRows, priorityBreakdown: priorityRows };
  }

  async getBusinessRevenueBreakdown(opts: {
    businessId: string;
    startDate?: string;
    endDate?: string;
  }) {
    const params: any[] = [opts.businessId];
    const dateClause = this.dateParams(opts, params, 'o."createdAt"');

    const [row] = await this.dataSource.query<any[]>(
      `SELECT
         COALESCE(SUM(o."totalAmount")
           FILTER (WHERE o."paymentStatus" IN ('held','released')), 0)::numeric    AS "grossRevenue",
         COALESCE(SUM(o."totalAmount")
           FILTER (WHERE o."paymentStatus" = 'released'),          0)::numeric     AS "collected",
         COALESCE(SUM(o."totalAmount")
           FILTER (WHERE o."paymentStatus" = 'held'),              0)::numeric     AS "inEscrow",
         COALESCE(SUM(o."platformCommission")
           FILTER (WHERE o."paymentStatus" IN ('held','released')), 0)::numeric    AS "platformCommission",
         COALESCE(SUM(COALESCE((o."priceBreakdown"->>'nombaFee')::numeric, 0))
           FILTER (WHERE o."paymentStatus" IN ('held','released')), 0)::numeric    AS "nombaFees",
         COALESCE(SUM(
           o."totalAmount"
           - o."platformCommission"
           - COALESCE((o."priceBreakdown"->>'nombaFee')::numeric, 0)
         ) FILTER (WHERE o."paymentStatus" = 'released'),          0)::numeric     AS "netPayout"
       FROM orders o
       WHERE o."businessId" = $1
         AND o."isDeleted" = false
         ${dateClause}`,
      params,
    );

    return {
      grossRevenue: this.num(row.grossRevenue),
      collected: this.num(row.collected),
      inEscrow: this.num(row.inEscrow),
      platformCommission: this.num(row.platformCommission),
      nombaFees: this.num(row.nombaFees),
      netPayout: this.num(row.netPayout),
    };
  }

  async getBusinessRidersPerformance(opts: {
    businessId: string;
    startDate?: string;
    endDate?: string;
  }) {
    const params: any[] = [opts.businessId];
    const dateClause = this.dateParams(opts, params, 'o."createdAt"');

    return this.dataSource.query<any[]>(
      `SELECT
         r.id                                                                    AS "riderId",
         r."firstName",
         r."lastName",
         r."phoneNumber",
         r."profilePhoto",
         COUNT(o.id)::int                                                        AS "totalAssigned",
         COUNT(o.id) FILTER (WHERE o.status = 'completed')::int                 AS "completed",
         COUNT(o.id) FILTER (WHERE o.status = 'cancelled')::int                 AS "cancelled",
         ROUND(
           COUNT(o.id) FILTER (WHERE o.status = 'completed')::numeric /
           NULLIF(COUNT(o.id)::numeric, 0) * 100, 1
         )                                                                       AS "completionRatePct",
         COALESCE(ROUND(AVG(rv.rating)::numeric, 1), 0)                         AS "avgRating"
       FROM rider r
       LEFT JOIN orders o
         ON o."riderId" = r.id
         AND o."isDeleted" = false
         ${dateClause}
       LEFT JOIN reviews rv
         ON rv."targetId" = r.id
         AND rv."targetType" = 'RIDER'
       WHERE r."businessId" = $1
         AND r."isDeleted" = false
       GROUP BY r.id, r."firstName", r."lastName", r."phoneNumber", r."profilePhoto"
       ORDER BY "completed" DESC`,
      params,
    );
  }

  async getBusinessOrdersFulfillment(opts: {
    businessId: string;
    startDate?: string;
    endDate?: string;
  }) {
    const params: any[] = [opts.businessId];
    const dateClause = this.dateParams(opts, params, 'o."createdAt"');

    const [row] = await this.dataSource.query<any[]>(
      `SELECT
         COALESCE(ROUND(AVG(
           EXTRACT(EPOCH FROM (t."assignedAt" - o."paidAt")) / 60
         ) FILTER (WHERE t."assignedAt" IS NOT NULL AND o."paidAt" IS NOT NULL), 0), 0)::numeric
           AS "avgConfirmToAssignMins",
         COALESCE(ROUND(AVG(
           EXTRACT(EPOCH FROM (t."pickedUpAt" - t."assignedAt")) / 60
         ) FILTER (WHERE t."pickedUpAt" IS NOT NULL AND t."assignedAt" IS NOT NULL), 0), 0)::numeric
           AS "avgAssignToPickupMins",
         COALESCE(ROUND(AVG(
           EXTRACT(EPOCH FROM (t."completedAt" - t."pickedUpAt")) / 60
         ) FILTER (WHERE t."completedAt" IS NOT NULL AND t."pickedUpAt" IS NOT NULL), 0), 0)::numeric
           AS "avgPickupToCompleteMins",
         COALESCE(ROUND(AVG(
           EXTRACT(EPOCH FROM (t."completedAt" - o."paidAt")) / 60
         ) FILTER (WHERE t."completedAt" IS NOT NULL AND o."paidAt" IS NOT NULL), 0), 0)::numeric
           AS "avgTotalDeliveryMins"
       FROM orders o
       JOIN order_tracking t ON t."orderId" = o.id
       WHERE o."businessId" = $1
         AND o.status = 'completed'
         AND o."isDeleted" = false
         ${dateClause}`,
      params,
    );

    return {
      avgConfirmToAssignMins: this.num(row.avgConfirmToAssignMins),
      avgAssignToPickupMins: this.num(row.avgAssignToPickupMins),
      avgPickupToCompleteMins: this.num(row.avgPickupToCompleteMins),
      avgTotalDeliveryMins: this.num(row.avgTotalDeliveryMins),
    };
  }

  async getBusinessRidersSummary(opts: {
    businessId: string;
    startDate?: string;
    endDate?: string;
  }) {
    const params: any[] = [opts.businessId];
    const dateClause = this.dateParams(opts, params, 'r."createdAt"');

    const [row] = await this.dataSource.query<any[]>(
      `SELECT
         COUNT(*)::int                                                                         AS "total",
         COUNT(*) FILTER (WHERE r."availabilityStatus" = 'available')::int                    AS "available",
         COUNT(*) FILTER (WHERE r."availabilityStatus" = 'offline')::int                      AS "offline",
         COUNT(*) FILTER (WHERE r."availabilityStatus" = 'on_trip')::int                      AS "onTrip",                        
         COUNT(*) FILTER (WHERE r.status = 'active')::int                                     AS "verified"
       FROM rider r
       WHERE r."businessId" = $1
         AND r."isDeleted" = false
         ${dateClause}`,
      params,
    );

    return {
      total: row.total,
      available: row.available,
      offline: row.offline,
      onTrip: row.onTrip,
      verified: row.verified,
    };
  }

  async getRiderSummary(opts: {
    riderId: string;
    startDate?: string;
    endDate?: string;
  }) {
    const params: any[] = [opts.riderId];
    const dateClause = this.dateParams(opts, params, 'o."createdAt"');

    const [[orderRow], [ratingRow]] = await Promise.all([
      this.dataSource.query<any[]>(
        `SELECT
           COUNT(*)::int                                              AS "totalAssigned",
           COUNT(*) FILTER (WHERE o.status = 'completed')::int       AS "completed",
           COUNT(*) FILTER (WHERE o.status = 'cancelled')::int       AS "cancelled"
         FROM orders o
         WHERE o."riderId" = $1
           AND o."isDeleted" = false
           ${dateClause}`,
        params,
      ),
      this.dataSource.query<any[]>(
        `SELECT COALESCE(ROUND(AVG(rating)::numeric, 1), 0) AS "avgRating"
         FROM reviews
         WHERE "targetId" = $1 AND "targetType" = 'RIDER'`,
        [opts.riderId],
      ),
    ]);

    return {
      totalAssigned: orderRow.totalAssigned,
      completed: orderRow.completed,
      cancelled: orderRow.cancelled,
      avgRating: this.num(ratingRow.avgRating),
    };
  }

  async getRiderOrdersTrend(opts: {
    riderId: string;
    granularity: 'day' | 'week' | 'month';
    startDate?: string;
    endDate?: string;
  }) {
    const g = ['day', 'week', 'month'].includes(opts.granularity)
      ? opts.granularity
      : 'day';
    const params: any[] = [opts.riderId];
    const dateClause = this.dateParams(opts, params, 'o."createdAt"');

    return this.dataSource.query<any[]>(
      `SELECT
         DATE_TRUNC('${g}', o."createdAt")                                AS "period",
         COUNT(*)::int                                                     AS "total",
         COUNT(*) FILTER (WHERE o.status = 'completed')::int              AS "completed"
       FROM orders o
       WHERE o."riderId" = $1
         AND o."isDeleted" = false
         ${dateClause}
       GROUP BY 1
       ORDER BY 1 ASC`,
      params,
    );
  }

  async getRiderPerformance(opts: {
    riderId: string;
    startDate?: string;
    endDate?: string;
  }) {
    const params: any[] = [opts.riderId];
    const dateClause = this.dateParams(opts, params, 'o."createdAt"');

    const [[perfRow], [ratingRow]] = await Promise.all([
      this.dataSource.query<any[]>(
        `SELECT
           COUNT(o.id)::int                                                       AS "totalAssigned",
           COUNT(o.id) FILTER (WHERE o.status = 'completed')::int                AS "completed",
           COUNT(o.id) FILTER (WHERE o.status = 'cancelled')::int                AS "cancelled",
           COALESCE(ROUND(
             COUNT(o.id) FILTER (WHERE o.status = 'completed')::numeric /
             NULLIF(COUNT(o.id)::numeric, 0) * 100, 1
           ), 0)                                                                  AS "completionRatePct",
           COALESCE(ROUND(AVG(
             EXTRACT(EPOCH FROM (t."completedAt" - t."assignedAt")) / 60
           ) FILTER (WHERE t."completedAt" IS NOT NULL AND t."assignedAt" IS NOT NULL), 0), 0)::numeric
                                                                                  AS "avgDeliveryMins"
         FROM orders o
         LEFT JOIN order_tracking t ON t."orderId" = o.id
         WHERE o."riderId" = $1
           AND o."isDeleted" = false
           ${dateClause}`,
        params,
      ),
      this.dataSource.query<any[]>(
        `SELECT COALESCE(ROUND(AVG(rating)::numeric, 1), 0) AS "avgRating"
         FROM reviews
         WHERE "targetId" = $1 AND "targetType" = 'RIDER'`,
        [opts.riderId],
      ),
    ]);

    return {
      totalAssigned: perfRow.totalAssigned,
      completed: perfRow.completed,
      cancelled: perfRow.cancelled,
      completionRatePct: this.num(perfRow.completionRatePct),
      avgDeliveryMins: this.num(perfRow.avgDeliveryMins),
      avgRating: this.num(ratingRow.avgRating),
    };
  }

  async getRiderEarningsSummary(opts: {
    riderId: string;
    startDate?: string;
    endDate?: string;
  }) {
    const params: any[] = [opts.riderId, 'RIDER'];
    const dateClause = this.dateParams(opts, params, 'j."createdAt"');

    const [[row], [walletRow]] = await Promise.all([
      this.dataSource.query<any[]>(
        `SELECT
           COALESCE(SUM(e.amount)
             FILTER (WHERE e.direction = 'credit'
               AND j.type = 'business_to_rider_payout'
               AND j.status = 'posted'),              0)::numeric  AS "totalEarned",
           COALESCE(SUM(e.amount)
             FILTER (WHERE e.direction = 'debit'
               AND j.type = 'rider_withdrawal'
               AND j.status = 'posted'),              0)::numeric  AS "totalWithdrawn",
           COUNT(DISTINCT j.id)
             FILTER (WHERE j.type = 'business_to_rider_payout'
               AND j.status = 'posted')::int                       AS "payoutCount"
         FROM wallet w
         JOIN ledger_entry e ON e."walletId" = w.id
         JOIN ledger_journal j ON j.id = e."journalId"
         WHERE w."ownerId" = $1
           AND w."ownerType" = $2
           ${dateClause}`,
        params,
      ),
      this.dataSource.query<any[]>(
        `SELECT COALESCE(balance, 0)::numeric AS "currentBalance"
         FROM wallet
         WHERE "ownerId" = $1 AND "ownerType" = $2`,
        [opts.riderId, 'RIDER'],
      ),
    ]);

    const totalEarned = this.num(row.totalEarned);
    const totalWithdrawn = this.num(row.totalWithdrawn);

    return {
      currentBalance: this.num(walletRow?.currentBalance),
      totalEarned,
      totalWithdrawn,
      pendingPayout: totalEarned - totalWithdrawn,
      payoutCount: row.payoutCount,
    };
  }

  async getRiderEarningsTrend(opts: {
    riderId: string;
    granularity: 'day' | 'week' | 'month';
    startDate?: string;
    endDate?: string;
  }) {
    const g = ['day', 'week', 'month'].includes(opts.granularity)
      ? opts.granularity
      : 'day';
    const params: any[] = [opts.riderId, 'RIDER'];
    const dateClause = this.dateParams(opts, params, 'j."createdAt"');

    return this.dataSource.query<any[]>(
      `SELECT
         DATE_TRUNC('${g}', j."createdAt")           AS "period",
         COALESCE(SUM(e.amount), 0)::numeric          AS "earned",
         COUNT(DISTINCT j.id)::int                    AS "payouts"
       FROM wallet w
       JOIN ledger_entry e ON e."walletId" = w.id
       JOIN ledger_journal j ON j.id = e."journalId"
       WHERE w."ownerId" = $1
         AND w."ownerType" = $2
         AND e.direction = 'credit'
         AND j.type = 'business_to_rider_payout'
         AND j.status = 'posted'
         ${dateClause}
       GROUP BY 1
       ORDER BY 1 ASC`,
      params,
    );
  }
}
