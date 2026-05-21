import { useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import SearchBar from '../components/properties/SearchBar';
import PropertyCard from '../components/properties/PropertyCard';
import { useProperties } from '../hooks/useProperties';

export default function PropertyListingPage() {
  const [searchParams, setSearchParams] = useSearchParams();

  const filters = useMemo(() => {
    const f: Record<string, string> = {};
    searchParams.forEach((value, key) => { f[key] = value; });
    return f;
  }, [searchParams]);

  const { data, isLoading } = useProperties(filters);

  const handleSearch = (f: Record<string, string>) => {
    const params = new URLSearchParams(f);
    setSearchParams(params);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <h1 className="text-3xl font-bold text-gray-900 mb-6">Browse Properties</h1>
      <div className="mb-8">
        <SearchBar onSearch={handleSearch} />
      </div>

      {isLoading ? (
        <p className="text-gray-500">Loading...</p>
      ) : (
        <>
          <p className="text-sm text-gray-500 mb-4">{data?.total || 0} properties found</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {data?.items.map((p) => (
              <PropertyCard key={p.id} property={p} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
