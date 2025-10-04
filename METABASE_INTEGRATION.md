# Metabase Integration Features

This document describes the comprehensive Metabase integration features that enable advanced reporting, charting, and data export capabilities in the Study Room Management App.

## Overview

The application now includes a full-featured Metabase integration that provides:
- **Interactive Charts**: Generate bar charts, line charts, pie charts, and doughnut charts
- **Data Export**: Download reports in CSV, JSON, and Excel formats
- **Report Templates**: Pre-built report templates for common analytics needs
- **AI-Powered Reports**: Natural language queries that automatically generate charts and downloads
- **Embedded Dashboards**: Direct Metabase dashboard embedding (when available)

## Features

### 1. AI Chat Enhancements

The AI chat widget now automatically detects chart and download requests:

**Chart Keywords**: `chart`, `graph`, `visualization`, `plot`
- Example: "Show me a bar chart of monthly revenue"
- Automatically generates appropriate chart type based on data

**Download Keywords**: `download`, `export`, `csv`, `excel`, `xlsx`
- Example: "Download student enrollment data as CSV"
- Supports CSV, JSON, and Excel formats

**Example Queries**:
```
Download student enrollment data as CSV
Create a bar chart of monthly revenue
Export payment status report to Excel
Generate pie chart of seat utilization
Show line chart of daily attendance trends
```

### 2. Interactive Chart Generation

From any data table in the AI chat:
- **Bar Chart**: Click the "Bar Chart" button
- **Line Chart**: Click the "Line Chart" button  
- **Pie Chart**: Click the "Pie Chart" button
- **Doughnut Chart**: Click the "Doughnut" button

Charts are automatically configured based on your data structure:
- First column becomes labels (X-axis)
- Remaining columns become data series
- Appropriate colors and formatting applied

### 3. Data Export Options

From any data table in the AI chat:
- **CSV Export**: Click the "CSV" button
- **Excel Export**: Click the "Excel" button
- Files are automatically downloaded with proper naming

### 4. Report Templates

Navigate to the "Reports" tab in the AI chat widget to access pre-built templates:

#### Available Templates:
1. **Student Enrollment Report**
   - Monthly enrollment trends
   - Available charts: Line, Bar
   
2. **Seat Utilization Analysis**
   - Occupancy rates and patterns
   - Available charts: Bar, Line, Pie
   
3. **Revenue Summary**
   - Monthly revenue and payment analysis
   - Available charts: Line, Bar, Pie
   
4. **Daily Attendance**
   - Student attendance patterns
   - Available charts: Line, Bar
   
5. **Membership Analysis**
   - Distribution by type and status
   - Available charts: Pie, Doughnut, Bar
   
6. **Peak Hours Analysis**
   - Capacity planning insights
   - Available charts: Bar, Line

### 5. API Endpoints

#### Generate Report
```
POST /api/reports/generate
Content-Type: application/json
Authorization: Bearer <token>

{
  "data": [...],
  "format": "csv|xlsx|json",
  "filename": "report_name"
}
```

#### Generate Chart
```
POST /api/reports/chart
Content-Type: application/json
Authorization: Bearer <token>

{
  "data": [...],
  "chartType": "bar|line|pie|doughnut",
  "options": {
    "responsive": true,
    "maintainAspectRatio": false
  }
}
```

#### Get Templates
```
GET /api/reports/templates
Authorization: Bearer <token>
```

#### Embedded Dashboard
```
GET /api/reports/dashboard/:id
Authorization: Bearer <token>
```

## Configuration

### Environment Variables

Create these variables in your `.env` file (if using external Metabase):

```env
METABASE_URL=http://localhost:3000
METABASE_USERNAME=admin@company.com
METABASE_PASSWORD=password123
METABASE_SECRET_KEY=your-secret-key
```

### Constants Configuration

The app uses centralized configuration in `backend/config/constants.js`:

```javascript
METABASE: {
  URL: process.env.METABASE_URL || 'http://localhost:3000',
  USERNAME: process.env.METABASE_USERNAME || '',
  PASSWORD: process.env.METABASE_PASSWORD || '',
  SECRET_KEY: process.env.METABASE_SECRET_KEY || '',
  JWT_EXPIRY: 3600, // 1 hour
  DEFAULT_DASHBOARD_ID: 1,
  TIMEOUT: 30000 // 30 seconds
}
```

## Usage Examples

### 1. Basic Chart Generation

```javascript
// In AI chat, type:
"Show me a bar chart of student enrollment by month"

// This will:
// 1. Execute SQL query for enrollment data
// 2. Display data table with action buttons
// 3. Click "Bar Chart" to generate visualization
```

### 2. Data Export

```javascript
// In AI chat, type:
"Download payment summary as Excel"

// This will:
// 1. Generate payment summary data
// 2. Automatically trigger Excel download
// 3. File saved as "payment_summary.xlsx"
```

### 3. Using Report Templates

```javascript
// 1. Click "Reports" tab in AI chat widget
// 2. Select "Revenue Summary" template
// 3. Click "Generate Report" or chart icon
// 4. Automatically switches to chat with results
```

## Technical Implementation

### Backend Services

1. **MetabaseService** (`backend/services/metabaseService.js`)
   - JWT token generation
   - Report generation
   - Chart data processing
   - CSV/Excel conversion

2. **Reports Routes** (`backend/routes/reports.js`)
   - REST API endpoints
   - Authentication middleware
   - File download handling

3. **AI Chat Integration** (`backend/services/aiChatService.js`)
   - Keyword detection
   - Automatic report generation
   - Chart type inference

### Frontend Components

1. **Chart Component** (`frontend/src/components/Chart.jsx`)
   - Chart.js integration
   - Multiple chart types
   - Responsive design

2. **ReportTemplates Component** (`frontend/src/components/ReportTemplates.jsx`)
   - Pre-built template library
   - Category-based organization
   - Quick chart generation

3. **Enhanced AI Chat Widget** (`frontend/src/components/AIChatWidget.jsx`)
   - Chart and download buttons
   - Integrated report templates
   - Automatic feature detection

## Error Handling

The system includes comprehensive error handling:

1. **Graceful Degradation**: If Metabase is unavailable, basic chart generation still works
2. **Retry Logic**: Automatic retry for temporary connection issues
3. **Fallback Charts**: Client-side chart generation when server fails
4. **User Feedback**: Clear error messages and loading states

## Performance Considerations

1. **Lazy Loading**: Chart.js loaded only when needed
2. **Data Limits**: Large datasets are paginated in UI
3. **Caching**: Report templates cached for performance
4. **Background Processing**: Long-running exports handled asynchronously

## Security

1. **JWT Authentication**: All API endpoints require valid tokens
2. **Rate Limiting**: Prevents abuse of export features
3. **Data Validation**: Input sanitization for all requests
4. **Access Control**: User-based permissions for sensitive reports

## Troubleshooting

### Common Issues

1. **Charts not displaying**
   - Check browser console for JavaScript errors
   - Verify Chart.js library loaded correctly
   - Ensure data format is valid

2. **Downloads not working**
   - Check browser popup blockers
   - Verify file permissions
   - Check API endpoint availability

3. **Templates not loading**
   - Verify backend service is running
   - Check authentication token validity
   - Review server logs for errors

### Debug Mode

Enable verbose logging in constants.js:
```javascript
DEBUG: true
```

This will log all API calls, data transformations, and error details to the console.

## Future Enhancements

1. **Real-time Dashboards**: Live data updates
2. **Custom Chart Types**: Additional visualization options
3. **Scheduled Reports**: Automated report generation
4. **Data Connectors**: Integration with external data sources
5. **Advanced Analytics**: Machine learning insights

## Support

For technical support or feature requests:
1. Check the application logs for error details
2. Verify configuration settings
3. Test with sample data
4. Contact the development team with specific error messages

---

*Last updated: [Current Date]*
*Version: 1.0.0*