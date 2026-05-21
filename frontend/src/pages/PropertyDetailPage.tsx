import { useParams } from 'react-router-dom';
import { useProperty } from '../hooks/useProperties';
import PropertyDetails from '../components/properties/PropertyDetails';
import BookingForm from '../components/bookings/BookingForm';
import ReviewList from '../components/reviews/ReviewList';

export default function PropertyDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { data: property, isLoading } = useProperty(Number(id));

  if (isLoading) return <div className="max-w-5xl mx-auto px-4 py-8"><p className="text-gray-500">Loading...</p></div>;
  if (!property) return <div className="max-w-5xl mx-auto px-4 py-8"><p className="text-red-600">Property not found</p></div>;

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2">
          <PropertyDetails property={property} />
          <div className="mt-8">
            <h2 className="text-xl font-semibold mb-4">Reviews</h2>
            <ReviewList propertyId={property.id} />
          </div>
        </div>
        <div className="lg:col-span-1">
          <div className="sticky top-24">
            <BookingForm propertyId={property.id} pricePerNight={property.price_per_night} />
          </div>
        </div>
      </div>
    </div>
  );
}
