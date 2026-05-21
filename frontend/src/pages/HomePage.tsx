import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import SearchBar from '../components/properties/SearchBar';
import PropertyCard from '../components/properties/PropertyCard';
import { useProperties } from '../hooks/useProperties';

export default function HomePage() {
  const [filters] = useState<Record<string, string>>({});
  const { data, isLoading } = useProperties(filters);
  const navigate = useNavigate();

  const handleSearch = (f: Record<string, string>) => {
    const params = new URLSearchParams(f).toString();
    navigate(`/properties${params ? `?${params}` : ''}`);
  };

  return (
    <div>
      <div className="bg-indigo-700 text-white py-16 px-4">
        <div className="max-w-3xl mx-auto text-center">
          <h1 className="text-4xl font-bold mb-4">Find your perfect stay</h1>
          <p className="text-lg text-indigo-200 mb-8">Discover unique rentals for your next adventure</p>
          <div className="max-w-2xl mx-auto">
            <SearchBar onSearch={handleSearch} />
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <h2 className="text-2xl font-bold text-gray-900 mb-6">Featured listings</h2>
        {isLoading ? (
          <p className="text-gray-500">Loading properties...</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {data?.items.slice(0, 6).map((p) => (
              <PropertyCard key={p.id} property={p} />
            ))}
          </div>
        )}
        {data?.items.length === 0 && (
          <p className="text-gray-500">No properties available yet.</p>
        )}
      </div>
    </div>
  );
}
