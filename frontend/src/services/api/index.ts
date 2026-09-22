// -----------------------------------------------------------------------
// THE ONE BOUNDARY.
//
// Every data access in this app goes through the modules re-exported here.
// Today they are backed by an in-memory mock store (`./db.ts`) with
// artificial latency and full business-rule/authorization enforcement.
// When a real backend exists, only the *internals* of these files change
// (fetch calls instead of in-memory array operations); every function
// keeps the same name, parameters, return shape, and thrown-error shape,
// so nothing in `features/*`, `pages/*`, or `hooks/*` needs to change.
// -----------------------------------------------------------------------
export * as authApi from './authService';
export * as claimsApi from './claimsService';
export * as auditApi from './auditService';
export * as usersApi from './usersService';
export * as dashboardApi from './dashboardService';
export * as financeApi from './financeService';
export { ApiError, ErrorCode, toErrorBody } from './errors';
