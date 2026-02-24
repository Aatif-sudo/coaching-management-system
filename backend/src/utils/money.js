function toMoneyNumber(value) {
  const n = Number(value || 0);
  return Number.isFinite(n) ? n : 0;
}

function formatMoney(value) {
  return toMoneyNumber(value).toFixed(2);
}

function sumPayments(payments) {
  return payments.reduce((acc, item) => acc + toMoneyNumber(item.amount), 0);
}

module.exports = {
  toMoneyNumber,
  formatMoney,
  sumPayments
};
