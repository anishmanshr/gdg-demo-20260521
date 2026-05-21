import { useState } from 'react';

interface SearchBarProps {
  onSearch: (filters: Record<string, string>) => void;
}

export default function SearchBar({ onSearch }: SearchBarProps) {
  const [location, setLocation] = useState('');
  const [checkIn, setCheckIn] = useState('');
  const [checkOut, setCheckOut] = useState('');
  const [guests, setGuests] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const filters: Record<string, string> = {};
    if (location) filters.location = location;
    if (checkIn) filters.check_in = checkIn;
    if (checkOut) filters.check_out = checkOut;
    if (guests) filters.guests = guests;
    onSearch(filters);
  };

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow p-4 flex flex-wrap gap-3 items-end">
      <div className="flex-1 min-w-[150px]">
        <label className="block text-xs text-gray-500 mb-1">Location</label>
        <input
          type="text"
          value={location}
          onChange={(e) => setLocation(e.target.value)}
          placeholder="Anywhere"
          className="w-full border rounded px-3 py-2 text-sm"
        />
      </div>
      <div className="min-w-[130px]">
        <label className="block text-xs text-gray-500 mb-1">Check-in</label>
        <input
          type="date"
          value={checkIn}
          onChange={(e) => setCheckIn(e.target.value)}
          className="w-full border rounded px-3 py-2 text-sm"
        />
      </div>
      <div className="min-w-[130px]">
        <label className="block text-xs text-gray-500 mb-1">Check-out</label>
        <input
          type="date"
          value={checkOut}
          onChange={(e) => setCheckOut(e.target.value)}
          className="w-full border rounded px-3 py-2 text-sm"
        />
      </div>
      <div className="min-w-[100px]">
        <label className="block text-xs text-gray-500 mb-1">Guests</label>
        <input
          type="number"
          value={guests}
          onChange={(e) => setGuests(e.target.value)}
          placeholder="1"
          min={1}
          className="w-full border rounded px-3 py-2 text-sm"
        />
      </div>
      <button
        type="submit"
        className="bg-indigo-600 text-white px-6 py-2 rounded hover:bg-indigo-700 text-sm"
      >
        Search
      </button>
    </form>
  );
}
