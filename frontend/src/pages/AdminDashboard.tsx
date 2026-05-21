import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getAdminUsers, deactivateUser, activateUser } from '../api/admin';
import { getProperties } from '../api/properties';
import DashboardLayout from '../components/layout/DashboardLayout';

export default function AdminDashboard() {
  const queryClient = useQueryClient();

  const { data: users, isLoading: usersLoading } = useQuery({
    queryKey: ['admin-users'],
    queryFn: getAdminUsers,
  });

  const { data: properties } = useQuery({
    queryKey: ['admin-properties'],
    queryFn: async () => { const res = await getProperties(); return res.items; },
  });

  const deactivateMutation = useMutation({
    mutationFn: deactivateUser,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-users'] }),
  });

  const activateMutation = useMutation({
    mutationFn: activateUser,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-users'] }),
  });

  return (
    <DashboardLayout title="Admin Dashboard">
      <h2 className="text-xl font-semibold mb-4">Users ({users?.length || 0})</h2>
      {usersLoading ? (
        <p className="text-gray-500">Loading...</p>
      ) : (
        <div className="overflow-x-auto mb-8">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left">
                <th className="pb-2">ID</th>
                <th className="pb-2">Name</th>
                <th className="pb-2">Email</th>
                <th className="pb-2">Role</th>
                <th className="pb-2">Active</th>
                <th className="pb-2">Action</th>
              </tr>
            </thead>
            <tbody>
              {users?.map((u) => (
                <tr key={u.id} className="border-b">
                  <td className="py-2">{u.id}</td>
                  <td className="py-2">{u.name}</td>
                  <td className="py-2">{u.email}</td>
                  <td className="py-2">{u.role}</td>
                  <td className="py-2">{u.is_active ? 'Yes' : 'No'}</td>
                  <td className="py-2">
                    {u.is_active ? (
                      <button onClick={() => deactivateMutation.mutate(u.id)} className="text-red-600 hover:underline text-xs">Deactivate</button>
                    ) : (
                      <button onClick={() => activateMutation.mutate(u.id)} className="text-green-600 hover:underline text-xs">Activate</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <h2 className="text-xl font-semibold mb-4">Properties ({properties?.length || 0})</h2>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left">
              <th className="pb-2">ID</th>
              <th className="pb-2">Title</th>
              <th className="pb-2">Location</th>
              <th className="pb-2">Price/Night</th>
              <th className="pb-2">Type</th>
            </tr>
          </thead>
          <tbody>
            {properties?.map((p) => (
              <tr key={p.id} className="border-b">
                <td className="py-2">{p.id}</td>
                <td className="py-2">{p.title}</td>
                <td className="py-2">{p.location}</td>
                <td className="py-2">${p.price_per_night}</td>
                <td className="py-2">{p.property_type}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </DashboardLayout>
  );
}
