/**
 * React hooks for API data fetching
 * Uses React Query with the Python API client
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import apiClient from './api-client';

// Generic query hook
export function useApiQuery<T>(
  key: string[],
  path: string,
  params?: Record<string, string | number | boolean | undefined>,
  options?: { enabled?: boolean }
) {
  return useQuery({
    queryKey: key,
    queryFn: async () => {
      const { data, error } = await apiClient.get<T>(path, params);
      if (error) throw error;
      return data;
    },
    enabled: options?.enabled ?? true,
  });
}

// Generic mutation hooks
export function useApiMutation<TData, TVariables>(
  mutationFn: (variables: TVariables) => Promise<{ data: TData | null; error: Error | null }>,
  options?: {
    onSuccess?: (data: TData | null) => void;
    invalidateKeys?: string[][];
  }
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (variables: TVariables) => {
      const { data, error } = await mutationFn(variables);
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      options?.onSuccess?.(data);
      options?.invalidateKeys?.forEach((key) => {
        queryClient.invalidateQueries({ queryKey: key });
      });
    },
  });
}

// Buses
export function useBuses(status?: string) {
  return useApiQuery<any[]>(['buses', status || 'all'], '/buses', status ? { status } : undefined);
}

export function useBus(id: string) {
  return useApiQuery<any>(['bus', id], `/buses/${id}`, undefined, { enabled: !!id });
}

export function useCreateBus() {
  return useApiMutation(
    (data: any) => apiClient.post('/buses', data),
    { invalidateKeys: [['buses']] }
  );
}

export function useUpdateBus() {
  return useApiMutation(
    ({ id, ...data }: any) => apiClient.put(`/buses/${id}`, data),
    { invalidateKeys: [['buses']] }
  );
}

export function useDeleteBus() {
  return useApiMutation(
    (id: string) => apiClient.delete(`/buses/${id}`),
    { invalidateKeys: [['buses']] }
  );
}

// Routes
export function useRoutes() {
  return useApiQuery<any[]>(['routes'], '/routes');
}

export function useRoute(id: string) {
  return useApiQuery<any>(['route', id], `/routes/${id}`, undefined, { enabled: !!id });
}

export function useCreateRoute() {
  return useApiMutation(
    (data: any) => apiClient.post('/routes', data),
    { invalidateKeys: [['routes']] }
  );
}

export function useUpdateRoute() {
  return useApiMutation(
    ({ id, ...data }: any) => apiClient.put(`/routes/${id}`, data),
    { invalidateKeys: [['routes']] }
  );
}

export function useDeleteRoute() {
  return useApiMutation(
    (id: string) => apiClient.delete(`/routes/${id}`),
    { invalidateKeys: [['routes']] }
  );
}

// Trips
export function useTrips(params?: {
  status?: string;
  driver_id?: string;
  bus_id?: string;
  from_date?: string;
  to_date?: string;
  limit?: number;
  offset?: number;
}) {
  return useApiQuery<any[]>(['trips', JSON.stringify(params)], '/trips', params as any);
}

export function useTrip(id: string) {
  return useApiQuery<any>(['trip', id], `/trips/${id}`, undefined, { enabled: !!id });
}

export function useCreateTrip() {
  return useApiMutation(
    (data: any) => apiClient.post('/trips', data),
    { invalidateKeys: [['trips']] }
  );
}

export function useUpdateTrip() {
  return useApiMutation(
    ({ id, ...data }: any) => apiClient.put(`/trips/${id}`, data),
    { invalidateKeys: [['trips']] }
  );
}

export function useDeleteTrip() {
  return useApiMutation(
    (id: string) => apiClient.delete(`/trips/${id}`),
    { invalidateKeys: [['trips']] }
  );
}

// Expenses
export function useExpenses(params?: {
  trip_id?: string;
  status?: string;
  from_date?: string;
  to_date?: string;
  limit?: number;
  offset?: number;
}) {
  return useApiQuery<any[]>(['expenses', JSON.stringify(params)], '/expenses', params as any);
}

export function useExpenseCategories() {
  return useApiQuery<any[]>(['expense-categories'], '/expenses/categories');
}

export function useExpense(id: string) {
  return useApiQuery<any>(['expense', id], `/expenses/${id}`, undefined, { enabled: !!id });
}

export function useCreateExpense() {
  return useApiMutation(
    (data: any) => apiClient.post('/expenses', data),
    { invalidateKeys: [['expenses']] }
  );
}

export function useUpdateExpense() {
  return useApiMutation(
    ({ id, ...data }: any) => apiClient.put(`/expenses/${id}`, data),
    { invalidateKeys: [['expenses']] }
  );
}

export function useDeleteExpense() {
  return useApiMutation(
    (id: string) => apiClient.delete(`/expenses/${id}`),
    { invalidateKeys: [['expenses']] }
  );
}

// Drivers
export function useDrivers() {
  return useApiQuery<any[]>(['drivers'], '/drivers');
}

export function useDriver(id: string) {
  return useApiQuery<any>(['driver', id], `/drivers/${id}`, undefined, { enabled: !!id });
}

export function useCreateDriver() {
  return useApiMutation(
    (data: any) => apiClient.post('/drivers', data),
    { invalidateKeys: [['drivers']] }
  );
}

export function useUpdateDriver() {
  return useApiMutation(
    ({ id, ...data }: any) => apiClient.put(`/drivers/${id}`, data),
    { invalidateKeys: [['drivers']] }
  );
}

export function useDeleteDriver() {
  return useApiMutation(
    (id: string) => apiClient.delete(`/drivers/${id}`),
    { invalidateKeys: [['drivers']] }
  );
}

// Schedules
export function useSchedules(params?: { bus_id?: string; is_active?: boolean }) {
  return useApiQuery<any[]>(['schedules', JSON.stringify(params)], '/schedules', params as any);
}

export function useSchedule(id: string) {
  return useApiQuery<any>(['schedule', id], `/schedules/${id}`, undefined, { enabled: !!id });
}

export function useCreateSchedule() {
  return useApiMutation(
    (data: any) => apiClient.post('/schedules', data),
    { invalidateKeys: [['schedules']] }
  );
}

export function useUpdateSchedule() {
  return useApiMutation(
    ({ id, ...data }: any) => apiClient.put(`/schedules/${id}`, data),
    { invalidateKeys: [['schedules']] }
  );
}

export function useDeleteSchedule() {
  return useApiMutation(
    (id: string) => apiClient.delete(`/schedules/${id}`),
    { invalidateKeys: [['schedules']] }
  );
}

// Stock
export function useStockItems() {
  return useApiQuery<any[]>(['stock-items'], '/stock');
}

export function useStockItem(id: string) {
  return useApiQuery<any>(['stock-item', id], `/stock/${id}`, undefined, { enabled: !!id });
}

export function useStockTransactions(stockItemId?: string) {
  return useApiQuery<any[]>(
    ['stock-transactions', stockItemId || 'all'],
    '/stock/transactions',
    stockItemId ? { stock_item_id: stockItemId } : undefined
  );
}

export function useCreateStockItem() {
  return useApiMutation(
    (data: any) => apiClient.post('/stock', data),
    { invalidateKeys: [['stock-items']] }
  );
}

export function useUpdateStockItem() {
  return useApiMutation(
    ({ id, ...data }: any) => apiClient.put(`/stock/${id}`, data),
    { invalidateKeys: [['stock-items']] }
  );
}

export function useAdjustStock() {
  return useApiMutation(
    ({ id, ...data }: any) => apiClient.post(`/stock/${id}/adjust`, data),
    { invalidateKeys: [['stock-items'], ['stock-transactions']] }
  );
}

export function useDeleteStockItem() {
  return useApiMutation(
    (id: string) => apiClient.delete(`/stock/${id}`),
    { invalidateKeys: [['stock-items']] }
  );
}

// Invoices
export function useInvoices(params?: {
  status?: string;
  direction?: string;
  from_date?: string;
  to_date?: string;
  limit?: number;
  offset?: number;
}) {
  return useApiQuery<any[]>(['invoices', JSON.stringify(params)], '/invoices', params as any);
}

export function useInvoice(id: string) {
  return useApiQuery<any>(['invoice', id], `/invoices/${id}`, undefined, { enabled: !!id });
}

export function useCreateInvoice() {
  return useApiMutation(
    (data: any) => apiClient.post('/invoices', data),
    { invalidateKeys: [['invoices']] }
  );
}

export function useUpdateInvoice() {
  return useApiMutation(
    ({ id, ...data }: any) => apiClient.put(`/invoices/${id}`, data),
    { invalidateKeys: [['invoices']] }
  );
}

export function useAddPayment() {
  return useApiMutation(
    ({ invoiceId, ...data }: any) => apiClient.post(`/invoices/${invoiceId}/payments`, data),
    { invalidateKeys: [['invoices']] }
  );
}

export function useDeleteInvoice() {
  return useApiMutation(
    (id: string) => apiClient.delete(`/invoices/${id}`),
    { invalidateKeys: [['invoices']] }
  );
}

// Repairs
export function useRepairs(params?: {
  organization_id?: string;
  status?: string;
  from_date?: string;
  to_date?: string;
  limit?: number;
  offset?: number;
}) {
  return useApiQuery<any[]>(['repairs', JSON.stringify(params)], '/repairs', params as any);
}

export function useRepairOrganizations() {
  return useApiQuery<any[]>(['repair-organizations'], '/repairs/organizations');
}

export function useRepair(id: string) {
  return useApiQuery<any>(['repair', id], `/repairs/${id}`, undefined, { enabled: !!id });
}

export function useCreateRepair() {
  return useApiMutation(
    (data: any) => apiClient.post('/repairs', data),
    { invalidateKeys: [['repairs']] }
  );
}

export function useUpdateRepair() {
  return useApiMutation(
    ({ id, ...data }: any) => apiClient.put(`/repairs/${id}`, data),
    { invalidateKeys: [['repairs']] }
  );
}

export function useDeleteRepair() {
  return useApiMutation(
    (id: string) => apiClient.delete(`/repairs/${id}`),
    { invalidateKeys: [['repairs']] }
  );
}

// Settings
export function useSettings() {
  return useApiQuery<any[]>(['settings'], '/settings');
}

export function useSetting(key: string) {
  return useApiQuery<any>(['setting', key], `/settings/${key}`, undefined, { enabled: !!key });
}

export function useUpdateSetting() {
  return useApiMutation(
    ({ key, ...data }: any) => apiClient.put(`/settings/${key}`, data),
    { invalidateKeys: [['settings']] }
  );
}

// Indian States
export function useIndianStates() {
  return useApiQuery<any[]>(['indian-states'], '/states');
}

// Notifications
export function useNotifications(unreadOnly?: boolean) {
  return useApiQuery<any[]>(
    ['notifications', unreadOnly ? 'unread' : 'all'],
    '/notifications',
    unreadOnly ? { unread_only: unreadOnly } : undefined
  );
}

export function useMarkNotificationRead() {
  return useApiMutation(
    (id: string) => apiClient.put(`/notifications/${id}/read`, {}),
    { invalidateKeys: [['notifications']] }
  );
}

export function useMarkAllNotificationsRead() {
  return useApiMutation(
    () => apiClient.put('/notifications/read-all', {}),
    { invalidateKeys: [['notifications']] }
  );
}

export function useDeleteNotification() {
  return useApiMutation(
    (id: string) => apiClient.delete(`/notifications/${id}`),
    { invalidateKeys: [['notifications']] }
  );
}
