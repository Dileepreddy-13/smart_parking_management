import { useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import toast from 'react-hot-toast';
import { useAuth } from '../contexts/AuthContext';
import { connectSocket, disconnectSocket } from '../services/socket';
import type { AppNotification } from '../types';

/**
 * Keeps server data fresh without polling: socket events simply invalidate the
 * matching React Query caches, so every open screen refetches what it shows.
 */
export function useRealtime() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const userId = user?.id;

  useEffect(() => {
    const socket = connectSocket();

    socket.on('slots:changed', ({ areaId }: { areaId: string }) => {
      void queryClient.invalidateQueries({ queryKey: ['areas'] });
      void queryClient.invalidateQueries({ queryKey: ['area', areaId] });
      void queryClient.invalidateQueries({ queryKey: ['slots', areaId] });
      void queryClient.invalidateQueries({ queryKey: ['admin'] });
    });
    socket.on('notification:new', (n: AppNotification) => {
      void queryClient.invalidateQueries({ queryKey: ['notifications'] });
      void queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      void queryClient.invalidateQueries({ queryKey: ['reservations'] });
      // The checkout screen already announces a successful payment itself.
      if (n.type !== 'PAYMENT_SUCCESS') toast(n.title, { icon: '🔔', id: n.id });
    });
    socket.on('admin:activity', () => void queryClient.invalidateQueries({ queryKey: ['admin'] }));

    return () => disconnectSocket();
  }, [queryClient, userId]);
}
