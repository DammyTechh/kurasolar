/** Row shapes for the tables the browser reads. Mirrors supabase/migrations. */
import type { ApplianceCategory, GridAvailability, LoadPriority, LoadSummary, SizingResult, SizingTeaser, UsageWindow } from '@engine';

export type Role = 'customer' | 'admin';

export interface Profile {
  id: string;
  email: string | null;
  username: string | null;
  full_name: string | null;
  phone: string | null;
  avatar_url: string | null;
  country: string | null;
  state: string | null;
  city: string | null;
  address: string | null;
  property_type: string | null;
  marketing_opt_in: boolean;
  role: Role;
  onboarded_at: string | null;
  created_at: string;
}

export interface Country {
  code: string;
  name: string;
  currency: string;
  default_peak_sun_hours: number;
  default_ambient_temp_c: number | null;
  is_active: boolean;
  sort_order: number;
}

export interface Region {
  id: string;
  country_code: string;
  name: string;
  zone: string | null;
  peak_sun_hours: number;
  ambient_temp_c: number | null;
  is_active: boolean;
}

export interface CatalogAppliance {
  id: string;
  category: ApplianceCategory;
  name: string;
  description: string | null;
  default_watts: number;
  default_hours: number;
  duty_cycle: number;
  surge_factor: number;
  priority: LoadPriority;
  usage_window: UsageWindow;
  inverter_technology: boolean;
  horsepower: number | null;
  is_active: boolean;
  sort_order: number;
}

export type AssessmentStatus = 'calculated' | 'paid';

export interface Assessment {
  id: string;
  code: string;
  user_id: string | null;
  customer_name: string | null;
  customer_email: string | null;
  customer_phone: string | null;
  country: string;
  state: string | null;
  city: string | null;
  grid_availability: GridAvailability;
  backup_hours: number | null;
  currency: string;
  property_type: string | null;
  is_diaspora: boolean;
  recipient: { name?: string; phone?: string; location?: string; relationship?: string } | null;
  status: AssessmentStatus;
  appliance_count: number;
  connected_load_kw: number;
  peak_load_kw: number;
  surge_peak_kw: number;
  daily_energy_kwh: number;
  essential_load_kw: number;
  heavy_load_kw: number;
  system_class: string | null;
  inverter_class_kva: number | null;
  paid_at: string | null;
  created_at: string;
}

export interface AssessmentAppliance {
  id: string;
  position: number;
  category: ApplianceCategory;
  name: string;
  quantity: number;
  rated_watts: number;
  hours_per_day: number;
  days_per_week: number;
  cycles_per_day: number;
  duty_cycle: number;
  surge_factor: number;
  priority: LoadPriority;
  usage_window: UsageWindow;
  daily_kwh: number;
}

export interface RecommendedItem {
  product_id: string;
  slug: string;
  name: string;
  role: string;
  quantity: number;
  unit_price: number;
  reason: string;
}

export interface AssessmentResult {
  assessment_id: string;
  result: SizingResult;
  recommended_pv_kwp: number;
  recommended_inverter_kw: number;
  recommended_inverter_kva: number;
  recommended_battery_kwh: number;
  recommended_products: { items: RecommendedItem[]; package_slug: string | null };
  report_generated_at: string | null;
}

export type CalculateResponse = {
  id: string;
  code: string;
  status: AssessmentStatus;
  summary: Omit<LoadSummary, 'breakdown'>;
  teaser: SizingTeaser;
};

export interface ProductCategory {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  image_url: string | null;
  sort_order: number;
  is_active: boolean;
}

export type ProductRole = 'inverter' | 'battery' | 'panel' | 'protection' | 'cable' | 'mounting' | 'accessory';

export interface Product {
  id: string;
  slug: string;
  name: string;
  category_id: string | null;
  brand: string | null;
  sku: string | null;
  short_description: string | null;
  description: string | null;
  price: number;
  compare_at_price: number | null;
  currency: string;
  stock_quantity: number;
  images: string[];
  specs: Record<string, string | number>;
  product_role: ProductRole | null;
  capacity_value: number | null;
  capacity_unit: string | null;
  is_featured: boolean;
  is_active: boolean;
  created_at: string;
  product_categories?: Pick<ProductCategory, 'slug' | 'name'> | null;
}

export interface Package {
  id: string;
  slug: string;
  name: string;
  tagline: string | null;
  inverter_kw: number;
  battery_kwh: number;
  pv_kwp_min: number;
  pv_kwp_max: number;
  price: number | null;
  ideal_for: string | null;
  features: string[];
  image_url: string | null;
  is_popular: boolean;
  is_active: boolean;
  sort_order: number;
}

export type OrderStatus = 'pending_payment' | 'paid' | 'processing' | 'shipped' | 'delivered' | 'cancelled' | 'refunded';

export interface Order {
  id: string;
  code: string;
  user_id: string | null;
  email: string;
  full_name: string;
  phone: string;
  address: string;
  city: string;
  state: string;
  country: string;
  notes: string | null;
  subtotal: number;
  delivery_fee: number;
  total: number;
  currency: string;
  status: OrderStatus;
  paid_at: string | null;
  created_at: string;
  order_items?: OrderItem[];
}

export interface OrderItem {
  id: string;
  product_id: string | null;
  product_name: string;
  sku: string | null;
  unit_price: number;
  quantity: number;
  line_total: number;
}

export type PaymentStatus = 'pending' | 'success' | 'failed' | 'abandoned' | 'refunded';

export interface Payment {
  id: string;
  reference: string;
  purpose: 'consultation' | 'order';
  assessment_id: string | null;
  order_id: string | null;
  user_id: string | null;
  email: string;
  amount: number;
  currency: string;
  status: PaymentStatus;
  channel: string | null;
  gateway_response: string | null;
  is_duplicate: boolean;
  paid_at: string | null;
  created_at: string;
}

export const INSTALLER_SERVICES = ['residential', 'commercial', 'industrial', 'off_grid', 'hybrid', 'bess', 'solar_pv', 'maintenance'] as const;
export type InstallerService = (typeof INSTALLER_SERVICES)[number];

export interface PublicInstaller {
  id: string;
  slug: string;
  company_name: string;
  logo_url: string | null;
  photo_url: string | null;
  state: string;
  city: string | null;
  states_covered: string[];
  services: InstallerService[];
  certifications: string[];
  years_experience: number;
  completed_projects: number;
  bio: string | null;
  portfolio: { title?: string; image?: string; description?: string }[];
  phone: string | null;
  whatsapp: string | null;
  email: string | null;
  website: string | null;
  is_featured: boolean;
}

export interface Installer extends PublicInstaller {
  user_id: string | null;
  contact_person: string | null;
  address: string | null;
  verification_status: 'pending' | 'verified' | 'suspended';
  internal_notes: string | null;
  created_at: string;
}

export type RequestStatus = 'new' | 'matched' | 'contacted' | 'scheduled' | 'completed' | 'cancelled';

export interface InstallerRequest {
  id: string;
  code: string;
  assessment_id: string | null;
  user_id: string | null;
  full_name: string;
  email: string;
  phone: string;
  country: string;
  state: string;
  city: string | null;
  address: string | null;
  property_type: string | null;
  system_size: string | null;
  preferred_date: string | null;
  message: string | null;
  status: RequestStatus;
  admin_notes: string | null;
  created_at: string;
}

export interface Enquiry {
  id: string;
  type: 'custom_installation' | 'quote' | 'contact' | 'commercial';
  full_name: string;
  email: string;
  phone: string | null;
  company: string | null;
  location: string | null;
  message: string | null;
  items: { product_id: string; name: string; quantity: number }[] | null;
  status: 'new' | 'in_progress' | 'closed';
  admin_notes: string | null;
  created_at: string;
}

export interface Post {
  id: string;
  slug: string;
  title: string;
  excerpt: string | null;
  body: string;
  cover_url: string | null;
  tags: string[];
  is_published: boolean;
  published_at: string | null;
  seo_title: string | null;
  seo_description: string | null;
  created_at: string;
}

export interface SavedApplianceSet {
  id: string;
  user_id: string;
  name: string;
  appliances: unknown[];
  created_at: string;
  updated_at: string;
}
