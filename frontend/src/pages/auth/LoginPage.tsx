import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useLocation, useNavigate } from 'react-router-dom';
import { Card, CardBody } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { ErrorState } from '@/components/common/ErrorState';
import { Spinner } from '@/components/ui/Spinner';
import { useAuth } from '@/app/AuthContext';
import { useToast } from '@/app/ToastContext';
import { useSeededLogins } from '@/features/auth/hooks/useSeededLogins';
import { loginSchema } from '@/features/auth/schemas';
import type { LoginFormValues } from '@/features/auth/schemas';
import { roleHomePath } from '@/utils/roleHome';
import { authApi } from '@/services/api';
import { ROLE_LABEL } from '@/layouts/navConfig';

const { DEMO_PASSWORD } = authApi;

export function LoginPage() {
  const { login } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const { data: seededUsers, isLoading: loadingUsers } = useSeededLogins();
  const [loginError, setLoginError] = useState<unknown>(null);

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  });

  const onSubmit = async (values: LoginFormValues) => {
    setLoginError(null);
    try {
      const user = await login(values.email, values.password);
      toast.success('Welcome back', `Signed in as ${user.name}`);
      const from = (location.state as { from?: Location })?.from?.pathname;
      navigate(from || roleHomePath(user.role), { replace: true });
    } catch (err) {
      setLoginError(err);
    }
  };

  const pickUser = (email: string) => {
    setValue('email', email);
    setValue('password', DEMO_PASSWORD);
  };

  return (
    <Card>
      <CardBody>
        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4" noValidate>
          <Input label="Email" type="email" autoComplete="username" error={errors.email?.message} {...register('email')} />
          <Input
            label="Password"
            type="password"
            autoComplete="current-password"
            error={errors.password?.message}
            {...register('password')}
          />
          {loginError ? <ErrorState error={loginError} /> : null}
          <Button type="submit" isLoading={isSubmitting} className="w-full">
            Sign in
          </Button>
        </form>

        <div className="mt-6 border-t border-slate-100 pt-4">
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-400">
            Or pick a seeded demo user (password: {DEMO_PASSWORD})
          </p>
          {loadingUsers ? (
            <div className="flex justify-center py-4">
              <Spinner />
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
              {seededUsers?.map((u) => (
                <button
                  key={u.id}
                  type="button"
                  onClick={() => pickUser(u.email)}
                  className="rounded-md border border-slate-200 px-2.5 py-1.5 text-left text-xs hover:border-slate-400 hover:bg-slate-50"
                >
                  <span className="block font-medium text-slate-800">{u.name}</span>
                  <span className="block text-slate-400">
                    {u.email} · {ROLE_LABEL[u.role]}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      </CardBody>
    </Card>
  );
}
