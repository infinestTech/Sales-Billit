// Utility to handle unauthorized responses globally
export function handleUnauthorized(response) {
  if (response.status === 401) {
    localStorage.removeItem('sales_token');
    localStorage.removeItem('branch_token');
    window.location.href = '/sales-login';
    return true;
  }
  return false;
}
