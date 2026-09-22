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
  isInReview,
} from '../../src/services/claimStateMachine';
import { ApiError, ErrorCode } from '../../src/services/errors';

describe('claimStateMachine', () => {
  it('DRAFT and REJECTED are the only editable statuses', () => {
    expect(isEditableStatus(ClaimStatus.DRAFT)).toBe(true);
    expect(isEditableStatus(ClaimStatus.REJECTED)).toBe(true);
    for (const s of [ClaimStatus.PENDING_APPROVAL, ClaimStatus.INFO_REQUESTED, ClaimStatus.APPROVED, ClaimStatus.CANCELLED]) {
      expect(isEditableStatus(s)).toBe(false);
    }
  });

  it('assertEditable throws CLAIM_NOT_EDITABLE for a submitted claim', () => {
    expect(() => assertEditable({ status: ClaimStatus.PENDING_APPROVAL })).toThrow(ApiError);
    try {
      assertEditable({ status: ClaimStatus.PENDING_APPROVAL });
    } catch (e) {
      expect((e as ApiError).code).toBe(ErrorCode.CLAIM_NOT_EDITABLE);
    }
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

  it('PENDING_APPROVAL and INFO_REQUESTED both count as "in review"', () => {
    expect(isInReview(ClaimStatus.PENDING_APPROVAL)).toBe(true);
    expect(isInReview(ClaimStatus.INFO_REQUESTED)).toBe(true);
    expect(isInReview(ClaimStatus.APPROVED)).toBe(false);
  });

  describe('assertDecidable', () => {
    const claim = { status: ClaimStatus.PENDING_APPROVAL, assignedApproverId: 'approver-1' };

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
        assertDecidable({ status: ClaimStatus.APPROVED, assignedApproverId: 'approver-1' }, { id: 'approver-1', role: Role.APPROVER }),
      ).toThrow(ApiError);
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
