import 'dotenv/config';
import bcrypt from 'bcryptjs';
import cors from 'cors';
import express from 'express';
import jwt from 'jsonwebtoken';
import { initializeDatabase, pool, query } from './db.js';

const app = express();
const port = Number(process.env.PORT || 3000);
const allowedOrigin = process.env.CORS_ORIGIN || 'http://localhost:5173';
const jwtSecret = process.env.JWT_SECRET || 'dev-only-change-this-secret';

const statuses = new Set([
  'created',
  'picked_up',
  'in_transit',
  'out_for_delivery',
  'delivered',
  'delayed'
]);

app.use(cors({ origin: allowedOrigin }));
app.use(express.json());

app.get('/api/health', async (_req, res, next) => {
  const startedAt = Date.now();

  try {
    await query('SELECT 1');
    res.json({
      ok: true,
      service: 'parcel-backend',
      status: 'healthy',
      database: 'connected',
      uptimeSeconds: Math.round(process.uptime()),
      checkedAt: new Date().toISOString(),
      responseTimeMs: Date.now() - startedAt
    });
  } catch (error) {
    res.status(503).json({
      ok: false,
      service: 'parcel-backend',
      status: 'unhealthy',
      database: 'disconnected',
      checkedAt: new Date().toISOString(),
      responseTimeMs: Date.now() - startedAt,
      message: error.message
    });
  }
});

app.post('/api/auth/login', async (req, res, next) => {
  try {
    const email = String(req.body.email || '').trim().toLowerCase();
    const password = String(req.body.password || '');

    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required.' });
    }

    const { rows } = await query(
      `
        SELECT id, name, email, password_hash, role
        FROM users
        WHERE email = $1
      `,
      [email]
    );
    const user = rows[0];

    if (!user || !(await bcrypt.compare(password, user.password_hash))) {
      return res.status(401).json({ message: 'Invalid email or password.' });
    }

    const safeUser = toUserDto(user);
    const token = jwt.sign(safeUser, jwtSecret, { expiresIn: '8h' });

    res.json({ token, user: safeUser });
  } catch (error) {
    next(error);
  }
});

app.get('/api/auth/me', requireAuth, (req, res) => {
  res.json({ user: req.user });
});

app.get('/api/parcels', requireAuth, async (_req, res, next) => {
  try {
    const { rows } = await query(`
      SELECT
        id,
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
        notes,
        created_at,
        updated_at
      FROM parcels
      ORDER BY created_at DESC
    `);

    res.json(rows.map(toParcelDto));
  } catch (error) {
    next(error);
  }
});

app.post('/api/parcels', requireAuth, async (req, res, next) => {
  try {
    const parcel = normalizeParcelInput(req.body);
    const missingFields = [
      'senderName',
      'senderPhone',
      'recipientName',
      'recipientPhone',
      'originCity',
      'destinationCity',
      'pickupAddress',
      'deliveryAddress',
      'weightKg',
      'estimatedDelivery'
    ].filter((field) => parcel[field] === undefined || parcel[field] === '');

    if (missingFields.length > 0) {
      return res.status(400).json({
        message: `Missing required fields: ${missingFields.join(', ')}`
      });
    }

    if (!Number.isFinite(parcel.weightKg) || parcel.weightKg <= 0) {
      return res.status(400).json({ message: 'Weight must be greater than 0.' });
    }

    if (!isValidDate(parcel.estimatedDelivery)) {
      return res.status(400).json({ message: 'Estimated delivery must be a valid date.' });
    }

    const status = statuses.has(parcel.status) ? parcel.status : 'created';
    const trackingNumber = `PX-${Math.floor(100000 + Math.random() * 900000)}`;

    const { rows } = await query(
      `
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
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
        RETURNING *
      `,
      [
        trackingNumber,
        parcel.senderName,
        parcel.senderPhone,
        parcel.recipientName,
        parcel.recipientPhone,
        parcel.originCity,
        parcel.destinationCity,
        parcel.pickupAddress,
        parcel.deliveryAddress,
        parcel.weightKg,
        status,
        parcel.estimatedDelivery,
        parcel.notes
      ]
    );

    res.status(201).json(toParcelDto(rows[0]));
  } catch (error) {
    if (error.code === '23505') {
      return res.status(409).json({ message: 'Tracking number already exists. Please retry.' });
    }

    next(error);
  }
});

app.put('/api/parcels/:id', requireAuth, async (req, res, next) => {
  try {
    const parcel = normalizeParcelInput(req.body);
    const missingFields = [
      'senderName',
      'senderPhone',
      'recipientName',
      'recipientPhone',
      'originCity',
      'destinationCity',
      'pickupAddress',
      'deliveryAddress',
      'weightKg',
      'estimatedDelivery'
    ].filter((field) => parcel[field] === undefined || parcel[field] === '');

    if (missingFields.length > 0) {
      return res.status(400).json({
        message: `Missing required fields: ${missingFields.join(', ')}`
      });
    }

    if (!Number.isFinite(parcel.weightKg) || parcel.weightKg <= 0) {
      return res.status(400).json({ message: 'Weight must be greater than 0.' });
    }

    if (!isValidDate(parcel.estimatedDelivery)) {
      return res.status(400).json({ message: 'Estimated delivery must be a valid date.' });
    }

    const status = statuses.has(parcel.status) ? parcel.status : 'created';
    const { rows } = await query(
      `
        UPDATE parcels
        SET
          sender_name = $1,
          sender_phone = $2,
          recipient_name = $3,
          recipient_phone = $4,
          origin_city = $5,
          destination_city = $6,
          pickup_address = $7,
          delivery_address = $8,
          weight_kg = $9,
          status = $10,
          estimated_delivery = $11,
          notes = $12,
          updated_at = NOW()
        WHERE id = $13
        RETURNING *
      `,
      [
        parcel.senderName,
        parcel.senderPhone,
        parcel.recipientName,
        parcel.recipientPhone,
        parcel.originCity,
        parcel.destinationCity,
        parcel.pickupAddress,
        parcel.deliveryAddress,
        parcel.weightKg,
        status,
        parcel.estimatedDelivery,
        parcel.notes,
        req.params.id
      ]
    );

    if (rows.length === 0) {
      return res.status(404).json({ message: 'Parcel not found.' });
    }

    res.json(toParcelDto(rows[0]));
  } catch (error) {
    next(error);
  }
});

app.patch('/api/parcels/:id/status', requireAuth, async (req, res, next) => {
  try {
    const { status } = req.body;

    if (!statuses.has(status)) {
      return res.status(400).json({ message: 'Invalid parcel status.' });
    }

    const { rows } = await query(
      `
        UPDATE parcels
        SET status = $1, updated_at = NOW()
        WHERE id = $2
        RETURNING *
      `,
      [status, req.params.id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ message: 'Parcel not found.' });
    }

    res.json(toParcelDto(rows[0]));
  } catch (error) {
    next(error);
  }
});

app.delete('/api/parcels/:id', requireAuth, async (req, res, next) => {
  try {
    const { rowCount } = await query('DELETE FROM parcels WHERE id = $1', [req.params.id]);

    if (rowCount === 0) {
      return res.status(404).json({ message: 'Parcel not found.' });
    }

    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

app.use((error, _req, res, _next) => {
  console.error(error);
  res.status(500).json({ message: 'Unexpected server error.' });
});

const server = await startServer();

process.on('SIGTERM', async () => {
  server.close(async () => {
    await pool.end();
  });
});

function normalizeParcelInput(input) {
  return {
    senderName: String(input.senderName || '').trim(),
    senderPhone: String(input.senderPhone || '').trim(),
    recipientName: String(input.recipientName || '').trim(),
    recipientPhone: String(input.recipientPhone || '').trim(),
    originCity: String(input.originCity || '').trim(),
    destinationCity: String(input.destinationCity || '').trim(),
    pickupAddress: String(input.pickupAddress || '').trim(),
    deliveryAddress: String(input.deliveryAddress || '').trim(),
    weightKg: Number(input.weightKg),
    status: String(input.status || 'created').trim(),
    estimatedDelivery: String(input.estimatedDelivery || '').trim(),
    notes: String(input.notes || '').trim()
  };
}

function isValidDate(value) {
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp);
}

function toParcelDto(row) {
  return {
    id: row.id,
    trackingNumber: row.tracking_number,
    senderName: row.sender_name,
    senderPhone: row.sender_phone,
    recipientName: row.recipient_name,
    recipientPhone: row.recipient_phone,
    originCity: row.origin_city,
    destinationCity: row.destination_city,
    pickupAddress: row.pickup_address,
    deliveryAddress: row.delivery_address,
    weightKg: Number(row.weight_kg),
    status: row.status,
    estimatedDelivery: row.estimated_delivery,
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function requireAuth(req, res, next) {
  const authorization = req.get('authorization') || '';
  const [scheme, token] = authorization.split(' ');

  if (scheme !== 'Bearer' || !token) {
    return res.status(401).json({ message: 'Login is required.' });
  }

  try {
    req.user = jwt.verify(token, jwtSecret);
    next();
  } catch (_error) {
    return res.status(401).json({ message: 'Your login session has expired.' });
  }
}

function toUserDto(row) {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    role: row.role
  };
}

async function startServer() {
  await initializeDatabase();
  return app.listen(port, () => {
    console.log(`Parcel backend listening on port ${port}`);
  });
}
