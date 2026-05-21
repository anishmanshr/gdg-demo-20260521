import { useQuery } from '@tanstack/react-query';
import { getProperties, getProperty } from '../api/properties';
import type { Property, PropertyListItem, PaginatedResponse } from '../types';

export function useProperties(params?: Record<string, string>) {
  return useQuery<PaginatedResponse<PropertyListItem>>({
    queryKey: ['properties', params],
    queryFn: () => getProperties(params),
  });
}

export function useProperty(id: number) {
  return useQuery<Property>({
    queryKey: ['property', id],
    queryFn: () => getProperty(id),
    enabled: !!id,
  });
}
