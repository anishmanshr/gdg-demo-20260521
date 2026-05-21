import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getProperties, createProperty, updateProperty, deleteProperty } from '../api/properties';
import { getHostBookings } from '../api/bookings';
import { useAuth } from '../contexts/AuthContext';
import DashboardLayout from '../components/layout/DashboardLayout';
import HostPropertyForm from '../components/properties/HostPropertyForm';
import type { Property, PropertyCreate, PropertyUpdate } from '../types';

export default function HostDashboard() {
  const { user } = useAuth();
  const [showForm, setShowForm] = useState(false);
  const [editingProperty, setEditingProperty] = useState<Property | null>(null);
  const queryClient = useQueryClient();

  const { data: listings } = useQuery({
    queryKey: ['host-properties', user?.id],
    queryFn: async () => {
      const res = await getProperties(user?.id ? { host_id: String(user.id) } : {});
      return res.items;
    },
    enabled: !!user?.id,
  });

  const { data: hostBookings } = useQuery({
    queryKey: ['host-bookings'],
    queryFn: getHostBookings,
  });

  const createMutation = useMutation({
    mutationFn: createProperty,
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['host-properties'] }); setShowForm(false); },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: PropertyUpdate }) => updateProperty(id, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['host-properties'] }); setEditingProperty(null); setShowForm(false); },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteProperty,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['host-properties'] }),
  });

  return (
    <DashboardLayout title="Host Dashboard">
      <div className="mb-6">
        {!showForm ? (
          <button onClick={() => { setEditingProperty(null); setShowForm(true); }} className="bg-indigo-600 text-white px-4 py-2 rounded hover:bg-indigo-700">
            + New Listing
          </button>
        ) : (
          <HostPropertyForm
            initialData={editingProperty}
            onSubmit={(data) => editingProperty ? updateMutation.mutate({ id: editingProperty.id, data: data as PropertyUpdate }) : createMutation.mutate(data as PropertyCreate)}
            onCancel={() => { setShowForm(false); setEditingProperty(null); }}
          />
        )}
      </div>

      <h2 className="text-xl font-semibold mb-4">My Listings</h2>
      {!listings?.length ? (
        <p className="text-gray-500">No listings yet.</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
          {listings.map((p) => (
            <div key={p.id} className="border rounded p-4">
              <h3 className="font-semibold">{p.title}</h3>
              <p className="text-sm text-gray-500">{p.location} &middot; ${p.price_per_night}/night</p>
              <div className="flex gap-2 mt-2">
                <button onClick={() => { setEditingProperty(p as any); setShowForm(true); }} className="text-indigo-600 text-sm hover:underline">Edit</button>
                <button onClick={() => deleteMutation.mutate(p.id)} className="text-red-600 text-sm hover:underline">Delete</button>
              </div>
            </div>
          ))}
        </div>
      )}

      <h2 className="text-xl font-semibold mb-4">Bookings for My Properties</h2>
      {!hostBookings?.length ? (
        <p className="text-gray-500">No bookings yet.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left">
                <th className="pb-2">Guest</th>
                <th className="pb-2">Property</th>
                <th className="pb-2">Check-in</th>
                <th className="pb-2">Check-out</th>
                <th className="pb-2">Total</th>
                <th className="pb-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {hostBookings.map((b) => (
                <tr key={b.id} className="border-b">
                  <td className="py-2">{b.user_name || `#${b.user_id}`}</td>
                  <td className="py-2">{b.property_title}</td>
                  <td className="py-2">{new Date(b.check_in).toLocaleDateString()}</td>
                  <td className="py-2">{new Date(b.check_out).toLocaleDateString()}</td>
                  <td className="py-2">${b.total_price}</td>
                  <td className="py-2"><span className={`px-2 py-0.5 rounded text-xs ${b.status === 'confirmed' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>{b.status}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </DashboardLayout>
  );
}
