import client from './client';
import type { Booking, BookingCreate } from '../types';

export async function createBooking(data: BookingCreate): Promise<Booking> {
  const res = await client.post('/bookings', data);
  return res.data;
}

export async function getMyBookings(): Promise<Booking[]> {
  const res = await client.get('/bookings/me');
  return res.data;
}

export async function getHostBookings(): Promise<Booking[]> {
  const res = await client.get('/bookings/host');
  return res.data;
}

export async function cancelBooking(id: number): Promise<Booking> {
  const res = await client.patch(`/bookings/${id}/cancel`);
  return res.data;
}
