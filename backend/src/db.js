import pg from 'pg';

const { Pool } = pg;

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

export async function query(text, params) {
  const startedAt = Date.now();
  const result = await pool.query(text, params);
  const duration = Date.now() - startedAt;

  if (duration > 500) {
    console.warn(`Slow query detected: ${duration}ms`);
  }

  return result;
}

export async function initializeDatabase() {
  await query(`
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
      recipient_name TEXT NOT NULL,
      origin_city TEXT NOT NULL,
      destination_city TEXT NOT NULL,
      weight_kg NUMERIC(8, 2) NOT NULL CHECK (weight_kg > 0),
      status TEXT NOT NULL CHECK (status IN ('created', 'picked_up', 'in_transit', 'out_for_delivery', 'delivered', 'delayed')),
      estimated_delivery DATE NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    ALTER TABLE parcels ADD COLUMN IF NOT EXISTS sender_phone TEXT NOT NULL DEFAULT '';
    ALTER TABLE parcels ADD COLUMN IF NOT EXISTS recipient_phone TEXT NOT NULL DEFAULT '';
    ALTER TABLE parcels ADD COLUMN IF NOT EXISTS pickup_address TEXT NOT NULL DEFAULT '';
    ALTER TABLE parcels ADD COLUMN IF NOT EXISTS delivery_address TEXT NOT NULL DEFAULT '';
    ALTER TABLE parcels ADD COLUMN IF NOT EXISTS notes TEXT NOT NULL DEFAULT '';

    CREATE INDEX IF NOT EXISTS idx_parcels_status ON parcels(status);
    CREATE INDEX IF NOT EXISTS idx_parcels_created_at ON parcels(created_at DESC);
  `);

  await query(`
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

    UPDATE parcels
    SET
      sender_phone = seed.sender_phone,
      recipient_phone = seed.recipient_phone,
      pickup_address = seed.pickup_address,
      delivery_address = seed.delivery_address,
      notes = seed.notes
    FROM (
      VALUES
        ('PX-100284', '+1 212 555 0142', '+1 617 555 0198', '44 West 18th Street, New York, NY', '12 Beacon Street, Boston, MA', 'Leave at reception.'),
        ('PX-100285', '+1 312 555 0161', '+1 512 555 0174', '201 Industrial Road, Chicago, IL', '88 Congress Avenue, Austin, TX', 'Fragile mechanical parts.'),
        ('PX-100286', '+1 206 555 0107', '+1 503 555 0145', '90 Pine Street, Seattle, WA', '1400 Alder Street, Portland, OR', ''),
        ('PX-100287', '+1 303 555 0129', '+1 602 555 0155', '300 Market Street, Denver, CO', '41 Central Avenue, Phoenix, AZ', 'Temperature-sensitive package.'),
        ('PX-100288', '+1 619 555 0114', '+1 213 555 0180', '18 Harbor Drive, San Diego, CA', '700 Spring Street, Los Angeles, CA', 'Delivered to front desk.')
    ) AS seed(tracking_number, sender_phone, recipient_phone, pickup_address, delivery_address, notes)
    WHERE parcels.tracking_number = seed.tracking_number
      AND parcels.sender_phone = ''
      AND parcels.recipient_phone = ''
      AND parcels.pickup_address = ''
      AND parcels.delivery_address = '';
  `);
}
