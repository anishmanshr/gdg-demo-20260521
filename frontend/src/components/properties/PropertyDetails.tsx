import type { Property } from '../../types';

export default function PropertyDetails({ property }: { property: Property }) {
  return (
    <div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        {property.images.length > 0 ? (
          property.images.map((img) => (
            <img key={img.id} src={img.image_url} alt={property.title} className="w-full h-64 object-cover rounded" />
          ))
        ) : (
          <div className="h-64 bg-gray-200 rounded flex items-center justify-center text-gray-400 text-5xl col-span-2">
            &#127968;
          </div>
        )}
      </div>

      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{property.title}</h1>
          <p className="text-gray-600 mt-1">{property.location}</p>
        </div>
        <div className="text-right">
          {property.average_rating && (
            <p className="text-yellow-600 text-lg">&#9733; {property.average_rating}</p>
          )}
          <p className="text-2xl font-bold text-indigo-600">${property.price_per_night}<span className="text-sm text-gray-500">/night</span></p>
        </div>
      </div>

      <div className="mt-6 grid grid-cols-3 gap-4 text-sm text-gray-700">
        <div><span className="font-semibold">{property.max_guests}</span> guests</div>
        <div><span className="font-semibold">{property.bedrooms}</span> bedrooms</div>
        <div><span className="font-semibold">{property.bathrooms}</span> bathrooms</div>
      </div>

      <div className="mt-6">
        <h2 className="text-lg font-semibold mb-2">Description</h2>
        <p className="text-gray-700">{property.description || 'No description provided.'}</p>
      </div>

      {property.amenities.length > 0 && (
        <div className="mt-6">
          <h2 className="text-lg font-semibold mb-2">Amenities</h2>
          <div className="flex flex-wrap gap-2">
            {property.amenities.map((a) => (
              <span key={a.id} className="bg-gray-100 px-3 py-1 rounded-full text-sm text-gray-700">
                {a.name}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
