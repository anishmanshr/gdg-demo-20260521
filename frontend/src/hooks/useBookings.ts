import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getMyBookings, createBooking, cancelBooking } from '../api/bookings';
import type { Booking, BookingCreate } from '../types';

export function useBookings() {
  return useQuery<Booking[]>({
    queryKey: ['bookings'],
    queryFn: getMyBookings,
  });
}

export function useCreateBooking() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: BookingCreate) => createBooking(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bookings'] });
      queryClient.invalidateQueries({ queryKey: ['properties'] });
    },
  });
}

export function useCancelBooking() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => cancelBooking(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bookings'] });
    },
  });
}
