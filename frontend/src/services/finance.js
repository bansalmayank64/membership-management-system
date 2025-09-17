// Lightweight finance helper to fetch detailed payments and expenses for a period
const API_BASE = '/api';

export async function getFinanceDetails({ startDate, endDate }) {
  // startDate/endDate expected as ISO date strings (YYYY-MM-DD) or timestamp; backend accepts ISO
  try {
    // Prefer server-side pre-aggregated detail endpoint for better performance
    const params = new URLSearchParams();
    if (startDate) params.set('startDate', startDate);
    if (endDate) params.set('endDate', endDate);

    try {
      const resp = await fetch(`${API_BASE}/finance/detail?${params.toString()}`, { headers: { 'Authorization': `Bearer ${localStorage.getItem('authToken')}` } });
      if (resp.ok) {
        const payload = await resp.json();
        return payload;
      }
      // If server returns 404 or not implemented, fallback to previous logic
    } catch (err) {
      // ignore and fallback
    }

    // Fallback: fetch payments and expenses in parallel and aggregate client-side.
    // The payments/expenses endpoints are paginated by default; request a large pageSize to get all items for the period.
    const fallbackParams = new URLSearchParams(params.toString());
    // request first page with large pageSize to include all items in one call for the selected period
    fallbackParams.set('page', '0');
    fallbackParams.set('pageSize', '100000');

    const [paymentsResp, expensesResp] = await Promise.all([
      fetch(`${API_BASE}/payments?${fallbackParams.toString()}`, { headers: { 'Authorization': `Bearer ${localStorage.getItem('authToken')}` } }),
      fetch(`${API_BASE}/expenses?${fallbackParams.toString()}`, { headers: { 'Authorization': `Bearer ${localStorage.getItem('authToken')}` } })
    ]);

    if (!paymentsResp.ok) throw new Error('Failed to fetch payments');
    if (!expensesResp.ok) throw new Error('Failed to fetch expenses');

    const paymentsPayload = await paymentsResp.json();
    const expensesPayload = await expensesResp.json();

    // payments endpoint returns { payments: [], total } when paginated; some calls return plain array
    const payments = Array.isArray(paymentsPayload) ? paymentsPayload : (paymentsPayload.payments || paymentsPayload);
    const expenses = Array.isArray(expensesPayload) ? expensesPayload : (expensesPayload.expenses || expensesPayload);

    const totalIncome = payments.reduce((s, p) => s + (Number(p.amount) || 0), 0);
    const totalExpenses = expenses.reduce((s, e) => s + (Number(e.amount) || 0), 0);

    // Grouping by category for expenses
    const expenseByCategory = expenses.reduce((acc, e) => {
      const key = e.category_name || e.category || 'Uncategorized';
      acc[key] = acc[key] || { category: key, amount: 0, items: [] };
      const amt = Number(e.amount) || 0;
      acc[key].amount += amt;
      acc[key].items.push(e);
      return acc;
    }, {});

    // Group payments by type (monthly_fee/refund) and by student
    const paymentsByType = payments.reduce((acc, p) => {
      const t = p.payment_type || 'other';
      acc[t] = acc[t] || { type: t, amount: 0, items: [] };
      const amt = Number(p.amount) || 0;
      acc[t].amount += amt;
      acc[t].items.push(p);
      return acc;
    }, {});

    return {
      payments,
      expenses,
      totalIncome,
      totalExpenses,
      net: totalIncome - totalExpenses,
      expenseByCategory: Object.values(expenseByCategory),
      paymentsByType: Object.values(paymentsByType)
    };
  } catch (err) {
    console.error('getFinanceDetails error', err);
    throw err;
  }
}

export default { getFinanceDetails };
