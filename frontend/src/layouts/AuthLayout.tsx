import { Outlet } from 'react-router-dom';

export function AuthLayout() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-100 px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-6 flex flex-col items-center gap-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-900 text-sm font-bold text-white">EC</div>
          <h1 className="text-lg font-semibold text-slate-900">Expense Claims</h1>
          <p className="text-sm text-slate-500">Sign in to continue</p>
        </div>
        <Outlet />
      </div>
    </div>
  );
}
