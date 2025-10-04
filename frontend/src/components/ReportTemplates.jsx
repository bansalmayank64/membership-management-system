import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Paper,
  Grid,
  Button,
  Card,
  CardContent,
  CardActions,
  Chip,
  IconButton,
  Tooltip
} from '@mui/material';
import {
  Assessment as ReportIcon,
  BarChart as BarChartIcon,
  PieChart as PieChartIcon,
  ShowChart as LineChartIcon,
  Download as DownloadIcon,
  TableChart as TableIcon,
  TrendingUp as TrendingUpIcon,
  Group as GroupIcon,
  EventSeat as SeatIcon,
  AttachMoney as MoneyIcon
} from '@mui/icons-material';

const ReportTemplates = ({ onGenerateReport, onGenerateChart }) => {
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchTemplates();
  }, []);

  const fetchTemplates = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/reports/templates', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        setTemplates(data.templates || defaultTemplates);
      } else {
        setTemplates(defaultTemplates);
      }
    } catch (error) {
      console.error('Error fetching templates:', error);
      setTemplates(defaultTemplates);
    } finally {
      setLoading(false);
    }
  };

  const defaultTemplates = [
    {
      id: 'student-enrollment',
      title: 'Student Enrollment Report',
      description: 'Monthly student enrollment trends',
      query: 'Show student enrollment by month for the last 6 months',
      icon: <GroupIcon />,
      category: 'Students',
      charts: ['line', 'bar']
    },
    {
      id: 'seat-utilization',
      title: 'Seat Utilization Analysis',
      description: 'Seat occupancy rates and trends',
      query: 'Show seat utilization rates by day and time',
      icon: <SeatIcon />,
      category: 'Operations',
      charts: ['bar', 'line', 'pie']
    },
    {
      id: 'revenue-summary',
      title: 'Revenue Summary',
      description: 'Monthly revenue and payment analysis',
      query: 'Show monthly revenue trends and payment status breakdown',
      icon: <MoneyIcon />,
      category: 'Finance',
      charts: ['line', 'bar', 'pie']
    },
    {
      id: 'daily-attendance',
      title: 'Daily Attendance',
      description: 'Student attendance patterns',
      query: 'Show daily attendance for the last 30 days',
      icon: <TrendingUpIcon />,
      category: 'Analytics',
      charts: ['line', 'bar']
    },
    {
      id: 'membership-analysis',
      title: 'Membership Analysis',
      description: 'Membership types and status distribution',
      query: 'Show membership distribution by type and status',
      icon: <PieChartIcon />,
      category: 'Students',
      charts: ['pie', 'doughnut', 'bar']
    },
    {
      id: 'peak-hours',
      title: 'Peak Hours Analysis',
      description: 'Busiest times and capacity planning',
      query: 'Show hourly seat occupancy patterns',
      icon: <BarChartIcon />,
      category: 'Operations',
      charts: ['bar', 'line']
    }
  ];

  const getCategoryColor = (category) => {
    const colors = {
      'Students': 'primary',
      'Operations': 'secondary',
      'Finance': 'success',
      'Analytics': 'info'
    };
    return colors[category] || 'default';
  };

  const handleGenerateReport = async (template) => {
    if (onGenerateReport) {
      onGenerateReport(template.query);
    }
  };

  const handleGenerateChart = async (template, chartType) => {
    if (onGenerateChart) {
      // First generate the report data, then create chart
      onGenerateReport(`${template.query} for chart`);
      // Chart will be generated from the resulting data
    }
  };

  return (
    <Box sx={{ p: 2 }}>
      <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <ReportIcon />
        Report Templates
      </Typography>
      
      <Grid container spacing={2}>
        {templates.map((template) => (
          <Grid item xs={12} sm={6} md={4} key={template.id}>
            <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
              <CardContent sx={{ flex: 1 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                  {template.icon}
                  <Typography variant="h6" component="h3" sx={{ fontSize: '1rem' }}>
                    {template.title}
                  </Typography>
                </Box>
                
                <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                  {template.description}
                </Typography>
                
                <Chip 
                  label={template.category} 
                  size="small" 
                  color={getCategoryColor(template.category)}
                  sx={{ mb: 1 }}
                />
              </CardContent>
              
              <CardActions sx={{ flexDirection: 'column', alignItems: 'stretch', gap: 1, p: 2 }}>
                <Button
                  variant="contained"
                  startIcon={<TableIcon />}
                  onClick={() => handleGenerateReport(template)}
                  fullWidth
                  size="small"
                >
                  Generate Report
                </Button>
                
                <Box sx={{ display: 'flex', gap: 0.5 }}>
                  {template.charts.map((chartType) => (
                    <Tooltip key={chartType} title={`Generate ${chartType} chart`}>
                      <IconButton 
                        size="small"
                        onClick={() => handleGenerateChart(template, chartType)}
                        sx={{ flex: 1 }}
                      >
                        {chartType === 'bar' && <BarChartIcon />}
                        {chartType === 'line' && <LineChartIcon />}
                        {(chartType === 'pie' || chartType === 'doughnut') && <PieChartIcon />}
                      </IconButton>
                    </Tooltip>
                  ))}
                </Box>
              </CardActions>
            </Card>
          </Grid>
        ))}
      </Grid>
    </Box>
  );
};

export default ReportTemplates;