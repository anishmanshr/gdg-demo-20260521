import { useBookings, useCancelBooking } from '../hooks/useBookings';
import DashboardLayout from '../components/layout/DashboardLayout';

export default function UserDashboard() {
  const { data: bookings, isLoading } = useBookings();
  const cancelMutation = useCancelBooking();

  return (
    <DashboardLayout title="My Bookings">
      {isLoading ? (
        <p className="text-gray-500">Loading...</p>
      ) : !bookings?.length ? (
        <p className="text-gray-500">No bookings yet.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left">
                <th className="pb-2">Property</th>
                <th className="pb-2">Check-in</th>
                <th className="pb-2">Check-out</th>
                <th className="pb-2">Guests</th>
                <th className="pb-2">Total</th>
                <th className="pb-2">Status</th>
                <th className="pb-2">Action</th>
              </tr>
            </thead>
            <tbody>
              {bookings.map((b) => (
                <tr key={b.id} className="border-b">
                  <td className="py-2">{b.property_title || `#${b.property_id}`}</td>
                  <td className="py-2">{new Date(b.check_in).toLocaleDateString()}</td>
                  <td className="py-2">{new Date(b.check_out).toLocaleDateString()}</td>
                  <td className="py-2">{b.guests}</td>
                  <td className="py-2">${b.total_price}</td>
                  <td className="py-2">
                    <span className={`px-2 py-0.5 rounded text-xs ${
                      b.status === 'confirmed' ? 'bg-green-100 text-green-800' :
                      b.status === 'cancelled' ? 'bg-red-100 text-red-800' :
                      'bg-gray-100 text-gray-800'
                    }`}>{b.status}</span>
                  </td>
                  <td className="py-2">
                    {(b.status === 'confirmed' || b.status === 'pending') && (
                      <button
                        onClick={() => cancelMutation.mutate(b.id)}
                        className="text-red-600 hover:underline text-xs"
                        disabled={cancelMutation.isPending}
                      >
                        Cancel
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </DashboardLayout>
  );
}
