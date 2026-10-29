import { describe, expect, it } from 'vitest';
import { ClaimStatus, Role } from '@prisma/client';
import {
  assertCancellable,
  assertDecidable,
  assertEditable,
  assertRespondable,
  assertSubmittable,
  isCancellable,
  isEditableStatus,
  isAtFinanceStage,
  isInReview,
  requiresFinanceApproval,
} from '../../src/services/claimStateMachine';
import { ApiError, ErrorCode } from '../../src/services/errors';

describe('claimStateMachine', () => {
  it('DRAFT, REJECTED and PENDING_APPROVAL are the only editable statuses', () => {
    for (const s of [ClaimStatus.DRAFT, ClaimStatus.REJECTED, ClaimStatus.PENDING_APPROVAL]) {
      expect(isEditableStatus(s)).toBe(true);
    }
    for (const s of [ClaimStatus.PENDING_FINANCE_APPROVAL, ClaimStatus.INFO_REQUESTED, ClaimStatus.APPROVED, ClaimStatus.CANCELLED]) {
      expect(isEditableStatus(s)).toBe(false);
    }
  });

  it('assertEditable throws CLAIM_NOT_EDITABLE once the approver has acted', () => {
    for (const status of [ClaimStatus.PENDING_FINANCE_APPROVAL, ClaimStatus.INFO_REQUESTED, ClaimStatus.APPROVED]) {
      expect(() => assertEditable({ status })).toThrow(ApiError);
      try {
        assertEditable({ status });
      } catch (e) {
        expect((e as ApiError).code).toBe(ErrorCode.CLAIM_NOT_EDITABLE);
      }
    }
    expect(() => assertEditable({ status: ClaimStatus.PENDING_APPROVAL })).not.toThrow();
  });

  it('a claim is cancellable in DRAFT, or PENDING_APPROVAL before a decision', () => {
    expect(isCancellable({ status: ClaimStatus.DRAFT, decidedById: null })).toBe(true);
    expect(isCancellable({ status: ClaimStatus.PENDING_APPROVAL, decidedById: null })).toBe(true);
    expect(isCancellable({ status: ClaimStatus.PENDING_APPROVAL, decidedById: 'someone' })).toBe(false);
    expect(isCancellable({ status: ClaimStatus.APPROVED, decidedById: 'someone' })).toBe(false);
  });

  it('assertCancellable throws once a decision is underway', () => {
    expect(() => assertCancellable({ status: ClaimStatus.PENDING_APPROVAL, decidedById: 'x' })).toThrow(ApiError);
  });

  it('only DRAFT or REJECTED claims are submittable', () => {
    expect(() => assertSubmittable({ status: ClaimStatus.DRAFT })).not.toThrow();
    expect(() => assertSubmittable({ status: ClaimStatus.REJECTED })).not.toThrow();
    expect(() => assertSubmittable({ status: ClaimStatus.PENDING_APPROVAL })).toThrow(ApiError);
  });

  it('PENDING_APPROVAL, PENDING_FINANCE_APPROVAL and INFO_REQUESTED all count as "in review"', () => {
    expect(isInReview(ClaimStatus.PENDING_APPROVAL)).toBe(true);
    expect(isInReview(ClaimStatus.PENDING_FINANCE_APPROVAL)).toBe(true);
    expect(isInReview(ClaimStatus.INFO_REQUESTED)).toBe(true);
    expect(isInReview(ClaimStatus.APPROVED)).toBe(false);
  });

  describe('assertDecidable', () => {
    const claim = { status: ClaimStatus.PENDING_APPROVAL, assignedApproverId: 'approver-1', approverApprovedById: null };

    it('allows the assigned approver', () => {
      expect(() => assertDecidable(claim, { id: 'approver-1', role: Role.APPROVER })).not.toThrow();
    });

    it('allows any Finance user regardless of assignment', () => {
      expect(() => assertDecidable(claim, { id: 'finance-1', role: Role.FINANCE })).not.toThrow();
    });

    it('rejects a different approver (CLAIM_NOT_ASSIGNED)', () => {
      expect(() => assertDecidable(claim, { id: 'approver-2', role: Role.APPROVER })).toThrow(ApiError);
      try {
        assertDecidable(claim, { id: 'approver-2', role: Role.APPROVER });
      } catch (e) {
        expect((e as ApiError).code).toBe(ErrorCode.CLAIM_NOT_ASSIGNED);
      }
    });

    it('rejects when the claim is not in review', () => {
      expect(() =>
        assertDecidable(
          { status: ClaimStatus.APPROVED, assignedApproverId: 'approver-1', approverApprovedById: null },
          { id: 'approver-1', role: Role.APPROVER },
        ),
      ).toThrow(ApiError);
    });

    it('once escalated, only Finance may decide — the assigned approver gets FINANCE_APPROVAL_REQUIRED', () => {
      const escalated = { status: ClaimStatus.PENDING_FINANCE_APPROVAL, assignedApproverId: 'approver-1', approverApprovedById: 'approver-1' };
      expect(() => assertDecidable(escalated, { id: 'finance-1', role: Role.FINANCE })).not.toThrow();
      try {
        assertDecidable(escalated, { id: 'approver-1', role: Role.APPROVER });
        expect.unreachable();
      } catch (e) {
        expect((e as ApiError).code).toBe(ErrorCode.FINANCE_APPROVAL_REQUIRED);
      }
    });
  });

  describe('approval hierarchy', () => {
    it('requires Finance approval only strictly above the threshold', () => {
      expect(requiresFinanceApproval(25000, 25000)).toBe(false);
      expect(requiresFinanceApproval(25000.01, 25000)).toBe(true);
      expect(requiresFinanceApproval(500, 25000)).toBe(false);
    });

    it('an info request raised at the Finance stage stays at the Finance stage', () => {
      expect(isAtFinanceStage({ status: ClaimStatus.PENDING_FINANCE_APPROVAL, approverApprovedById: 'a' })).toBe(true);
      expect(isAtFinanceStage({ status: ClaimStatus.INFO_REQUESTED, approverApprovedById: 'a' })).toBe(true);
      expect(isAtFinanceStage({ status: ClaimStatus.INFO_REQUESTED, approverApprovedById: null })).toBe(false);
      expect(isAtFinanceStage({ status: ClaimStatus.PENDING_APPROVAL, approverApprovedById: null })).toBe(false);
    });
  });

  describe('assertRespondable', () => {
    const claim = { status: ClaimStatus.INFO_REQUESTED, claimantId: 'claimant-1' };

    it('allows the owning claimant while in review', () => {
      expect(() => assertRespondable(claim, { id: 'claimant-1' })).not.toThrow();
    });

    it('rejects a different claimant', () => {
      expect(() => assertRespondable(claim, { id: 'claimant-2' })).toThrow(ApiError);
    });

    it('rejects once the claim has left review', () => {
      expect(() => assertRespondable({ status: ClaimStatus.APPROVED, claimantId: 'claimant-1' }, { id: 'claimant-1' })).toThrow(ApiError);
    });
  });
});
