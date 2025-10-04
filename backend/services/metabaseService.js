const jwt = require('jsonwebtoken');
const logger = require('../utils/logger');
const constants = require('../config/constants');
const { pool } = require('../config/database');
const XLSX = require('xlsx');

/**
 * Metabase Integration Service
 * Provides embedded analytics, charts, and downloadable reports
 */
class MetabaseService {
  constructor() {
    this.metabaseUrl = process.env.METABASE_URL || constants.METABASE.DEFAULT_URL;
    this.metabaseSecret = process.env.METABASE_SECRET_KEY;
    this.metabaseApiUrl = process.env.METABASE_API_URL || constants.METABASE.DEFAULT_API_URL;
    this.isInitialized = false;
    this.sessionToken = null;
    this.sessionExpiry = null;
  }

  /**
   * Initialize Metabase service
   */
  async initialize() {
    try {
      // Check if Metabase is configured
      if (!this.metabaseUrl || this.metabaseUrl === 'http://localhost:3000') {
        logger.info('Running in standalone mode - Metabase not configured');
        this.isInitialized = true; // Enable standalone mode
        return true;
      }

      // Test connection to Metabase if configured
      const response = await fetch(`${this.metabaseUrl}/api/health`, { 
        timeout: 5000 
      });
      if (response.ok) {
        this.isInitialized = true;
        logger.info('Metabase service initialized successfully');
        return true;
      } else {
        logger.info('Metabase server not responding - running in standalone mode');
        this.isInitialized = true; // Enable standalone mode
        return true;
      }
    } catch (error) {
      logger.info('Metabase not available - running in standalone mode', { error: error.message });
      this.isInitialized = true; // Enable standalone mode
      return true;
    }
  }

  /**
   * Generate JWT token for embedded Metabase content
   */
  generateEmbedToken(payload, expiresIn = '24h') {
    if (!this.metabaseSecret) {
      throw new Error('Metabase secret key not configured');
    }

    return jwt.sign(payload, this.metabaseSecret, {
      algorithm: 'HS256',
      expiresIn
    });
  }

  /**
   * Get Metabase session token for API calls
   */
  async getSessionToken() {
    if (this.sessionToken && this.sessionExpiry && Date.now() < this.sessionExpiry) {
      return this.sessionToken;
    }

    try {
      // For demo purposes, we'll use a mock session token
      // In production, you'd authenticate with Metabase API
      this.sessionToken = 'demo-session-token';
      this.sessionExpiry = Date.now() + (23 * 60 * 60 * 1000); // 23 hours
      return this.sessionToken;
    } catch (error) {
      logger.error('Failed to get Metabase session token', { error: error.message });
      throw error;
    }
  }

  /**
   * Generate chart configuration for common data visualizations
   */
  generateChartConfig(data, chartType, options = {}) {
    const config = {
      type: chartType,
      data: data,
      options: {
        responsive: true,
        plugins: {
          title: {
            display: true,
            text: options.title || 'Chart'
          },
          legend: {
            display: options.showLegend !== false
          }
        },
        ...options.chartOptions
      }
    };

    switch (chartType) {
      case 'line':
        config.options.scales = {
          x: { display: true, title: { display: true, text: options.xLabel || 'X Axis' }},
          y: { display: true, title: { display: true, text: options.yLabel || 'Y Axis' }}
        };
        break;
      
      case 'bar':
        config.options.scales = {
          x: { display: true, title: { display: true, text: options.xLabel || 'Categories' }},
          y: { display: true, title: { display: true, text: options.yLabel || 'Values' }}
        };
        break;
      
      case 'pie':
      case 'doughnut':
        // Pie charts don't need scales
        break;
      
      default:
        break;
    }

    return config;
  }

  /**
   * Create downloadable report from SQL query results
   */
  async generateReport(sqlQuery, userId, format = 'csv', options = {}) {
    try {
      logger.info('Generating report', { userId, format, query: sqlQuery.substring(0, 100) + '...' });

      // Execute the SQL query
      const result = await pool.query(sqlQuery);
      
      if (!result.rows || result.rows.length === 0) {
        return {
          success: false,
          error: 'No data available for the report'
        };
      }

      const timestamp = new Date().toISOString().split('T')[0];
      const filename = options.filename || `report_${timestamp}.${format}`;

      let reportData;
      let mimeType;

      switch (format.toLowerCase()) {
        case 'csv':
          reportData = this.convertToCSV(result.rows);
          mimeType = 'text/csv';
          break;
        
        case 'json':
          reportData = JSON.stringify(result.rows, null, 2);
          mimeType = 'application/json';
          break;
        
        case 'xlsx':
          reportData = this.convertToExcel(result.rows);
          mimeType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
          break;
        
        default:
          throw new Error(`Unsupported format: ${format}`);
      }

      return {
        success: true,
        data: reportData,
        filename,
        mimeType,
        rowCount: result.rows.length
      };
    } catch (error) {
      logger.error('Failed to generate report', { error: error.message, userId });
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Convert data to CSV format
   */
  convertToCSV(data) {
    if (!data || data.length === 0) {
      return '';
    }

    const headers = Object.keys(data[0]);
    const csvHeaders = headers.join(',');
    
    const csvRows = data.map(row => {
      return headers.map(header => {
        const value = row[header];
        // Handle null/undefined values and escape commas/quotes
        if (value === null || value === undefined) {
          return '';
        }
        const stringValue = String(value);
        if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
          return `"${stringValue.replace(/"/g, '""')}"`;
        }
        return stringValue;
      }).join(',');
    });

    return [csvHeaders, ...csvRows].join('\n');
  }

  /**
   * Convert data to Excel format
   */
  convertToExcel(data) {
    if (!data || data.length === 0) {
      // Return empty workbook
      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.aoa_to_sheet([['No data available']]);
      XLSX.utils.book_append_sheet(wb, ws, 'Report');
      return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    }

    // Create workbook and worksheet
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(data);

    // Auto-size columns
    const range = XLSX.utils.decode_range(ws['!ref']);
    const colWidths = [];
    
    for (let C = range.s.c; C <= range.e.c; ++C) {
      let maxWidth = 10; // minimum width
      
      for (let R = range.s.r; R <= range.e.r; ++R) {
        const cellAddress = XLSX.utils.encode_cell({ c: C, r: R });
        const cell = ws[cellAddress];
        if (cell && cell.v) {
          const cellValueLength = String(cell.v).length;
          maxWidth = Math.max(maxWidth, cellValueLength);
        }
      }
      
      colWidths[C] = { width: Math.min(maxWidth + 2, 50) }; // max width 50
    }
    
    ws['!cols'] = colWidths;

    // Add worksheet to workbook
    XLSX.utils.book_append_sheet(wb, ws, 'Report');

    // Return as buffer
    return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
  }

  /**
   * Generate chart data from SQL results
   */
  generateChartData(data, chartConfig) {
    if (!data || data.length === 0) {
      return null;
    }

    const { xColumn, yColumn, groupColumn, chartType } = chartConfig;

    switch (chartType) {
      case 'line':
      case 'bar':
        return {
          labels: data.map(row => row[xColumn]),
          datasets: [{
            label: yColumn,
            data: data.map(row => row[yColumn]),
            backgroundColor: this.getChartColors(data.length),
            borderColor: this.getChartColors(data.length, 0.8)
          }]
        };
      
      case 'pie':
      case 'doughnut':
        return {
          labels: data.map(row => row[xColumn]),
          datasets: [{
            data: data.map(row => row[yColumn]),
            backgroundColor: this.getChartColors(data.length)
          }]
        };
      
      default:
        return {
          labels: data.map(row => row[xColumn]),
          datasets: [{
            label: 'Data',
            data: data.map(row => row[yColumn]),
            backgroundColor: this.getChartColors(data.length)
          }]
        };
    }
  }

  /**
   * Get chart colors for visualization
   */
  getChartColors(count, alpha = 1) {
    const colors = [
      `rgba(255, 99, 132, ${alpha})`,
      `rgba(54, 162, 235, ${alpha})`,
      `rgba(255, 205, 86, ${alpha})`,
      `rgba(75, 192, 192, ${alpha})`,
      `rgba(153, 102, 255, ${alpha})`,
      `rgba(255, 159, 64, ${alpha})`,
      `rgba(199, 199, 199, ${alpha})`,
      `rgba(83, 102, 255, ${alpha})`
    ];

    // Repeat colors if we need more than available
    const result = [];
    for (let i = 0; i < count; i++) {
      result.push(colors[i % colors.length]);
    }
    return result;
  }

  /**
   * Create embedded dashboard URL
   */
  createEmbeddedDashboardUrl(dashboardId, parameters = {}) {
    if (!this.metabaseSecret) {
      return null;
    }

    const payload = {
      resource: { dashboard: dashboardId },
      params: parameters,
      exp: Math.round(Date.now() / 1000) + (24 * 60 * 60) // 24 hours
    };

    const token = this.generateEmbedToken(payload);
    return `${this.metabaseUrl}/embed/dashboard/${token}#bordered=true&titled=true`;
  }

  /**
   * Create embedded question URL
   */
  createEmbeddedQuestionUrl(questionId, parameters = {}) {
    if (!this.metabaseSecret) {
      return null;
    }

    const payload = {
      resource: { question: questionId },
      params: parameters,
      exp: Math.round(Date.now() / 1000) + (24 * 60 * 60) // 24 hours
    };

    const token = this.generateEmbedToken(payload);
    return `${this.metabaseUrl}/embed/question/${token}#bordered=true&titled=true`;
  }

  /**
   * Get predefined report templates
   */
  getReportTemplates() {
    return {
      'student-summary': {
        name: 'Student Summary Report',
        description: 'Overview of all students with membership status',
        sql: 'SELECT id, name, email, phone, membership_status, membership_till, created_at FROM students ORDER BY created_at DESC',
        chartConfig: {
          type: 'pie',
          xColumn: 'membership_status',
          yColumn: 'count',
          title: 'Students by Membership Status'
        }
      },
      'payment-summary': {
        name: 'Payment Summary Report',
        description: 'Payment transactions and revenue analysis',
        sql: 'SELECT payment_date, amount, payment_method, status FROM payments ORDER BY payment_date DESC',
        chartConfig: {
          type: 'line',
          xColumn: 'payment_date',
          yColumn: 'amount',
          title: 'Payment Trends Over Time'
        }
      },
      'monthly-revenue': {
        name: 'Monthly Revenue Report',
        description: 'Revenue breakdown by month',
        sql: `SELECT 
                DATE_TRUNC('month', payment_date) as month,
                SUM(amount) as total_revenue,
                COUNT(*) as transaction_count
              FROM payments 
              WHERE status = 'completed'
              GROUP BY DATE_TRUNC('month', payment_date)
              ORDER BY month DESC`,
        chartConfig: {
          type: 'bar',
          xColumn: 'month',
          yColumn: 'total_revenue',
          title: 'Monthly Revenue'
        }
      },
      'seat-utilization': {
        name: 'Seat Utilization Report',
        description: 'Current seat occupancy and availability',
        sql: 'SELECT floor_number, COUNT(*) as total_seats, SUM(CASE WHEN is_occupied THEN 1 ELSE 0 END) as occupied_seats FROM seats GROUP BY floor_number ORDER BY floor_number',
        chartConfig: {
          type: 'bar',
          xColumn: 'floor_number',
          yColumn: 'occupied_seats',
          title: 'Seat Utilization by Floor'
        }
      }
    };
  }

  /**
   * Check if Metabase is available
   */
  isAvailable() {
    return this.isInitialized && !!this.metabaseSecret;
  }
}

module.exports = new MetabaseService();