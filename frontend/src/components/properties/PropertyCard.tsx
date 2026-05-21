import { Link } from 'react-router-dom';
import type { PropertyListItem } from '../../types';

export default function PropertyCard({ property }: { property: PropertyListItem }) {
  return (
    <Link
      to={`/properties/${property.id}`}
      className="block bg-white rounded-lg shadow hover:shadow-lg transition-shadow overflow-hidden"
    >
      <div className="h-48 bg-gray-200 flex items-center justify-center">
        {property.first_image ? (
          <img src={property.first_image} alt={property.title} className="w-full h-full object-cover" />
        ) : (
          <span className="text-gray-400 text-4xl">&#127968;</span>
        )}
      </div>
      <div className="p-4">
        <div className="flex justify-between items-start">
          <h3 className="text-lg font-semibold text-gray-900 truncate">{property.title}</h3>
          {property.average_rating && (
            <span className="text-sm text-yellow-600 ml-2 whitespace-nowrap">
              &#9733; {property.average_rating}
            </span>
          )}
        </div>
        <p className="text-sm text-gray-500 mt-1">{property.location}</p>
        <p className="text-sm text-gray-600 mt-1">
          {property.bedrooms} bed &middot; {property.bathrooms} bath &middot; {property.max_guests} guests
        </p>
        <p className="mt-2 text-lg font-bold text-indigo-600">
          ${property.price_per_night} <span className="text-sm font-normal text-gray-500">/ night</span>
        </p>
      </div>
    </Link>
  );
}
