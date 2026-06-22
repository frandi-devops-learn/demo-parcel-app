# Z Flash Admin

A modern full-stack parcel delivery admin dashboard for demos and testing.

## Stack

- Frontend: React + Vite
- Backend: Node.js + Express
- Database: PostgreSQL
- Runtime: Docker Compose

## Features

- View parcel delivery dashboard metrics
- Create parcels with real sender and recipient contact data
- Edit parcel details for full CRUD testing
- Update parcel status from the courier/admin queue
- Delete demo records
- Seeded PostgreSQL data for immediate testing
- Multi-stage Docker images for backend and frontend

## Run With Docker

```bash
docker compose up --build
```

Then open:

- Frontend: http://localhost:5173
- Backend health check: http://localhost:3000/api/health

PostgreSQL runs on `localhost:5432`.

Demo login:

- Email: `admin@parcel.test`
- Password: `admin123`

## Local Development

Backend:

```bash
cd backend
npm install
npm run dev
```

Frontend:

```bash
cd frontend
npm install
npm run dev
```

For local backend development without Docker, create `backend/.env`:

```env
PORT=3000
DATABASE_URL=postgres://parcel_user:parcel_password@localhost:5432/parcel_demo
JWT_SECRET=replace-with-a-local-secret
```

## API Endpoints

- `GET /api/health`
- `POST /api/auth/login`
- `GET /api/auth/me`
- `GET /api/parcels`
- `POST /api/parcels`
- `PUT /api/parcels/:id`
- `PATCH /api/parcels/:id/status`
- `DELETE /api/parcels/:id`
