import { useState } from 'react';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { ClaimStatus, CLAIM_STATUS_LABELS } from '@/types/enums';

export interface ClaimFilterValues {
  status?: ClaimStatus | '';
  search?: string;
  dateFrom?: string;
  dateTo?: string;
  amountMin?: string;
  amountMax?: string;
  claimantId?: string;
  assignedApproverId?: string;
}

interface ClaimFilterBarProps {
  values: ClaimFilterValues;
  onChange: (values: ClaimFilterValues) => void;
  claimantOptions?: { id: string; name: string }[];
  approverOptions?: { id: string; name: string }[];
  showSearch?: boolean;
  showStatus?: boolean;
  showDateRange?: boolean;
  showAmountRange?: boolean;
  searchPlaceholder?: string;
  /** Options for the "View By Status" dropdown. Defaults to every ClaimStatus. */
  statusOptions?: { value: string; label: string }[];
  /** Whether the dropdown includes a blank "all statuses" option. Set false when a status must always be selected. */
  allowAllStatus?: boolean;
  /** Label for the blank "all statuses" option, when allowAllStatus is true. */
  allStatusLabel?: string;
}

const ALL_STATUS_OPTIONS = Object.values(ClaimStatus).map((s) => ({ value: s, label: CLAIM_STATUS_LABELS[s] }));

const searchIcon = (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 20 20"
    fill="currentColor"
    className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
    aria-hidden="true"
  >
    <path
      fillRule="evenodd"
      d="M9 3.5a5.5 5.5 0 100 11 5.5 5.5 0 000-11zM2 9a7 7 0 1112.452 4.391l3.328 3.329a.75.75 0 11-1.06 1.06l-3.329-3.328A7 7 0 012 9z"
      clipRule="evenodd"
    />
  </svg>
);

const filterIcon = (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
    <path d="M2.628 1.601C5.028 1.206 7.49 1 10 1s4.973.206 7.372.601a.75.75 0 01.628.74v2.288a2.25 2.25 0 01-.659 1.59l-4.682 4.683a2.25 2.25 0 00-.659 1.59v3.037c0 .684-.31 1.33-.844 1.757l-1.937 1.55A.75.75 0 018 18.25v-5.757a2.25 2.25 0 00-.659-1.591L2.66 6.22A2.25 2.25 0 012 4.629V2.34a.75.75 0 01.628-.74z" />
  </svg>
);

/** Reusable filter toolbar shared across claim list screens: a "View By Status" dropdown, a search box, and a "Filter By" modal for the rest. */
export function ClaimFilterBar({
  values,
  onChange,
  claimantOptions,
  approverOptions,
  showSearch = true,
  showStatus = true,
  showDateRange = true,
  showAmountRange = true,
  searchPlaceholder = 'Search title…',
  statusOptions = ALL_STATUS_OPTIONS,
  allowAllStatus = true,
  allStatusLabel = 'All Status',
}: ClaimFilterBarProps) {
  const [isFilterOpen, setFilterOpen] = useState(false);
  const set = (patch: Partial<ClaimFilterValues>) => onChange({ ...values, ...patch });

  const showAdvanced = showDateRange || showAmountRange || Boolean(claimantOptions) || Boolean(approverOptions);
  const hasAdvancedFilters = Boolean(
    values.dateFrom || values.dateTo || values.amountMin || values.amountMax || values.claimantId || values.assignedApproverId,
  );

  return (
    <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      {showStatus && (
        <div className="flex items-center gap-2">
          <span className="whitespace-nowrap text-sm font-medium text-slate-600">View By Status:</span>
          <Select
            placeholder={allowAllStatus ? allStatusLabel : undefined}
            value={values.status ?? ''}
            onChange={(e) => set({ status: e.target.value as ClaimStatus })}
            className="rounded-full"
          >
            {statusOptions.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </Select>
        </div>
      )}

      <div className="flex flex-1 items-center gap-3 sm:justify-end">
        {showSearch && (
          <div className="relative w-full sm:w-64">
            {searchIcon}
            <Input
              placeholder={searchPlaceholder}
              value={values.search ?? ''}
              onChange={(e) => set({ search: e.target.value })}
              className="rounded-full pl-9"
            />
          </div>
        )}
        {showAdvanced && (
          <Button type="button" variant="outline" className="relative shrink-0 rounded-full" onClick={() => setFilterOpen(true)}>
            {filterIcon}
            Filter By
            {hasAdvancedFilters && (
              <span className="absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full bg-slate-900" aria-hidden="true" />
            )}
          </Button>
        )}
      </div>

      {showAdvanced && (
        <Modal
          isOpen={isFilterOpen}
          onClose={() => setFilterOpen(false)}
          title="Filter By"
          size="sm"
          footer={
            <>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => onChange({ status: values.status, search: values.search })}
              >
                Clear filters
              </Button>
              <Button type="button" size="sm" onClick={() => setFilterOpen(false)}>
                Apply
              </Button>
            </>
          }
        >
          <div className="flex flex-col gap-3">
            {claimantOptions && (
              <Select
                label="Claimant"
                placeholder="All claimants"
                value={values.claimantId ?? ''}
                onChange={(e) => set({ claimantId: e.target.value })}
              >
                {claimantOptions.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </Select>
            )}
            {approverOptions && (
              <Select
                label="Assigned Approver"
                placeholder="All approvers"
                value={values.assignedApproverId ?? ''}
                onChange={(e) => set({ assignedApproverId: e.target.value })}
              >
                {approverOptions.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </Select>
            )}
            {showDateRange && (
              <div className="grid grid-cols-2 gap-3">
                <Input type="date" label="From date" value={values.dateFrom ?? ''} onChange={(e) => set({ dateFrom: e.target.value })} />
                <Input type="date" label="To date" value={values.dateTo ?? ''} onChange={(e) => set({ dateTo: e.target.value })} />
              </div>
            )}
            {showAmountRange && (
              <div className="grid grid-cols-2 gap-3">
                <Input
                  type="number"
                  label="Min amount"
                  placeholder="Min amount"
                  value={values.amountMin ?? ''}
                  onChange={(e) => set({ amountMin: e.target.value })}
                />
                <Input
                  type="number"
                  label="Max amount"
                  placeholder="Max amount"
                  value={values.amountMax ?? ''}
                  onChange={(e) => set({ amountMax: e.target.value })}
                />
              </div>
            )}
          </div>
        </Modal>
      )}
    </div>
  );
}
