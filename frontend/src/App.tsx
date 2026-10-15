import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState } from 'react';
import { Toaster } from 'react-hot-toast';
import { BrowserRouter } from 'react-router-dom';
import { ApiError } from './api/client';
import { AuthProvider } from './contexts/AuthContext';
import { useRealtime } from './hooks/useRealtime';
import { AppRoutes } from './routes/AppRoutes';

function Realtime() {
  useRealtime();
  return null;
}

export function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 15_000,
        refetchOnWindowFocus: false,
        // Retry network blips once; never retry a request the server has already rejected.
        retry: (failures, error) => failures < 1 && !(error instanceof ApiError && error.status > 0),
      },
    },
  });
}

export default function App() {
  const [queryClient] = useState(createQueryClient);
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AuthProvider>
          <Realtime />
          <AppRoutes />
        </AuthProvider>
      </BrowserRouter>
      <Toaster position="top-center" toastOptions={{ duration: 4000, style: { borderRadius: 12, fontSize: 14, fontWeight: 500 } }} />
    </QueryClientProvider>
  );
}
