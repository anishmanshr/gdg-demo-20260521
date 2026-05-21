import client from './client';
import type { Property, PropertyListItem, PropertyCreate, PropertyUpdate, PaginatedResponse } from '../types';

export async function getProperties(params?: Record<string, string>): Promise<PaginatedResponse<PropertyListItem>> {
  const res = await client.get('/properties', { params });
  return res.data;
}

export async function getProperty(id: number): Promise<Property> {
  const res = await client.get(`/properties/${id}`);
  return res.data;
}

export async function createProperty(data: PropertyCreate): Promise<Property> {
  const res = await client.post('/properties', data);
  return res.data;
}

export async function updateProperty(id: number, data: PropertyUpdate): Promise<Property> {
  const res = await client.put(`/properties/${id}`, data);
  return res.data;
}

export async function deleteProperty(id: number): Promise<void> {
  await client.delete(`/properties/${id}`);
}
