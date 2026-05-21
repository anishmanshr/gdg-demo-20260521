import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';

export default function Navbar() {
  const { isAuthenticated, user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  return (
    <nav className="bg-white shadow-md sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16 items-center">
          <Link to="/" className="text-2xl font-bold text-indigo-600">
            RentStay
          </Link>

          <div className="flex items-center gap-4">
            <Link to="/properties" className="text-gray-700 hover:text-indigo-600">
              Browse
            </Link>

            {isAuthenticated ? (
              <>
                {user?.role === 'host' && (
                  <Link to="/host/dashboard" className="text-gray-700 hover:text-indigo-600">
                    My Listings
                  </Link>
                )}
                {user?.role === 'admin' && (
                  <Link to="/admin/dashboard" className="text-gray-700 hover:text-indigo-600">
                    Admin
                  </Link>
                )}
                {user?.role === 'guest' && (
                  <Link to="/dashboard" className="text-gray-700 hover:text-indigo-600">
                    My Bookings
                  </Link>
                )}
                <span className="text-sm text-gray-500">{user?.name}</span>
                <button
                  onClick={handleLogout}
                  className="bg-gray-200 px-3 py-1 rounded text-sm hover:bg-gray-300"
                >
                  Logout
                </button>
              </>
            ) : (
              <>
                <Link to="/login" className="text-gray-700 hover:text-indigo-600">
                  Login
                </Link>
                <Link
                  to="/register"
                  className="bg-indigo-600 text-white px-4 py-1.5 rounded hover:bg-indigo-700"
                >
                  Sign Up
                </Link>
              </>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}
