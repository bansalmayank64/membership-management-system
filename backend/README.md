# Study Room Management System - Backend

A Node.js Express API server with PostgreSQL database for managing study room seats, students, payments, and expenses.

## Features

- **Seat Management**: Add, update, remove seats with gender restrictions
- **Student Management**: Full CRUD operations for student records
- **Payment Tracking**: Record and track payments with different modes (CASH/ONLINE)
- **Expense Management**: Track all expenses with detailed records
- **Authentication**: JWT-based user authentication
- **History Tracking**: Complete audit trail of all changes
- **Database**: PostgreSQL with Neon cloud integration

## API Endpoints

### Seats
- `GET /api/seats` - Get all seats with student information
- `POST /api/seats` - Create a new seat
- `PUT /api/seats/:seatNumber` - Update seat status
- `DELETE /api/seats/:seatNumber` - Mark seat as removed

### Students
- `GET /api/students` - Get all students
- `GET /api/students/:id` - Get student by ID
- `POST /api/students` - Create a new student
- `PUT /api/students/:id` - Update student
- `DELETE /api/students/:id` - Delete student
- `GET /api/students/expiring/memberships` - Get expiring memberships

### Payments
- `GET /api/payments` - Get all payments
- `GET /api/payments/student/:studentId` - Get payments for a student
- `POST /api/payments` - Create a new payment
- `PUT /api/payments/:id` - Update payment
- `DELETE /api/payments/:id` - Delete payment
- `GET /api/payments/summary/stats` - Get payment statistics

### Expenses
- `GET /api/expenses` - Get all expenses
- `POST /api/expenses` - Create a new expense
- `PUT /api/expenses/:id` - Update expense
- `DELETE /api/expenses/:id` - Delete expense
- `GET /api/expenses/summary/stats` - Get expense statistics

### Authentication
- `POST /api/auth/login` - User login
- `POST /api/auth/register` - User registration
- `GET /api/auth/verify` - Verify token
- `GET /api/auth/users` - Get all users (protected)

## Environment Variables

```env
PORT=3001
NODE_ENV=development
DATABASE_URL=
JWT_SECRET=your-super-secret-jwt-key
CORS_ORIGIN=http://localhost:5173
```

## Database Setup

1. Create a Neon PostgreSQL database
2. Run the schema from `../db_schema_postgres.sql`
3. Update `DATABASE_URL` in `.env` with your Neon connection string

## Local Development

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Start production server
npm start
```

## Deployment on Render

1. Connect your GitHub repository to Render
2. Set root directory to `/backend`
3. Set build command: `npm install`
4. Set start command: `npm start`
5. Add environment variables:
   - `DATABASE_URL` - Your Neon PostgreSQL connection string
   - `JWT_SECRET` - A secure random string
   - `CORS_ORIGIN` - Your frontend URL (e.g., https://your-app.netlify.app)
   - `NODE_ENV` - `production`

## Database Schema

The database includes the following tables:
- `users` - Admin/user accounts
- `seats` - Seat information with gender restrictions
- `students` - Student records with membership details
- `payments` - Payment history
- `expenses` - Expense records
- `*_history` tables - Audit trail for all changes

## Security Features

- JWT-based authentication
- Password hashing with bcrypt
- CORS protection
- SQL injection prevention with parameterized queries
- Environment variable protection

## API Testing

Health check endpoint: `GET /health`
Database test endpoint: `GET /db-test`
