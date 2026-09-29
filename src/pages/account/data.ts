import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import type { Assessment, InstallerRequest, Order, Payment, SavedApplianceSet } from '@/lib/types';
import { useAuth } from '@/providers/AuthProvider';

function useMine<T>(key: string, table: string, select = '*') {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['mine', key, user?.id],
    enabled: Boolean(user),
    queryFn: async () => {
      const { data, error } = await supabase.from(table).select(select).eq('user_id', user!.id).order('created_at', { ascending: false });
      if (error) throw error;
      return data as unknown as T[];
    },
  });
}

export const useMyAssessments = () => useMine<Assessment>('assessments', 'assessments');
export const useMyOrders = () => useMine<Order>('orders', 'orders', '*, order_items(*)');
export const useMyPayments = () => useMine<Payment>('payments', 'payments');
export const useMyRequests = () => useMine<InstallerRequest>('requests', 'installer_requests');
export const useMySets = () => useMine<SavedApplianceSet>('sets', 'saved_appliance_sets');
