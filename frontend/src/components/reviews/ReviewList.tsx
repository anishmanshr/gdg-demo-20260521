import { useQuery } from '@tanstack/react-query';
import { getPropertyReviews } from '../../api/reviews';

export default function ReviewList({ propertyId }: { propertyId: number }) {
  const { data: reviews, isLoading } = useQuery({
    queryKey: ['reviews', propertyId],
    queryFn: () => getPropertyReviews(propertyId),
  });

  if (isLoading) return <p className="text-sm text-gray-500">Loading reviews...</p>;
  if (!reviews?.length) return <p className="text-sm text-gray-500">No reviews yet.</p>;

  return (
    <div className="space-y-4">
      {reviews.map((review) => (
        <div key={review.id} className="border-b pb-3">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-sm">{review.user_name || `User #${review.user_id}`}</span>
            <span className="text-yellow-600 text-sm">{'★'.repeat(review.rating)}{'☆'.repeat(5 - review.rating)}</span>
          </div>
          {review.comment && <p className="text-sm text-gray-600 mt-1">{review.comment}</p>}
          <p className="text-xs text-gray-400 mt-1">{new Date(review.created_at).toLocaleDateString()}</p>
        </div>
      ))}
    </div>
  );
}
