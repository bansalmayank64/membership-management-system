import React from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler
} from 'chart.js';
import { Bar, Line, Pie, Doughnut } from 'react-chartjs-2';
import { Box, Typography } from '@mui/material';

// Register Chart.js components
ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

const Chart = ({ data, chartType, title, height = 300 }) => {
  // Default chart options
  const defaultOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top',
      },
      title: {
        display: !!title,
        text: title,
      },
    },
  };

  // Convert data array to chart format
  const convertDataToChartFormat = (rawData, type) => {
    if (!rawData || !Array.isArray(rawData) || rawData.length === 0) {
      return { labels: [], datasets: [] };
    }

    const firstRow = rawData[0];
    const keys = Object.keys(firstRow);
    
    // For pie charts, use first two columns (label, value)
    if (type === 'pie' || type === 'doughnut') {
      const labelKey = keys[0];
      const valueKey = keys[1] || keys[0];
      
      return {
        labels: rawData.map(row => row[labelKey]),
        datasets: [{
          data: rawData.map(row => {
            const value = row[valueKey];
            return typeof value === 'number' ? value : parseFloat(value) || 0;
          }),
          backgroundColor: [
            '#FF6384',
            '#36A2EB',
            '#FFCE56',
            '#4BC0C0',
            '#9966FF',
            '#FF9F40',
            '#FF6384',
            '#C9CBCF'
          ],
          borderColor: [
            '#FF6384',
            '#36A2EB',
            '#FFCE56',
            '#4BC0C0',
            '#9966FF',
            '#FF9F40',
            '#FF6384',
            '#C9CBCF'
          ],
          borderWidth: 1
        }]
      };
    }

    // For bar and line charts
    const labelKey = keys[0];
    const dataKeys = keys.slice(1);
    
    const colors = ['#36A2EB', '#FF6384', '#FFCE56', '#4BC0C0', '#9966FF', '#FF9F40'];
    
    return {
      labels: rawData.map(row => row[labelKey]),
      datasets: dataKeys.map((key, index) => ({
        label: key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
        data: rawData.map(row => {
          const value = row[key];
          return typeof value === 'number' ? value : parseFloat(value) || 0;
        }),
        backgroundColor: type === 'line' ? 'transparent' : colors[index % colors.length],
        borderColor: colors[index % colors.length],
        borderWidth: 2,
        fill: type === 'line' ? false : true
      }))
    };
  };

  const chartData = convertDataToChartFormat(data, chartType);

  const renderChart = () => {
    switch (chartType) {
      case 'bar':
        return <Bar data={chartData} options={defaultOptions} />;
      case 'line':
        return <Line data={chartData} options={defaultOptions} />;
      case 'pie':
        return <Pie data={chartData} options={defaultOptions} />;
      case 'doughnut':
        return <Doughnut data={chartData} options={defaultOptions} />;
      default:
        return (
          <Box sx={{ 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center',
            height: '100%',
            bgcolor: 'grey.100',
            borderRadius: 1
          }}>
            <Typography variant="body2" color="text.secondary">
              Unsupported chart type: {chartType}
            </Typography>
          </Box>
        );
    }
  };

  if (!data || data.length === 0) {
    return (
      <Box sx={{ 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center',
        height,
        bgcolor: 'grey.100',
        borderRadius: 1
      }}>
        <Typography variant="body2" color="text.secondary">
          No data available for chart
        </Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ height, width: '100%' }}>
      {renderChart()}
    </Box>
  );
};

export default Chart;