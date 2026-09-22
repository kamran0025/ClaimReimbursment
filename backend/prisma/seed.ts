// Seeds the same demo identities the frontend's mock `services/api/db.ts`
// already uses (task-backend.md §2) — same emails, same password
// ("password123") — so both sides demo consistently once the frontend is
// swapped from mock to real. Idempotent: safe to re-run against a fresh or
// already-seeded dev database (upserts users, wipes+recreates claim data).
import { PrismaClient, Role, ClaimStatus, ClaimMessageType, AuditAction } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

const DEMO_PASSWORD = 'password123';

function daysAgo(n: number, hour = 10, minute = 0): Date {
  const d = new Date();
  d.setDate(d.getDate() - n);
  d.setHours(hour, minute, 0, 0);
  return d;
}

async function main() {
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);

  const seedUsers = [
    { id: 'u_finance1', name: 'Neha Kulkarni', email: 'finance@example.com', role: Role.FINANCE },
    { id: 'u_approver1', name: 'Arjun Mehta', email: 'approver1@example.com', role: Role.APPROVER },
    { id: 'u_approver2', name: 'Kavita Rao', email: 'approver2@example.com', role: Role.APPROVER },
    { id: 'u_approver3', name: 'Sanjay Iyer', email: 'approver3@example.com', role: Role.APPROVER },
    { id: 'u_employee1', name: 'Rahul Sharma', email: 'employee1@example.com', role: Role.CLAIMANT },
    { id: 'u_employee2', name: 'Ananya Gupta', email: 'employee2@example.com', role: Role.CLAIMANT },
    { id: 'u_employee3', name: 'Vikram Singh', email: 'employee3@example.com', role: Role.CLAIMANT },
  ];

  for (const u of seedUsers) {
    await prisma.user.upsert({
      where: { id: u.id },
      update: { name: u.name, email: u.email, role: u.role, passwordHash, isActive: true },
      create: { ...u, passwordHash, isActive: true, createdAt: daysAgo(200), updatedAt: daysAgo(200) },
    });
  }

  // Wipe claim data only (users are upserted, never deleted) so this script is re-runnable.
  await prisma.auditLog.deleteMany();
  await prisma.claimMessage.deleteMany();
  await prisma.receipt.deleteMany();
  await prisma.claimItem.deleteMany();
  await prisma.claim.deleteMany();

  // ---------------------------------------------------------------------
  // c_draft_1 — employee1, untouched draft.
  // ---------------------------------------------------------------------
  {
    const claim = await prisma.claim.create({
      data: {
        id: 'c_draft_1',
        claimantId: 'u_employee1',
        title: 'Client site visit — Pune',
        status: ClaimStatus.DRAFT,
        submissionCycle: 1,
        createdAt: daysAgo(2),
        updatedAt: daysAgo(2),
      },
    });
    const items = await Promise.all([
      prisma.claimItem.create({
        data: { claimId: claim.id, expenseDate: daysAgo(3), category: 'Travel', description: 'Cab to client office', amount: 850, merchant: 'Ola', createdAt: daysAgo(2), updatedAt: daysAgo(2) },
      }),
      prisma.claimItem.create({
        data: { claimId: claim.id, expenseDate: daysAgo(3), category: 'Meals', description: 'Lunch with client', amount: 620, merchant: 'Barbeque Nation', createdAt: daysAgo(2), updatedAt: daysAgo(2) },
      }),
    ]);
    const total = items.reduce((s, i) => s + Number(i.amount), 0);
    await prisma.claim.update({ where: { id: claim.id }, data: { total } });
    await prisma.auditLog.create({
      data: { claimId: claim.id, actorId: 'u_employee1', action: AuditAction.CLAIM_CREATED, newStatus: ClaimStatus.DRAFT, metadata: { title: claim.title }, createdAt: daysAgo(2) },
    });
  }

  // ---------------------------------------------------------------------
  // c_pending_1 — employee2, awaiting approver1's decision.
  // ---------------------------------------------------------------------
  {
    const claim = await prisma.claim.create({
      data: {
        id: 'c_pending_1',
        claimantId: 'u_employee2',
        title: 'Annual conference — Bengaluru',
        status: ClaimStatus.PENDING_APPROVAL,
        assignedApproverId: 'u_approver1',
        submissionCycle: 1,
        submittedAt: daysAgo(1),
        createdAt: daysAgo(4),
        updatedAt: daysAgo(1),
      },
    });
    const items = await Promise.all([
      prisma.claimItem.create({ data: { claimId: claim.id, expenseDate: daysAgo(5), category: 'Accommodation', description: 'Hotel, 2 nights', amount: 6400, merchant: 'Taj Vivanta', createdAt: daysAgo(4), updatedAt: daysAgo(4) } }),
      prisma.claimItem.create({ data: { claimId: claim.id, expenseDate: daysAgo(4), category: 'Travel', description: 'Flight tickets', amount: 9800, merchant: 'IndiGo', createdAt: daysAgo(4), updatedAt: daysAgo(4) } }),
    ]);
    const total = items.reduce((s, i) => s + Number(i.amount), 0);
    await prisma.claim.update({ where: { id: claim.id }, data: { total } });
    await prisma.auditLog.create({ data: { claimId: claim.id, actorId: 'u_employee2', action: AuditAction.CLAIM_CREATED, newStatus: ClaimStatus.DRAFT, createdAt: daysAgo(4) } });
    await prisma.auditLog.create({
      data: { claimId: claim.id, actorId: 'u_employee2', action: AuditAction.CLAIM_SUBMITTED, oldStatus: ClaimStatus.DRAFT, newStatus: ClaimStatus.PENDING_APPROVAL, metadata: { total, submissionCycle: 1, assignedApproverId: 'u_approver1' }, createdAt: daysAgo(1) },
    });
  }

  // ---------------------------------------------------------------------
  // c_info_1 — employee1, approver2 asked a question mid-review.
  // ---------------------------------------------------------------------
  {
    const claim = await prisma.claim.create({
      data: {
        id: 'c_info_1',
        claimantId: 'u_employee1',
        title: 'Software subscription reimbursement',
        status: ClaimStatus.INFO_REQUESTED,
        assignedApproverId: 'u_approver2',
        submissionCycle: 1,
        submittedAt: daysAgo(3),
        createdAt: daysAgo(6),
        updatedAt: daysAgo(1),
      },
    });
    const item = await prisma.claimItem.create({
      data: { claimId: claim.id, expenseDate: daysAgo(7), category: 'Software', description: 'Annual IDE license', amount: 4200, merchant: 'JetBrains', createdAt: daysAgo(6), updatedAt: daysAgo(6) },
    });
    await prisma.claim.update({ where: { id: claim.id }, data: { total: item.amount } });
    await prisma.claimMessage.create({
      data: { claimId: claim.id, senderId: 'u_approver2', type: ClaimMessageType.INFO_REQUEST, message: 'Could you attach the original invoice with GST breakup?', createdAt: daysAgo(1) },
    });
    await prisma.auditLog.create({ data: { claimId: claim.id, actorId: 'u_employee1', action: AuditAction.CLAIM_CREATED, newStatus: ClaimStatus.DRAFT, createdAt: daysAgo(6) } });
    await prisma.auditLog.create({ data: { claimId: claim.id, actorId: 'u_employee1', action: AuditAction.CLAIM_SUBMITTED, oldStatus: ClaimStatus.DRAFT, newStatus: ClaimStatus.PENDING_APPROVAL, createdAt: daysAgo(3) } });
    await prisma.auditLog.create({
      data: { claimId: claim.id, actorId: 'u_approver2', action: AuditAction.CLAIM_INFO_REQUESTED, oldStatus: ClaimStatus.PENDING_APPROVAL, newStatus: ClaimStatus.INFO_REQUESTED, metadata: { message: 'Could you attach the original invoice with GST breakup?' }, createdAt: daysAgo(1) },
    });
  }

  // ---------------------------------------------------------------------
  // c_rejected_1 — employee3, rejected by approver1; still editable by owner.
  // ---------------------------------------------------------------------
  {
    const claim = await prisma.claim.create({
      data: {
        id: 'c_rejected_1',
        claimantId: 'u_employee3',
        title: 'Client dinner reimbursement',
        status: ClaimStatus.REJECTED,
        assignedApproverId: 'u_approver1',
        decidedById: 'u_approver1',
        decidedAt: daysAgo(2),
        rejectionReason: 'Please split personal and client guests across separate line items.',
        rejectedById: 'u_approver1',
        rejectedAt: daysAgo(2),
        submissionCycle: 1,
        submittedAt: daysAgo(4),
        createdAt: daysAgo(6),
        updatedAt: daysAgo(2),
      },
    });
    const item = await prisma.claimItem.create({
      data: { claimId: claim.id, expenseDate: daysAgo(5), category: 'Meals', description: 'Dinner with client + guests', amount: 5400, merchant: 'The Table', createdAt: daysAgo(6), updatedAt: daysAgo(6) },
    });
    await prisma.claim.update({ where: { id: claim.id }, data: { total: item.amount } });
    await prisma.auditLog.create({ data: { claimId: claim.id, actorId: 'u_employee3', action: AuditAction.CLAIM_CREATED, newStatus: ClaimStatus.DRAFT, createdAt: daysAgo(6) } });
    await prisma.auditLog.create({ data: { claimId: claim.id, actorId: 'u_employee3', action: AuditAction.CLAIM_SUBMITTED, oldStatus: ClaimStatus.DRAFT, newStatus: ClaimStatus.PENDING_APPROVAL, createdAt: daysAgo(4) } });
    await prisma.auditLog.create({
      data: { claimId: claim.id, actorId: 'u_approver1', action: AuditAction.CLAIM_REJECTED, oldStatus: ClaimStatus.PENDING_APPROVAL, newStatus: ClaimStatus.REJECTED, metadata: { reason: claim.rejectionReason }, createdAt: daysAgo(2) },
    });
  }

  // ---------------------------------------------------------------------
  // c_approved_1 — employee2, approved by Finance directly (blanket authority).
  // ---------------------------------------------------------------------
  {
    const claim = await prisma.claim.create({
      data: {
        id: 'c_approved_1',
        claimantId: 'u_employee2',
        title: 'Office supplies — Q3',
        status: ClaimStatus.APPROVED,
        assignedApproverId: 'u_approver3',
        decidedById: 'u_finance1',
        decidedAt: daysAgo(1),
        submissionCycle: 1,
        submittedAt: daysAgo(3),
        createdAt: daysAgo(5),
        updatedAt: daysAgo(1),
      },
    });
    const item = await prisma.claimItem.create({
      data: { claimId: claim.id, expenseDate: daysAgo(4), category: 'Office Supplies', description: 'Notebooks, pens, whiteboard markers', amount: 1250, merchant: 'Staples', createdAt: daysAgo(5), updatedAt: daysAgo(5) },
    });
    await prisma.claim.update({ where: { id: claim.id }, data: { total: item.amount } });
    await prisma.auditLog.create({ data: { claimId: claim.id, actorId: 'u_employee2', action: AuditAction.CLAIM_CREATED, newStatus: ClaimStatus.DRAFT, createdAt: daysAgo(5) } });
    await prisma.auditLog.create({ data: { claimId: claim.id, actorId: 'u_employee2', action: AuditAction.CLAIM_SUBMITTED, oldStatus: ClaimStatus.DRAFT, newStatus: ClaimStatus.PENDING_APPROVAL, createdAt: daysAgo(3) } });
    await prisma.auditLog.create({
      data: { claimId: claim.id, actorId: 'u_finance1', action: AuditAction.CLAIM_APPROVED, oldStatus: ClaimStatus.PENDING_APPROVAL, newStatus: ClaimStatus.APPROVED, createdAt: daysAgo(1) },
    });
  }

  // ---------------------------------------------------------------------
  // c_cancelled_1 — employee1, cancelled while still a draft.
  // ---------------------------------------------------------------------
  {
    const claim = await prisma.claim.create({
      data: {
        id: 'c_cancelled_1',
        claimantId: 'u_employee1',
        title: 'Duplicate travel claim',
        status: ClaimStatus.CANCELLED,
        submissionCycle: 1,
        createdAt: daysAgo(10),
        updatedAt: daysAgo(9),
      },
    });
    await prisma.auditLog.create({ data: { claimId: claim.id, actorId: 'u_employee1', action: AuditAction.CLAIM_CREATED, newStatus: ClaimStatus.DRAFT, createdAt: daysAgo(10) } });
    await prisma.auditLog.create({
      data: { claimId: claim.id, actorId: 'u_employee1', action: AuditAction.CLAIM_CANCELLED, oldStatus: ClaimStatus.DRAFT, newStatus: ClaimStatus.CANCELLED, createdAt: daysAgo(9) },
    });
  }

  // ---------------------------------------------------------------------
  // c_resubmitted_1 — employee3, rejected once then resubmitted to a
  // different approver; demonstrates submissionCycle=2 with prior history kept.
  // ---------------------------------------------------------------------
  {
    const claim = await prisma.claim.create({
      data: {
        id: 'c_resubmitted_1',
        claimantId: 'u_employee3',
        title: 'Team offsite — Goa',
        status: ClaimStatus.PENDING_APPROVAL,
        assignedApproverId: 'u_approver2',
        submissionCycle: 2,
        submittedAt: daysAgo(1),
        createdAt: daysAgo(12),
        updatedAt: daysAgo(1),
      },
    });
    const item = await prisma.claimItem.create({
      data: { claimId: claim.id, expenseDate: daysAgo(13), category: 'Travel', description: 'Team offsite travel + stay', amount: 18500, merchant: 'MakeMyTrip', createdAt: daysAgo(12), updatedAt: daysAgo(8) },
    });
    await prisma.claim.update({ where: { id: claim.id }, data: { total: item.amount } });
    await prisma.auditLog.create({ data: { claimId: claim.id, actorId: 'u_employee3', action: AuditAction.CLAIM_CREATED, newStatus: ClaimStatus.DRAFT, createdAt: daysAgo(12) } });
    await prisma.auditLog.create({ data: { claimId: claim.id, actorId: 'u_employee3', action: AuditAction.CLAIM_SUBMITTED, oldStatus: ClaimStatus.DRAFT, newStatus: ClaimStatus.PENDING_APPROVAL, metadata: { submissionCycle: 1, assignedApproverId: 'u_approver1' }, createdAt: daysAgo(10) } });
    await prisma.auditLog.create({ data: { claimId: claim.id, actorId: 'u_approver1', action: AuditAction.CLAIM_REJECTED, oldStatus: ClaimStatus.PENDING_APPROVAL, newStatus: ClaimStatus.REJECTED, metadata: { reason: 'Need itemized hotel invoice, not a lump sum.' }, createdAt: daysAgo(8) } });
    await prisma.auditLog.create({ data: { claimId: claim.id, actorId: 'u_employee3', action: AuditAction.CLAIM_RESUBMITTED, oldStatus: ClaimStatus.REJECTED, newStatus: ClaimStatus.PENDING_APPROVAL, metadata: { submissionCycle: 2, assignedApproverId: 'u_approver2' }, createdAt: daysAgo(1) } });
  }

  // eslint-disable-next-line no-console
  console.log('Seed complete: 7 users, 7 claims across every status.');
}

main()
  .catch((e) => {
    // eslint-disable-next-line no-console
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
