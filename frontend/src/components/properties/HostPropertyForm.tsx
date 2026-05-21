import { useState } from 'react';
import type { PropertyCreate, PropertyUpdate, Property } from '../../types';

interface HostPropertyFormProps {
  initialData?: Property | null;
  onSubmit: (data: PropertyCreate | PropertyUpdate) => void;
  onCancel: () => void;
}

export default function HostPropertyForm({ initialData, onSubmit, onCancel }: HostPropertyFormProps) {
  const [title, setTitle] = useState(initialData?.title || '');
  const [description, setDescription] = useState(initialData?.description || '');
  const [location, setLocation] = useState(initialData?.location || '');
  const [pricePerNight, setPricePerNight] = useState(initialData?.price_per_night?.toString() || '');
  const [maxGuests, setMaxGuests] = useState(initialData?.max_guests?.toString() || '');
  const [bedrooms, setBedrooms] = useState(initialData?.bedrooms?.toString() || '');
  const [bathrooms, setBathrooms] = useState(initialData?.bathrooms?.toString() || '');
  const [propertyType, setPropertyType] = useState(initialData?.property_type || 'apartment');
  const [images, setImages] = useState(initialData?.images?.map((i) => i.image_url).join('\n') || '');
  const [error, setError] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!title || !location || !pricePerNight || !maxGuests) {
      setError('Title, location, price, and max guests are required');
      return;
    }
    const imageList = images.split('\n').filter(Boolean);
    onSubmit({
      title,
      description,
      location,
      price_per_night: parseFloat(pricePerNight),
      max_guests: parseInt(maxGuests),
      bedrooms: parseInt(bedrooms) || 0,
      bathrooms: parseInt(bathrooms) || 0,
      property_type: propertyType,
      images: imageList,
      amenities: [],
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 max-w-lg">
      {error && <p className="text-red-600 text-sm">{error}</p>}
      <div>
        <label className="block text-sm text-gray-600 mb-1">Title *</label>
        <input value={title} onChange={(e) => setTitle(e.target.value)} className="w-full border rounded px-3 py-2" required />
      </div>
      <div>
        <label className="block text-sm text-gray-600 mb-1">Description</label>
        <textarea value={description} onChange={(e) => setDescription(e.target.value)} className="w-full border rounded px-3 py-2" rows={3} />
      </div>
      <div>
        <label className="block text-sm text-gray-600 mb-1">Location *</label>
        <input value={location} onChange={(e) => setLocation(e.target.value)} className="w-full border rounded px-3 py-2" required />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm text-gray-600 mb-1">Price/Night *</label>
          <input type="number" value={pricePerNight} onChange={(e) => setPricePerNight(e.target.value)} className="w-full border rounded px-3 py-2" min="0" required />
        </div>
        <div>
          <label className="block text-sm text-gray-600 mb-1">Max Guests *</label>
          <input type="number" value={maxGuests} onChange={(e) => setMaxGuests(e.target.value)} className="w-full border rounded px-3 py-2" min="1" required />
        </div>
        <div>
          <label className="block text-sm text-gray-600 mb-1">Bedrooms</label>
          <input type="number" value={bedrooms} onChange={(e) => setBedrooms(e.target.value)} className="w-full border rounded px-3 py-2" min="0" />
        </div>
        <div>
          <label className="block text-sm text-gray-600 mb-1">Bathrooms</label>
          <input type="number" value={bathrooms} onChange={(e) => setBathrooms(e.target.value)} className="w-full border rounded px-3 py-2" min="0" />
        </div>
      </div>
      <div>
        <label className="block text-sm text-gray-600 mb-1">Property Type</label>
        <select value={propertyType} onChange={(e) => setPropertyType(e.target.value)} className="w-full border rounded px-3 py-2">
          <option value="apartment">Apartment</option>
          <option value="house">House</option>
          <option value="villa">Villa</option>
          <option value="cabin">Cabin</option>
          <option value="condo">Condo</option>
        </select>
      </div>
      <div>
        <label className="block text-sm text-gray-600 mb-1">Image URLs (one per line)</label>
        <textarea value={images} onChange={(e) => setImages(e.target.value)} className="w-full border rounded px-3 py-2" rows={3} />
      </div>
      <div className="flex gap-3">
        <button type="submit" className="bg-indigo-600 text-white px-4 py-2 rounded hover:bg-indigo-700">
          {initialData ? 'Update' : 'Create'} Listing
        </button>
        <button type="button" onClick={onCancel} className="bg-gray-200 px-4 py-2 rounded hover:bg-gray-300">
          Cancel
        </button>
      </div>
    </form>
  );
}
