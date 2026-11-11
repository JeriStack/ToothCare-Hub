/**
 * Format monetary amount into Philippine Peso (PHP)
 * @param {number|string} amount
 * @returns {string} e.g. "₱1,500.00"
 */
export function formatCurrency(amount) {
  const numeric = typeof amount === 'number' ? amount : parseFloat(amount);
  if (isNaN(numeric)) {
    return '₱0.00';
  }

  return new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency: 'PHP',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(numeric);
}

export default formatCurrency;
