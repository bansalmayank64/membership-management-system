const express = require('express');
const router = express.Router();
const metabaseService = require('../services/metabaseService');
const auth = require('../middleware/auth');
const logger = require('../utils/logger');

/**
 * Download data as file
 * POST /api/reports/download
 */
router.post('/download', auth, async (req, res) => {
  try {
    const { data, format = 'csv', filename = 'report' } = req.body;
    const userId = req.user.id;

    if (!data || !Array.isArray(data)) {
      return res.status(400).json({
        success: false,
        message: 'Data array is required'
      });
    }

    if (data.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Data array cannot be empty'
      });
    }

    // Generate file content based on format
    let fileContent;
    let mimeType;
    let fileExtension;

    if (format === 'csv') {
      // Convert data to CSV
      const headers = Object.keys(data[0]);
      const csvRows = [
        headers.join(','), // Header row
        ...data.map(row => headers.map(header => {
          const value = row[header];
          // Escape commas and quotes in CSV values
          if (typeof value === 'string' && (value.includes(',') || value.includes('"'))) {
            return `"${value.replace(/"/g, '""')}"`;
          }
          return value;
        }).join(','))
      ];
      fileContent = csvRows.join('\n');
      mimeType = 'text/csv';
      fileExtension = 'csv';
    } else if (format === 'xlsx') {
      try {
        const XLSX = require('xlsx');
        
        // Create workbook and worksheet
        const workbook = XLSX.utils.book_new();
        const worksheet = XLSX.utils.json_to_sheet(data);
        
        // Add worksheet to workbook
        XLSX.utils.book_append_sheet(workbook, worksheet, 'Query Results');
        
        // Generate Excel buffer
        fileContent = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
        mimeType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
        fileExtension = 'xlsx';
        
        logger.info('Excel data download generated successfully', { userId, format });
      } catch (error) {
        logger.error(`Error generating Excel file: ${error.message}`, { userId, error: error.stack });
        return res.status(500).json({
          success: false,
          message: 'Failed to generate Excel file. Please try CSV format.'
        });
      }
    } else {
      return res.status(400).json({
        success: false,
        message: 'Unsupported format. Use csv or xlsx.'
      });
    }

    // Set appropriate headers for file download
    const finalFilename = `${filename}.${fileExtension}`;
    res.setHeader('Content-Type', mimeType);
    res.setHeader('Content-Disposition', `attachment; filename="${finalFilename}"`);
    res.setHeader('X-Report-Rows', data.length);

    logger.info('Data download generated successfully', { 
      userId, 
      format, 
      filename: finalFilename, 
      rows: data.length 
    });

    res.send(fileContent);
  } catch (error) {
    logger.error('Failed to generate data download', { error: error.message, userId: req.user?.id });
    res.status(500).json({
      success: false,
      message: 'Failed to generate data download',
      error: error.message
    });
  }
});

/**
 * Generate and download a report
 * POST /api/reports/generate
 */
router.post('/generate', auth, async (req, res) => {
  try {
    const { sqlQuery, format = 'csv', filename, chartConfig } = req.body;
    const userId = req.user.id;

    if (!sqlQuery) {
      return res.status(400).json({
        success: false,
        message: 'SQL query is required'
      });
    }

    // Validate that it's a safe SELECT query
    const normalizedQuery = sqlQuery.trim().toLowerCase();
    if (!normalizedQuery.startsWith('select')) {
      return res.status(400).json({
        success: false,
        message: 'Only SELECT queries are allowed for reports'
      });
    }

    const report = await metabaseService.generateReport(sqlQuery, userId, format, { filename });

    if (!report.success) {
      return res.status(400).json({
        success: false,
        message: report.error
      });
    }

    // Set appropriate headers for file download
    res.setHeader('Content-Type', report.mimeType);
    res.setHeader('Content-Disposition', `attachment; filename="${report.filename}"`);
    res.setHeader('X-Report-Rows', report.rowCount);

    logger.info('Report generated successfully', { 
      userId, 
      format, 
      filename: report.filename, 
      rows: report.rowCount 
    });

    res.send(report.data);
  } catch (error) {
    logger.error('Failed to generate report', { error: error.message, userId: req.user?.id });
    res.status(500).json({
      success: false,
      message: 'Failed to generate report',
      error: error.message
    });
  }
});

/**
 * Generate chart data from SQL query
 * POST /api/reports/chart
 */
router.post('/chart', auth, async (req, res) => {
  try {
    const { sqlQuery, chartConfig } = req.body;
    const userId = req.user.id;

    if (!sqlQuery || !chartConfig) {
      return res.status(400).json({
        success: false,
        message: 'SQL query and chart configuration are required'
      });
    }

    // Validate that it's a safe SELECT query
    const normalizedQuery = sqlQuery.trim().toLowerCase();
    if (!normalizedQuery.startsWith('select')) {
      return res.status(400).json({
        success: false,
        message: 'Only SELECT queries are allowed for charts'
      });
    }

    // Execute the SQL query
    const { pool } = require('../config/database');
    const result = await pool.query(sqlQuery);

    if (!result.rows || result.rows.length === 0) {
      return res.json({
        success: true,
        message: 'No data available for chart',
        chartData: null,
        chartConfig: null
      });
    }

    // Generate chart data
    const chartData = metabaseService.generateChartData(result.rows, chartConfig);
    const fullChartConfig = metabaseService.generateChartConfig(chartData, chartConfig.chartType, {
      title: chartConfig.title,
      xLabel: chartConfig.xLabel,
      yLabel: chartConfig.yLabel,
      showLegend: chartConfig.showLegend
    });

    logger.info('Chart data generated successfully', { 
      userId, 
      chartType: chartConfig.chartType, 
      dataPoints: result.rows.length 
    });

    res.json({
      success: true,
      chartData,
      chartConfig: fullChartConfig,
      rowCount: result.rows.length
    });
  } catch (error) {
    logger.error('Failed to generate chart', { error: error.message, userId: req.user?.id });
    res.status(500).json({
      success: false,
      message: 'Failed to generate chart data',
      error: error.message
    });
  }
});

/**
 * Get predefined report templates
 * GET /api/reports/templates
 */
router.get('/templates', auth, async (req, res) => {
  try {
    const templates = metabaseService.getReportTemplates();
    
    res.json({
      success: true,
      templates
    });
  } catch (error) {
    logger.error('Failed to get report templates', { error: error.message });
    res.status(500).json({
      success: false,
      message: 'Failed to get report templates',
      error: error.message
    });
  }
});

/**
 * Generate report from template
 * POST /api/reports/template/:templateId
 */
router.post('/template/:templateId', auth, async (req, res) => {
  try {
    const { templateId } = req.params;
    const { format = 'csv', parameters = {} } = req.body;
    const userId = req.user.id;

    const templates = metabaseService.getReportTemplates();
    const template = templates[templateId];

    if (!template) {
      return res.status(404).json({
        success: false,
        message: 'Report template not found'
      });
    }

    // Replace parameters in SQL if any
    let sql = template.sql;
    Object.keys(parameters).forEach(key => {
      sql = sql.replace(new RegExp(`{{${key}}}`, 'g'), parameters[key]);
    });

    const report = await metabaseService.generateReport(sql, userId, format, {
      filename: `${templateId}_${new Date().toISOString().split('T')[0]}.${format}`
    });

    if (!report.success) {
      return res.status(400).json({
        success: false,
        message: report.error
      });
    }

    // Set appropriate headers for file download
    res.setHeader('Content-Type', report.mimeType);
    res.setHeader('Content-Disposition', `attachment; filename="${report.filename}"`);
    res.setHeader('X-Report-Rows', report.rowCount);

    logger.info('Template report generated successfully', { 
      userId, 
      templateId, 
      format, 
      rows: report.rowCount 
    });

    res.send(report.data);
  } catch (error) {
    logger.error('Failed to generate template report', { 
      error: error.message, 
      userId: req.user?.id,
      templateId: req.params.templateId 
    });
    res.status(500).json({
      success: false,
      message: 'Failed to generate template report',
      error: error.message
    });
  }
});

/**
 * Get embedded dashboard URL
 * GET /api/reports/dashboard/:dashboardId
 */
router.get('/dashboard/:dashboardId', auth, async (req, res) => {
  try {
    const { dashboardId } = req.params;
    const parameters = req.query;

    if (!metabaseService.isAvailable()) {
      return res.status(503).json({
        success: false,
        message: 'Metabase service not available'
      });
    }

    const embeddedUrl = metabaseService.createEmbeddedDashboardUrl(dashboardId, parameters);

    if (!embeddedUrl) {
      return res.status(400).json({
        success: false,
        message: 'Unable to generate embedded dashboard URL'
      });
    }

    res.json({
      success: true,
      embeddedUrl
    });
  } catch (error) {
    logger.error('Failed to get embedded dashboard URL', { error: error.message });
    res.status(500).json({
      success: false,
      message: 'Failed to get embedded dashboard URL',
      error: error.message
    });
  }
});

/**
 * Get embedded question URL
 * GET /api/reports/question/:questionId
 */
router.get('/question/:questionId', auth, async (req, res) => {
  try {
    const { questionId } = req.params;
    const parameters = req.query;

    if (!metabaseService.isAvailable()) {
      return res.status(503).json({
        success: false,
        message: 'Metabase service not available'
      });
    }

    const embeddedUrl = metabaseService.createEmbeddedQuestionUrl(questionId, parameters);

    if (!embeddedUrl) {
      return res.status(400).json({
        success: false,
        message: 'Unable to generate embedded question URL'
      });
    }

    res.json({
      success: true,
      embeddedUrl
    });
  } catch (error) {
    logger.error('Failed to get embedded question URL', { error: error.message });
    res.status(500).json({
      success: false,
      message: 'Failed to get embedded question URL',
      error: error.message
    });
  }
});

/**
 * Get Metabase service status
 * GET /api/reports/status
 */
router.get('/status', auth, async (req, res) => {
  try {
    const isAvailable = metabaseService.isAvailable();
    const status = await metabaseService.initialize();

    res.json({
      success: true,
      metabaseAvailable: isAvailable,
      metabaseUrl: metabaseService.metabaseUrl,
      serviceStatus: status ? 'connected' : 'disconnected'
    });
  } catch (error) {
    logger.error('Failed to get Metabase status', { error: error.message });
    res.status(500).json({
      success: false,
      message: 'Failed to get Metabase status',
      error: error.message
    });
  }
});

module.exports = router;