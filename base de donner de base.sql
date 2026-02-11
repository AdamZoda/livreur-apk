-- WARNING: This schema is for context only and is not meant to be run.
-- Table order and constraints may not be valid for execution.

CREATE TABLE public.announcements (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  title text NOT NULL,
  content text,
  images ARRAY DEFAULT '{}'::text[],
  active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT announcements_pkey PRIMARY KEY (id)
);
CREATE TABLE public.categories (
  id text NOT NULL,
  name_fr text NOT NULL,
  name_ar text NOT NULL,
  name_en text NOT NULL,
  icon_name text,
  color_class text,
  display_order integer DEFAULT 0,
  image_url text,
  CONSTRAINT categories_pkey PRIMARY KEY (id)
);
CREATE TABLE public.device_tokens (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  user_id uuid,
  token text NOT NULL UNIQUE,
  platform text NOT NULL CHECK (platform = ANY (ARRAY['ios'::text, 'android'::text, 'web'::text])),
  created_at timestamp with time zone DEFAULT now(),
  last_used_at timestamp with time zone DEFAULT now(),
  CONSTRAINT device_tokens_pkey PRIMARY KEY (id),
  CONSTRAINT device_tokens_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);
CREATE TABLE public.drivers (
  id text NOT NULL,
  full_name text NOT NULL,
  phone text NOT NULL UNIQUE,
  id_card_number text,
  profile_photo text,
  description text,
  warns integer DEFAULT 0,
  delivery_count integer DEFAULT 0,
  status text DEFAULT 'available'::text,
  created_at timestamp with time zone DEFAULT now(),
  last_lat double precision,
  last_lng double precision,
  documents jsonb DEFAULT '[]'::jsonb,
  average_rating numeric DEFAULT 0,
  total_ratings integer DEFAULT 0,
  CONSTRAINT drivers_pkey PRIMARY KEY (id)
);
CREATE TABLE public.favorites (
  user_id uuid NOT NULL,
  store_id uuid NOT NULL,
  CONSTRAINT favorites_pkey PRIMARY KEY (user_id, store_id),
  CONSTRAINT favorites_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id),
  CONSTRAINT favorites_store_id_fkey FOREIGN KEY (store_id) REFERENCES public.stores(id)
);
CREATE TABLE public.notification_preferences (
  user_id uuid NOT NULL,
  order_updates boolean DEFAULT true,
  delivery_alerts boolean DEFAULT true,
  promotions boolean DEFAULT true,
  new_products boolean DEFAULT false,
  chat_messages boolean DEFAULT true,
  email_notifications boolean DEFAULT false,
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT notification_preferences_pkey PRIMARY KEY (user_id),
  CONSTRAINT notification_preferences_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);
CREATE TABLE public.notifications (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  user_id uuid,
  type text NOT NULL CHECK (type = ANY (ARRAY['order_update'::text, 'delivery_alert'::text, 'promotion'::text, 'new_product'::text, 'chat_message'::text, 'system'::text])),
  title text NOT NULL,
  message text NOT NULL,
  data jsonb,
  read boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now(),
  expires_at timestamp with time zone,
  CONSTRAINT notifications_pkey PRIMARY KEY (id),
  CONSTRAINT notifications_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);
CREATE TABLE public.orders (
  id bigint NOT NULL DEFAULT nextval('orders_id_seq'::regclass),
  user_id uuid,
  store_id uuid,
  status USER-DEFINED,
  total_products numeric NOT NULL,
  delivery_fee numeric DEFAULT 15.00,
  total_final numeric NOT NULL,
  payment_method USER-DEFINED DEFAULT 'cash'::payment_method,
  payment_receipt_base64 text,
  prescription_base64 text,
  text_order_notes text,
  delivery_lat double precision,
  delivery_lng double precision,
  store_rating integer CHECK (store_rating >= 0 AND store_rating <= 5),
  driver_rating integer CHECK (driver_rating >= 0 AND driver_rating <= 5),
  customer_name text,
  store_name text,
  category_name text,
  items jsonb,
  assigned_driver_id text,
  created_at timestamp with time zone DEFAULT now(),
  status_history jsonb DEFAULT '[]'::jsonb,
  phone text,
  is_archived boolean DEFAULT false,
  CONSTRAINT orders_pkey PRIMARY KEY (id),
  CONSTRAINT orders_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id),
  CONSTRAINT orders_store_id_fkey FOREIGN KEY (store_id) REFERENCES public.stores(id)
);
CREATE TABLE public.products (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  store_id uuid NOT NULL,
  name text NOT NULL,
  price numeric NOT NULL,
  image_url text,
  description text,
  is_available boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT products_pkey PRIMARY KEY (id),
  CONSTRAINT products_store_id_fkey FOREIGN KEY (store_id) REFERENCES public.stores(id)
);
CREATE TABLE public.profiles (
  id uuid NOT NULL,
  full_name text,
  phone text UNIQUE,
  password_hash text,
  language text DEFAULT 'fr'::text,
  avatar_url text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  is_admin boolean DEFAULT false,
  is_blocked boolean DEFAULT false,
  total_orders integer DEFAULT 0,
  last_lat double precision,
  last_lng double precision,
  email text UNIQUE,
  CONSTRAINT profiles_pkey PRIMARY KEY (id),
  CONSTRAINT profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id)
);
CREATE TABLE public.ribs (
  id integer NOT NULL DEFAULT nextval('ribs_id_seq'::regclass),
  rib text NOT NULL,
  label text NOT NULL,
  full_name text,
  CONSTRAINT ribs_pkey PRIMARY KEY (id)
);
CREATE TABLE public.settings (
  key text NOT NULL,
  value text,
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT settings_pkey PRIMARY KEY (key)
);
CREATE TABLE public.stores (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  category_id text NOT NULL,
  name text NOT NULL,
  type USER-DEFINED DEFAULT 'products'::store_type,
  image_url text,
  menu_image_url text,
  is_open boolean DEFAULT true,
  rating numeric DEFAULT 4.5,
  delivery_time_min integer DEFAULT 25,
  delivery_fee numeric DEFAULT 15.00,
  description text,
  maps_url text,
  created_at timestamp with time zone DEFAULT now(),
  is_active boolean DEFAULT true,
  is_featured boolean DEFAULT false,
  has_products boolean DEFAULT true,
  CONSTRAINT stores_pkey PRIMARY KEY (id)
);
CREATE TABLE public.super_admins (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  username text NOT NULL UNIQUE,
  badge_id text NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT super_admins_pkey PRIMARY KEY (id)
);
CREATE TABLE public.support_info (
  id integer NOT NULL DEFAULT nextval('support_info_id_seq'::regclass),
  phone text NOT NULL,
  email text NOT NULL,
  CONSTRAINT support_info_pkey PRIMARY KEY (id)
);