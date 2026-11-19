export interface PlanLikeUser {
  role?: string;
  email?: string;
  plan?: string;
  unlimited?: boolean;
  planEndDate?: string | null;
}

/**
 * Formats an ISO date string into exact `x date y month z year` format (e.g. `19 November 2026`).
 */
export function formatExpiryDate(dateValue?: string | Date | null): string {
  if (!dateValue) return 'No Ending Date';
  const date = dateValue instanceof Date ? dateValue : new Date(dateValue);
  if (Number.isNaN(date.getTime())) return 'No Ending Date';
  return date.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

/**
 * Returns true if the user has a lifetime/unlimited plan with NO ending date.
 */
export function isPlanLifetime(userData?: PlanLikeUser | null): boolean {
  if (!userData) return false;
  if (userData.plan === 'lifetime') return true;
  return Boolean(userData.unlimited && !userData.planEndDate);
}

/**
 * Returns true when a user's timed subscription has expired (never true for admin or lifetime plans).
 */
export function isUserPlanExpired(userData?: PlanLikeUser | null): boolean {
  if (!userData) return false;
  if (userData.role === 'admin') return false;
  if (isPlanLifetime(userData)) return false;
  if (userData.plan === 'expired') return true;
  if (userData.planEndDate) {
    const endTime = new Date(userData.planEndDate).getTime();
    return !Number.isNaN(endTime) && endTime <= Date.now();
  }
  return false;
}

/**
 * Returns true when the user has an active Unlimited subscription (either 1-month active or Lifetime no ending date).
 */
export function isUserUnlimitedActive(userData?: PlanLikeUser | null): boolean {
  if (!userData) return false;
  if (isPlanLifetime(userData)) return true;
  if (!userData.unlimited) return false;
  if (!userData.planEndDate) return true;
  const endTime = new Date(userData.planEndDate).getTime();
  return !Number.isNaN(endTime) && endTime > Date.now();
}
