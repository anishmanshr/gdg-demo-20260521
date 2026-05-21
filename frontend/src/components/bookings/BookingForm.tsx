import { useState } from 'react';
import { useCreateBooking } from '../../hooks/useBookings';
import { useAuth } from '../../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';

interface BookingFormProps {
  propertyId: number;
  pricePerNight: number;
}

export default function BookingForm({ propertyId, pricePerNight }: BookingFormProps) {
  const [checkIn, setCheckIn] = useState('');
  const [checkOut, setCheckOut] = useState('');
  const [guests, setGuests] = useState('1');
  const [error, setError] = useState('');
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const createMutation = useCreateBooking();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!isAuthenticated) {
      navigate('/login');
      return;
    }
    if (!checkIn || !checkOut) {
      setError('Please select check-in and check-out dates');
      return;
    }
    try {
      await createMutation.mutateAsync({
        property_id: propertyId,
        check_in: new Date(checkIn).toISOString(),
        check_out: new Date(checkOut).toISOString(),
        guests: parseInt(guests),
      });
      setCheckIn('');
      setCheckOut('');
      setGuests('1');
      alert('Booking confirmed!');
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Booking failed');
    }
  };

  return (
    <form onSubmit={handleSubmit} className="bg-white border rounded-lg p-6 space-y-4">
      <h3 className="text-lg font-semibold">Book this property</h3>
      {error && <p className="text-red-600 text-sm">{error}</p>}
      <div>
        <label className="block text-sm text-gray-600 mb-1">Check-in</label>
        <input type="date" value={checkIn} onChange={(e) => setCheckIn(e.target.value)} className="w-full border rounded px-3 py-2" required />
      </div>
      <div>
        <label className="block text-sm text-gray-600 mb-1">Check-out</label>
        <input type="date" value={checkOut} onChange={(e) => setCheckOut(e.target.value)} className="w-full border rounded px-3 py-2" required />
      </div>
      <div>
        <label className="block text-sm text-gray-600 mb-1">Guests</label>
        <input type="number" value={guests} onChange={(e) => setGuests(e.target.value)} min="1" className="w-full border rounded px-3 py-2" />
      </div>
      <button
        type="submit"
        disabled={createMutation.isPending}
        className="w-full bg-indigo-600 text-white py-2 rounded hover:bg-indigo-700 disabled:opacity-50"
      >
        {createMutation.isPending ? 'Booking...' : `Book - $${pricePerNight}/night`}
      </button>
    </form>
  );
}
