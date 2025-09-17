import React, { useState, useEffect } from 'react';
import { Container, Box, Typography, FormControl, InputLabel, Select, MenuItem, Paper, CircularProgress, Alert, Grid, Stack } from '@mui/material';
import UserActivity from '../components/UserActivity';
import { useAuth } from '../contexts/AuthContext';

export default function ActivityLog() {
  const { user } = useAuth();
  const [activities, setActivities] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(50);
  const [users, setUsers] = useState([]);
  const [selectedUser, setSelectedUser] = useState('');
  const [selectedType, setSelectedType] = useState('all');
  // responsive layout handled via MUI Grid/Stack props
  useEffect(() => {
    // Initial load (respect current filters)
    fetchActivities(0, selectedUser, selectedType);
  }, [pageSize]);

  // Refetch when page changes so filters persist across pagination
  useEffect(() => {
    fetchActivities(page, selectedUser, selectedType);
  }, [page]);

  useEffect(() => {
    // load users for the filter dropdown
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      const resp = await fetch('/api/admin/activity/users', { headers: { Authorization: `Bearer ${localStorage.getItem('authToken')}` } });
      if (!resp.ok) throw new Error('Failed to load users');
      const data = await resp.json();
      setUsers(data || []);
    } catch (err) {
      // non-fatal for activity view; show error in UI
      setError(err.message || 'Failed to load users');
    }
  };

  const fetchActivities = async (page = 0, userIdParam, typeParam) => {
    setLoading(true);
    setError(null);
    try {
      const qs = new URLSearchParams();
  // No filters: fetch full activity stream with pagination
      qs.set('page', page);
      qs.set('pageSize', pageSize);
      const userIdToSend = typeof userIdParam !== 'undefined' ? userIdParam : selectedUser;
      if (userIdToSend) qs.set('userId', userIdToSend);
      // include selected activity type for server-side filtering (use explicit param if provided)
      const typeToSend = typeof typeParam !== 'undefined' ? typeParam : selectedType || 'all';
      if (typeToSend && typeToSend !== 'all') qs.set('type', typeToSend);

      const resp = await fetch('/api/admin/activity?' + qs.toString(), { headers: { Authorization: `Bearer ${localStorage.getItem('authToken')}` } });
      if (!resp.ok) {
        const text = await resp.text();
        throw new Error(`Activity API error: ${resp.status} - ${text}`);
      }
  const json = await resp.json();
  setActivities(json.activities || []);
  setTotal(json.total || 0);
  setPage(Number(page));
    } catch (err) {
      setError(err.message || 'Failed to load activities');
    } finally {
      setLoading(false);
    }
  };

  if (!user || user.role !== 'admin') {
    return (
      <Container sx={{ mt: 4 }}>
        <Alert severity="warning">Admin access required to view activity logs.</Alert>
      </Container>
    );
  }

  return (
    <Container sx={{ mt: 3 }}>

      <Paper sx={{ p: 2, mb: 2 }}>
        <Grid container spacing={2} alignItems="center">
          <Grid item xs={12} md={12}>
            <Stack direction={{ xs: 'column', md: 'row' }} spacing={1} alignItems="center" justifyContent={{ xs: 'center', md: 'flex-start' }}>
              <FormControl size="small" sx={{ minWidth: 200, mr: { md: 2 } }}>
                <Select displayEmpty value={selectedType} onChange={(e) => { const v = e.target.value; setSelectedType(v); setPage(0); fetchActivities(0, selectedUser, v); }}>
                  <MenuItem value="all">(All types)</MenuItem>
                  <MenuItem value="student">Student</MenuItem>
                  <MenuItem value="seat">Seat</MenuItem>
                  <MenuItem value="payment">Payment</MenuItem>
                  <MenuItem value="expense">Expense</MenuItem>
                </Select>
              </FormControl>
              <FormControl size="small" sx={{ minWidth: 200 }}>
                <Select label="Actor" value={selectedUser} onChange={(e) => { const v = e.target.value; setSelectedUser(v); setPage(0); fetchActivities(0, v, selectedType); }} displayEmpty>
                  <MenuItem value="">(All users)</MenuItem>
                  {users.map(u => (
                    <MenuItem key={u.id} value={String(u.id)}>{u.username}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Stack>
          </Grid>
        </Grid>
      </Paper>

      {loading ? <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}><CircularProgress /></Box> : error ? <Alert severity="error">{error}</Alert> : (
        <>
          <UserActivity activities={activities} loading={loading} />
        </>
      )}
    </Container>
  );
}
