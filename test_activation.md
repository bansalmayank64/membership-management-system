# Student Reactivation API Testing

## New Enhanced Activation Endpoint

**PATCH** `/api/students/:id/activate`

### Request Body Parameters:

1. **reactivationType** (required): 
   - `"resume"` - Keep original membership start date
   - `"fresh"` - Update membership start date to today

### Example Requests:

#### 1. Resume with Original Dates
```json
{
  "reactivationType": "resume"
}
```

#### 2. Start Fresh from Today
```json
{
  "reactivationType": "fresh"
}
```

### Response Format:
```json
{
  "success": true,
  "student": {
    "id": 123,
    "name": "JOHN DOE",
    "membership_status": "active",
    "membership_date": "2024-01-15",
    "membership_till": "2025-01-15",
    // ... other student fields
  },
  "reactivationType": "resume",
  "membershipPeriod": {
    "from": "2024-01-15",
    "till": "2025-01-15"
  },
  "message": "Student reactivated with original membership dates",
  "timestamp": "2025-10-11T..."
}
```

### Business Logic:

#### Resume Type:
- Keeps the original `membership_date` unchanged
- Keeps the original `membership_till` unchanged
- Only updates `membership_status` to 'active'

#### Fresh Type:
- Updates `membership_date` to today's date
- Keeps the original `membership_till` unchanged
- Updates `membership_status` to 'active'

### Error Handling:
- Validates `reactivationType` parameter
- Returns 404 if student not found
- Returns 400 for invalid parameters
- Uses database transactions for data consistency