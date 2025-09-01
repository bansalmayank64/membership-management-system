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
  // responsive layout handled via MUI Grid/Stack props
  useEffect(() => {
    // Initial load
    fetchActivities(0);
  }, [pageSize]);

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

  const fetchActivities = async (page = 0, userIdParam) => {
    setLoading(true);
    setError(null);
    try {
      const qs = new URLSearchParams();
  // No filters: fetch full activity stream with pagination
      qs.set('page', page);
      qs.set('pageSize', pageSize);
      const userIdToSend = typeof userIdParam !== 'undefined' ? userIdParam : selectedUser;
      if (userIdToSend) qs.set('userId', userIdToSend);

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
          <Grid item xs={12} md={6}>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} alignItems="center" justifyContent="flex-end">
              <FormControl size="small" sx={{ minWidth: 160 }}>
                <Select label="Actor" value={selectedUser} onChange={(e) => { const v = e.target.value; setSelectedUser(v); setPage(0); fetchActivities(0, v); }} displayEmpty>
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
