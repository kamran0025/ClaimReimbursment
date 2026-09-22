import type { ClaimFilterValues } from '@/components/common/ClaimFilterBar';
import type { ClaimFilters } from '@/services/api/claimsService';

/** Converts the string-based filter bar values into the typed filters the API expects. */
export function toClaimFilters(values: ClaimFilterValues): ClaimFilters {
  const filters: ClaimFilters = {};
  if (values.status) filters.status = values.status;
  if (values.search) filters.search = values.search;
  if (values.dateFrom) filters.dateFrom = values.dateFrom;
  if (values.dateTo) filters.dateTo = values.dateTo;
  if (values.claimantId) filters.claimantId = values.claimantId;
  if (values.assignedApproverId) filters.assignedApproverId = values.assignedApproverId;
  if (values.amountMin) filters.amountMin = Number(values.amountMin);
  if (values.amountMax) filters.amountMax = Number(values.amountMax);
  return filters;
}
