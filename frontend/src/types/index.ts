export interface User {
  id: number;
  name: string;
  email: string;
  role: 'guest' | 'host' | 'admin';
  is_active: boolean;
  created_at: string;
  updated_at: string | null;
}

export interface AuthUser {
  id: number;
  name: string;
  email: string;
  role: 'guest' | 'host' | 'admin';
  access_token: string;
  token_type: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  name: string;
  email: string;
  password: string;
  role: string;
}

export interface Property {
  id: number;
  host_id: number;
  title: string;
  description: string | null;
  location: string;
  price_per_night: number;
  max_guests: number;
  bedrooms: number;
  bathrooms: number;
  property_type: string;
  is_active: boolean;
  created_at: string;
  updated_at: string | null;
  images: PropertyImage[];
  amenities: Amenity[];
  average_rating: number | null;
}

export interface PropertyListItem {
  id: number;
  host_id: number;
  title: string;
  location: string;
  price_per_night: number;
  max_guests: number;
  bedrooms: number;
  bathrooms: number;
  property_type: string;
  first_image: string | null;
  average_rating: number | null;
}

export interface PropertyImage {
  id: number;
  image_url: string;
}

export interface Amenity {
  id: number;
  name: string;
}

export interface PropertyCreate {
  title: string;
  description?: string;
  location: string;
  price_per_night: number;
  max_guests: number;
  bedrooms: number;
  bathrooms: number;
  property_type: string;
  amenities: number[];
  images: string[];
}

export interface PropertyUpdate {
  title?: string;
  description?: string;
  location?: string;
  price_per_night?: number;
  max_guests?: number;
  bedrooms?: number;
  bathrooms?: number;
  property_type?: string;
  amenities?: number[];
  images?: string[];
  is_active?: boolean;
}

export interface Booking {
  id: number;
  user_id: number;
  property_id: number;
  check_in: string;
  check_out: string;
  guests: number;
  total_price: number;
  status: 'pending' | 'confirmed' | 'cancelled' | 'completed';
  created_at: string;
  updated_at: string | null;
  property_title?: string;
  property_location?: string;
  user_name?: string;
  user_email?: string;
}

export interface BookingCreate {
  property_id: number;
  check_in: string;
  check_out: string;
  guests: number;
}

export interface Review {
  id: number;
  user_id: number;
  property_id: number;
  booking_id: number;
  rating: number;
  comment: string | null;
  created_at: string;
  user_name?: string;
}

export interface ReviewCreate {
  property_id: number;
  booking_id: number;
  rating: number;
  comment?: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  skip: number;
  limit: number;
}
