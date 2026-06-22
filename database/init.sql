CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'admin',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS parcels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tracking_number TEXT NOT NULL UNIQUE,
  sender_name TEXT NOT NULL,
  sender_phone TEXT NOT NULL DEFAULT '',
  recipient_name TEXT NOT NULL,
  recipient_phone TEXT NOT NULL DEFAULT '',
  origin_city TEXT NOT NULL,
  destination_city TEXT NOT NULL,
  pickup_address TEXT NOT NULL DEFAULT '',
  delivery_address TEXT NOT NULL DEFAULT '',
  weight_kg NUMERIC(8, 2) NOT NULL CHECK (weight_kg > 0),
  status TEXT NOT NULL CHECK (status IN ('created', 'picked_up', 'in_transit', 'out_for_delivery', 'delivered', 'delayed')),
  estimated_delivery DATE NOT NULL,
  notes TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_parcels_status ON parcels(status);
CREATE INDEX IF NOT EXISTS idx_parcels_created_at ON parcels(created_at DESC);

INSERT INTO users (name, email, password_hash, role)
VALUES (
  'Demo Admin',
  'admin@parcel.test',
  '$2b$10$.4R.ztnb0/Hrh9.8QHdeN.M4GsCA2DRHRKkMomesPlyyQhoC3EUzm',
  'admin'
)
ON CONFLICT (email) DO UPDATE
SET
  name = EXCLUDED.name,
  password_hash = EXCLUDED.password_hash,
  role = EXCLUDED.role;

INSERT INTO parcels (
  tracking_number,
  sender_name,
  sender_phone,
  recipient_name,
  recipient_phone,
  origin_city,
  destination_city,
  pickup_address,
  delivery_address,
  weight_kg,
  status,
  estimated_delivery,
  notes
) VALUES
  ('PX-100284', 'Acme Books', '+1 212 555 0142', 'Maya Chen', '+1 617 555 0198', 'New York', 'Boston', '44 West 18th Street, New York, NY', '12 Beacon Street, Boston, MA', 1.25, 'in_transit', CURRENT_DATE + INTERVAL '2 days', 'Leave at reception.'),
  ('PX-100285', 'Northwind Parts', '+1 312 555 0161', 'Liam Carter', '+1 512 555 0174', 'Chicago', 'Austin', '201 Industrial Road, Chicago, IL', '88 Congress Avenue, Austin, TX', 6.40, 'picked_up', CURRENT_DATE + INTERVAL '4 days', 'Fragile mechanical parts.'),
  ('PX-100286', 'Fresh Studio', '+1 206 555 0107', 'Amara Singh', '+1 503 555 0145', 'Seattle', 'Portland', '90 Pine Street, Seattle, WA', '1400 Alder Street, Portland, OR', 0.80, 'out_for_delivery', CURRENT_DATE + INTERVAL '1 day', ''),
  ('PX-100287', 'City Pharmacy', '+1 303 555 0129', 'Noah Kim', '+1 602 555 0155', 'Denver', 'Phoenix', '300 Market Street, Denver, CO', '41 Central Avenue, Phoenix, AZ', 2.10, 'delayed', CURRENT_DATE + INTERVAL '5 days', 'Temperature-sensitive package.'),
  ('PX-100288', 'Home Market', '+1 619 555 0114', 'Elena Garcia', '+1 213 555 0180', 'San Diego', 'Los Angeles', '18 Harbor Drive, San Diego, CA', '700 Spring Street, Los Angeles, CA', 3.75, 'delivered', CURRENT_DATE - INTERVAL '1 day', 'Delivered to front desk.')
ON CONFLICT (tracking_number) DO NOTHING;
