import client from './client';
import type { User } from '../types';

export async function getAdminUsers(): Promise<User[]> {
  const res = await client.get('/admin/users');
  return res.data;
}

export async function deactivateUser(id: number): Promise<void> {
  await client.patch(`/admin/users/${id}/deactivate`);
}

export async function activateUser(id: number): Promise<void> {
  await client.patch(`/admin/users/${id}/activate`);
}
