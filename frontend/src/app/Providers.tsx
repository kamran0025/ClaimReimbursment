import type { ReactNode } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router-dom';
import { queryClient } from './queryClient';
import { AuthProvider } from './AuthContext';
import { ToastProvider } from './ToastContext';

export function Providers({ children }: { children: ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <BrowserRouter>
          <AuthProvider>{children}</AuthProvider>
        </BrowserRouter>
      </ToastProvider>
    </QueryClientProvider>
  );
}
