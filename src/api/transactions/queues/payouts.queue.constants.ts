export const PAYOUTS_QUEUE = 'payouts';

export const PROCESS_PAYOUT_JOB = 'process_payout';

export type ProcessPayoutJobData = {
  payoutId: string;
};
