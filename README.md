# Study Room Management System

A full-stack web application for managing study room seats, students, payments, and expenses.

## Architecture

- **Frontend**: React + Vite + Material-UI (deployed on Netlify)
- **Backend**: Node.js + Express + PostgreSQL (deployed on Render)
- **Database**: Neon PostgreSQL (cloud-hosted)

## Project Structure

```
├── frontend/          # React frontend application
│   ├── src/
│   ├── package.json
│   └── vite.config.js
├── backend/           # Node.js backend API
│   ├── routes/
│   ├── config/
│   ├── server.js
│   └── package.json
└── db_schema_postgres.sql  # Database schema
```

## Features

### Frontend Features
- 🎯 **Seat Chart Visualization** - Interactive seat layout with gender-based styling
- 👥 **Student Management** - Add, edit, view student information
- 💰 **Payment Tracking** - Record and track payments (CASH/ONLINE)
- 📊 **Expense Management** - Track all business expenses
- 🔧 **Admin Panel** - Seat management with add/remove/maintenance controls
- 🌍 **Multi-language Support** - English/Hindi language switching
- 📱 **Responsive Design** - Works on desktop and mobile devices

### Backend Features
- 🔐 **JWT Authentication** - Secure user login and authorization
- 🗄️ **PostgreSQL Integration** - Robust database with Neon cloud hosting
- 📝 **Complete CRUD APIs** - Full operations for all entities
- 🔍 **Audit Trail** - History tracking for all changes
- ⚡ **Real-time Updates** - Live data synchronization
- 🛡️ **Security Features** - Password hashing, CORS protection, SQL injection prevention

## Quick Start

### Prerequisites
- Node.js 18+
- Neon PostgreSQL account
- Git

### Local Development

1. **Clone the repository**
```bash
git clone <your-repo-url>
cd study-room-management-app
```

2. **Setup Backend**
```bash
cd backend
npm install
cp .env.example .env
# Update .env with your Neon database URL
npm run dev
```

3. **Setup Frontend**
```bash
cd ../frontend
npm install
npm run dev
```

4. **Database Setup**
- Create a Neon PostgreSQL database
- Run the SQL from `db_schema_postgres.sql`
- Update `DATABASE_URL` in backend `.env`

## Deployment

### Backend (Render)
1. Connect GitHub repo to Render
2. Set root directory: `/backend`
3. Build command: `npm install`
4. Start command: `npm start`
5. Add environment variables:
   - `DATABASE_URL`
   - `JWT_SECRET`
   - `CORS_ORIGIN`
   - `NODE_ENV=production`

### Frontend (Netlify)
1. Connect GitHub repo to Netlify
2. Set publish directory: `/frontend/dist`
3. Build command: `npm run build`
4. Base directory: `/frontend`
5. Add environment variable:
   - `VITE_API_URL=https://your-backend.onrender.com/api`

### Database (Neon)
1. Create Neon PostgreSQL database
2. Copy connection string to backend `.env`
3. Run schema from `db_schema_postgres.sql`

## Environment Variables

### Backend (.env)
```env
PORT=3001
NODE_ENV=production
DATABASE_URL=postgresql://username:password@host/database?sslmode=require
JWT_SECRET=your-super-secret-key
CORS_ORIGIN=https://your-frontend.netlify.app
```

### Frontend (.env.production)
```env
VITE_API_URL=https://your-backend.onrender.com/api
```

## Database Schema

### Core Tables
- `users` - Admin accounts with authentication
- `seats` - Seat management with gender restrictions
- `students` - Student records with membership details
- `payments` - Payment history with mode tracking
- `expenses` - Business expense records

### Audit Tables
- `students_history`
- `seats_history`
- `payments_history`
- `expenses_history`

## API Documentation

The backend provides RESTful APIs for all operations:
- Authentication: `/api/auth/*`
- Seats: `/api/seats/*`
- Students: `/api/students/*`
- Payments: `/api/payments/*`
- Expenses: `/api/expenses/*`

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

This project is licensed under the MIT License.

## Support

For issues or questions, please create an issue in the GitHub repository.
