import client from './client';
import type { Review, ReviewCreate } from '../types';

export async function getPropertyReviews(propertyId: number): Promise<Review[]> {
  const res = await client.get(`/properties/${propertyId}/reviews`);
  return res.data;
}

export async function createReview(data: ReviewCreate): Promise<Review> {
  const res = await client.post('/reviews', data);
  return res.data;
}
