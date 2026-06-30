// ──────────────────────────────────────────────
// script.js — MoneyTrack UI Logic
// ──────────────────────────────────────────────

// Lucide icons will be initialized after DOM is ready inside init()
if (!window.lucide) {
  window.lucide = { createIcons: function () {} };
}

// ── CONSTANTS & HELPERS ───────────────────────
const DEFAULT_CATEGORIES = {
  expense: ['Makan', 'Transportasi', 'Tagihan', 'Belanja', 'Kesehatan', 'Pendidikan', 'Lain-lain'],
  income: ['Gaji', 'Hadiah', 'Freelance', 'Investasi', 'Lain-lain'],
};

let currentPage = 'home';
let historyFilters = {
  type: 'all',
  category: 'all',
  startDate: '',
  endDate: '',
};
let reportFilters = {
  month: new Date().getMonth() + 1,
  year: new Date().getFullYear(),
  startDate: '',
  endDate: '',
};

function getSettings() {
  try { return JSON.parse(localStorage.getItem('moneytrack_settings') || '{}'); }
  catch (e) { return {}; }
}

function saveSettingsData(data) {
  localStorage.setItem('moneytrack_settings', JSON.stringify(data));
}

function getCategories() {
  try {
    const saved = JSON.parse(localStorage.getItem('moneytrack_categories') || 'null');
    if (!saved || !Array.isArray(saved.expense) || !Array.isArray(saved.income)) return structuredClone(DEFAULT_CATEGORIES);
    return {
      expense: [...new Set([...DEFAULT_CATEGORIES.expense, ...saved.expense])],
      income: [...new Set([...DEFAULT_CATEGORIES.income, ...saved.income])],
    };
  } catch (e) {
    return structuredClone(DEFAULT_CATEGORIES);
  }
}

function saveCategories(categories) {
  localStorage.setItem('moneytrack_categories', JSON.stringify(categories));
}

function getAllCategoryOptions() {
  const categories = getCategories();
  return [...new Set([...categories.expense, ...categories.income])].sort((a, b) => a.localeCompare(b, 'id-ID'));
}

function formatRupiah(amount) {
  const safeAmount = Number(amount) || 0;
  return 'Rp ' + Math.abs(safeAmount).toLocaleString('id-ID');
}

function formatCurrency(amount) { return formatRupiah(amount); }
function currencySymbol() { return 'Rp'; }

function parseRupiahInput(value) {
  return Number(String(value || '').replace(/\./g, '').replace(/,/g, '').replace(/\D/g, '')) || 0;
}

function formatDateID(dateValue) {
  if (!dateValue) return '-';
  return new Date(dateValue).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
}

function safeText(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function validateTransactionInput({ type, category, amount, date, note }) {
  const errors = [];
  if (!['income', 'expense'].includes(type)) errors.push('Jenis transaksi tidak valid.');
  if (!category || category.trim().length < 2) errors.push('Kategori wajib dipilih.');
  if (!amount || Number(amount) <= 0) errors.push('Nominal harus lebih dari 0.');
  if (Number(amount) > 999999999999) errors.push('Nominal terlalu besar. Periksa ulang input.');
  if (!date) errors.push('Tanggal wajib diisi.');
  if (note && note.length > 150) errors.push('Catatan maksimal 150 karakter.');
  return errors;
}

function showErrors(errors) {
  if (!errors || errors.length === 0) return;
  alert(errors.join('\n'));
}

function fallbackChartMessage(canvasId, message) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;
  const parent = canvas.parentElement;
  if (!parent) return;
  canvas.style.display = 'none';
  let info = parent.querySelector('[data-chart-fallback="' + canvasId + '"]');
  if (!info) {
    info = document.createElement('div');
    info.dataset.chartFallback = canvasId;
    info.className = 'text-sm text-slate-500 py-8 text-center';
    parent.appendChild(info);
  }
  info.textContent = message || 'Chart.js belum berhasil dimuat.';
}

function downloadTextFile(filename, content, type = 'text/plain;charset=utf-8;') {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function refreshCurrentPage() {
  if (currentPage === 'home') renderHome();
  if (currentPage === 'history') renderHistory();
  if (currentPage === 'report') renderReport();
  if (currentPage === 'setting-page') renderSetting();
}

// ── Sidebar ──────────────────────────────────
const sidebar = document.getElementById('sidebar');
const sidebarOverlay = document.getElementById('sidebarOverlay');
const openSidebar = document.getElementById('openSidebar');
const closeSidebar = document.getElementById('closeSidebar');
const sidebarLinks = document.querySelectorAll('.sidebar-link');
const pageSections = document.querySelectorAll('.page');

function showSidebar() {
  sidebar.classList.remove('-translate-x-full');
  sidebarOverlay.classList.remove('hidden');
}
function hideSidebar() {
  sidebar.classList.add('-translate-x-full');
  sidebarOverlay.classList.add('hidden');
}

openSidebar.addEventListener('click', showSidebar);
closeSidebar.addEventListener('click', hideSidebar);
sidebarOverlay.addEventListener('click', hideSidebar);

// ── Navigation ───────────────────────────────
function showPage(pageId) {
  currentPage = pageId;
  pageSections.forEach((s) => {
    s.classList.add('hidden');
    s.classList.remove('active');
  });

  const target = document.getElementById(pageId);
  if (target) {
    target.classList.remove('hidden');
    target.classList.add('active');
  }

  sidebarLinks.forEach((link) => {
    link.classList.remove('sidebar-active');
    link.style.color = '#475569';
    if (link.dataset.page === pageId) link.classList.add('sidebar-active');
  });

  if (pageId === 'home') renderHome();
  if (pageId === 'history') renderHistory();
  if (pageId === 'report') renderReport();
  if (pageId === 'setting-page') renderSetting();
}

sidebarLinks.forEach((link) => {
  link.addEventListener('click', function (e) {
    e.preventDefault();
    showPage(this.dataset.page);
    hideSidebar();
  });
});

document.getElementById('setting').addEventListener('click', () => showPage('setting-page'));

// ── Kategori Dinamis ─────────────────────────
const inputType = document.getElementById('inputType');
const inputCategory = document.getElementById('inputCategory');
const editType = document.getElementById('editType');
const editCategory = document.getElementById('editCategory');

function renderCategoryOptions(type, target = inputCategory, selected = '') {
  const categories = getCategories();
  target.innerHTML = '<option value="">Pilih kategori</option>';
  (categories[type] || []).forEach((cat) => {
    const opt = document.createElement('option');
    opt.value = cat;
    opt.textContent = cat;
    if (selected === cat) opt.selected = true;
    target.appendChild(opt);
  });
}

function renderHistoryCategoryFilter(selected = 'all') {
  const categoryFilter = document.getElementById('categoryFilter');
  if (!categoryFilter) return;
  categoryFilter.innerHTML = '<option value="all">Semua kategori</option>';
  getAllCategoryOptions().forEach((cat) => {
    const opt = document.createElement('option');
    opt.value = cat;
    opt.textContent = cat;
    if (selected === cat) opt.selected = true;
    categoryFilter.appendChild(opt);
  });
}

inputType.addEventListener('change', function () { renderCategoryOptions(this.value); });
editType.addEventListener('change', function () { renderCategoryOptions(this.value, editCategory); });

// ── Charts (refs) ─────────────────────────────
let financeChartInstance = null;
let yearlyExpenseInstance = null;
let categoryDonutInstance = null;
let dailyExpenseInstance = null;
let categoryBarInstance = null;
let savingsTrendInstance = null;
function destroyChart(i) { if (i) i.destroy(); return null; }

// ── HOME ──────────────────────────────────────
async function renderHome() {
  const s = getSettings();
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;

  const monthTx = await getTransactionsByMonth(year, month);
  const allTx = await getAllTransactions();
  const { income, expense } = calcSummary(monthTx);
  const totalSummary = calcSummary(allTx);

  document.getElementById('cardBalance').textContent = formatCurrency(totalSummary.balance);
  document.getElementById('cardIncome').textContent = formatCurrency(income);
  document.getElementById('cardExpense').textContent = formatCurrency(expense);

  const bulanLabel = now.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' });
  document.getElementById('cardIncomeLabel').textContent = bulanLabel;
  document.getElementById('cardExpenseLabel').textContent = bulanLabel;

  const budgetWarn = document.getElementById('budgetWarning');
  if (budgetWarn) {
    if (s.notifBudget !== false && s.budget && s.budget > 0) {
      const pct = Math.round((expense / s.budget) * 100);
      if (pct >= 80) {
        budgetWarn.classList.remove('hidden');
        budgetWarn.textContent = pct >= 100
          ? `Pengeluaran bulan ini sudah melampaui budget. (${formatCurrency(expense)} / ${formatCurrency(s.budget)})`
          : `Budget hampir habis. ${pct}% terpakai (${formatCurrency(expense)} / ${formatCurrency(s.budget)})`;
      } else {
        budgetWarn.classList.add('hidden');
      }
    } else {
      budgetWarn.classList.add('hidden');
    }
  }

  await renderFinanceChart(year, month);
}

async function renderFinanceChart(year, month) {
  if (!window.Chart) {
    fallbackChartMessage('financeChart', 'Chart.js belum berhasil dimuat. Data tetap tersimpan, tetapi grafik tidak tampil.');
    return;
  }

  const labels = [], incomes = [], expenses = [];
  const sym = currencySymbol();

  for (let i = 5; i >= 0; i--) {
    let m = month - i, y = year;
    if (m <= 0) { m += 12; y -= 1; }
    const tx = await getTransactionsByMonth(y, m);
    const s = calcSummary(tx);
    labels.push(new Date(y, m - 1).toLocaleDateString('id-ID', { month: 'short' }));
    incomes.push(s.income);
    expenses.push(s.expense);
  }

  financeChartInstance = destroyChart(financeChartInstance);
  financeChartInstance = new Chart(document.getElementById('financeChart'), {
    type: 'line',
    data: {
      labels,
      datasets: [
        { label: 'Pemasukan', data: incomes, borderColor: '#16a34a', backgroundColor: 'rgba(22,163,74,0.08)', borderWidth: 2, tension: 0.4, fill: true, pointBackgroundColor: '#16a34a', pointRadius: 4 },
        { label: 'Pengeluaran', data: expenses, borderColor: '#ea580c', backgroundColor: 'rgba(234,88,12,0.08)', borderWidth: 2, tension: 0.4, fill: true, pointBackgroundColor: '#ea580c', pointRadius: 4 },
      ],
    },
    options: {
      responsive: true,
      plugins: { legend: { position: 'bottom', labels: { color: '#475569', boxWidth: 12, padding: 16 } } },
      scales: {
        y: { ticks: { callback: (v) => sym + ' ' + v.toLocaleString('id-ID'), color: '#64748b' }, grid: { color: '#e5e7eb' } },
        x: { grid: { display: false }, ticks: { color: '#64748b' } },
      },
    },
  });
}

// ── FORM ADD TRANSACTION ──────────────────────
document.getElementById('transactionForm').addEventListener('submit', async (e) => {
  e.preventDefault();

  const type = document.getElementById('inputType').value;
  const category = document.getElementById('inputCategory').value;
  const amount = parseRupiahInput(document.getElementById('inputAmount').value);
  const date = document.getElementById('inputDate').value;
  const note = document.getElementById('inputNote').value.trim();

  const errors = validateTransactionInput({ type, category, amount, date, note });
  if (errors.length) { showErrors(errors); return; }

  await addTransaction({ type, category, amount, date, note });

  e.target.reset();
  renderCategoryOptions(inputType.value);
  showToast('Transaksi berhasil disimpan.');
  renderHome();
  renderHistoryCategoryFilter(historyFilters.category);
});

// ── HISTORY ───────────────────────────────────
function applyHistoryFilters(transactions) {
  return transactions.filter((t) => {
    const matchType = historyFilters.type === 'all' || t.type === historyFilters.type;
    const matchCategory = historyFilters.category === 'all' || t.category === historyFilters.category;
    const matchStart = !historyFilters.startDate || t.date >= historyFilters.startDate;
    const matchEnd = !historyFilters.endDate || t.date <= historyFilters.endDate;
    return matchType && matchCategory && matchStart && matchEnd;
  });
}

async function renderHistory() {
  renderHistoryCategoryFilter(historyFilters.category);

  const allTx = await getAllTransactions();
  const filtered = applyHistoryFilters(allTx);

  const tbody = document.getElementById('historyTableBody');
  const mobileWrap = document.getElementById('historyMobileCards');
  tbody.innerHTML = '';
  if (mobileWrap) mobileWrap.innerHTML = '';

  if (filtered.length === 0) {
    const emptyHtml = `
      <div class="text-center py-10">
        <p class="font-bold text-slate-800">Belum ada transaksi</p>
        <p class="text-sm text-slate-500 mt-1">Data belum tersedia atau tidak sesuai dengan filter.</p>
      </div>`;
    tbody.innerHTML = `<tr><td colspan="6" class="px-6 py-10 text-center text-sm text-slate-500">Belum ada transaksi atau hasil filter kosong.</td></tr>`;
    if (mobileWrap) mobileWrap.innerHTML = emptyHtml;
    return;
  }

  filtered.forEach((t) => {
    const dateStr = formatDateID(t.date);
    const isIncome = t.type === 'income';
    const badgeClass = isIncome ? 'badge-income' : 'badge-expense';
    const badgeLabel = isIncome ? 'Pemasukan' : 'Pengeluaran';
    const amountStyle = isIncome ? 'color:#16a34a;' : 'color:#ea580c;';
    const sign = isIncome ? '+' : '-';
    const noteHtml = t.note
      ? `<span class="text-xs" style="color:#475569;">${safeText(t.note)}</span>`
      : `<span class="text-xs italic" style="color:#94a3b8;">—</span>`;

    tbody.innerHTML += `
      <tr class="transition" style="border-bottom:1px solid #e5e7eb;" onmouseover="this.style.background='#f8fafc'" onmouseout="this.style.background='transparent'">
        <td class="px-5 py-4 text-sm" style="color:#475569;">${dateStr}</td>
        <td class="px-5 py-4 font-semibold text-sm" style="color:#0f172a;">${safeText(t.category)}</td>
        <td class="px-5 py-4"><span class="px-3 py-1 rounded-full text-xs font-medium ${badgeClass}">${badgeLabel}</span></td>
        <td class="px-6 py-4 text-right font-semibold" style="${amountStyle}">${sign} ${formatCurrency(t.amount)}</td>
        <td class="px-5 py-4">${noteHtml}</td>
        <td class="px-5 py-4 text-center">
          <div class="flex justify-center gap-3">
            <button onclick="openEditModal(${t.id})" class="transition hover:opacity-80" style="color:#2563eb;" title="Edit">
              <i data-lucide="pencil" class="h-4 w-4"></i>
            </button>
            <button onclick="handleDelete(${t.id})" class="transition hover:opacity-80" style="color:#ef4444;" title="Hapus">
              <i data-lucide="trash-2" class="h-4 w-4"></i>
            </button>
          </div>
        </td>
      </tr>`;

    if (mobileWrap) {
      mobileWrap.innerHTML += `
        <div class="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div class="flex items-start justify-between gap-3 mb-2">
            <div>
              <h4 class="font-bold text-slate-900">${safeText(t.category)}</h4>
              <p class="text-xs text-slate-500 mt-1">${dateStr}</p>
            </div>
            <span class="px-3 py-1 rounded-full text-xs font-medium ${badgeClass}">${badgeLabel}</span>
          </div>
          <p class="text-lg font-bold mb-2" style="${amountStyle}">${sign} ${formatCurrency(t.amount)}</p>
          <p class="text-xs text-slate-500 mb-3">${t.note ? safeText(t.note) : 'Tidak ada catatan.'}</p>
          <div class="flex gap-2">
            <button onclick="openEditModal(${t.id})" class="flex-1 rounded-xl px-3 py-2 text-sm font-bold btn-soft">Edit</button>
            <button onclick="handleDelete(${t.id})" class="flex-1 rounded-xl px-3 py-2 text-sm font-bold" style="background:#fee2e2;color:#b91c1c;">Hapus</button>
          </div>
        </div>`;
    }
  });
  lucide.createIcons();
}

async function handleDelete(id) {
  if (!confirm('Hapus transaksi ini?')) return;
  await deleteTransaction(id);
  showToast('Transaksi dihapus.');
  renderHistory();
  renderHome();
  if (currentPage === 'report') renderReport();
}

function setupHistoryFilters() {
  const typeFilter = document.getElementById('typeFilter');
  const categoryFilter = document.getElementById('categoryFilter');
  const startDateFilter = document.getElementById('startDateFilter');
  const endDateFilter = document.getElementById('endDateFilter');
  const btnResetFilter = document.getElementById('btnResetFilter');

  typeFilter.addEventListener('change', (e) => {
    historyFilters.type = e.target.value;
    renderHistory();
  });
  categoryFilter.addEventListener('change', (e) => {
    historyFilters.category = e.target.value;
    renderHistory();
  });
  startDateFilter.addEventListener('change', (e) => {
    historyFilters.startDate = e.target.value;
    renderHistory();
  });
  endDateFilter.addEventListener('change', (e) => {
    historyFilters.endDate = e.target.value;
    renderHistory();
  });
  btnResetFilter.addEventListener('click', () => {
    historyFilters = { type: 'all', category: 'all', startDate: '', endDate: '' };
    typeFilter.value = 'all';
    categoryFilter.value = 'all';
    startDateFilter.value = '';
    endDateFilter.value = '';
    renderHistory();
  });
}

// ── EDIT MODAL ───────────────────────────────
function openEditModal(id) {
  getTransactionById(id).then((t) => {
    if (!t) { alert('Transaksi tidak ditemukan.'); return; }
    document.getElementById('editId').value = t.id;
    document.getElementById('editType').value = t.type;
    renderCategoryOptions(t.type, editCategory, t.category);
    document.getElementById('editAmount').value = Number(t.amount).toLocaleString('id-ID');
    document.getElementById('editDate').value = t.date;
    document.getElementById('editNote').value = t.note || '';

    const modal = document.getElementById('editModal');
    modal.classList.remove('hidden');
    modal.classList.add('flex');
    lucide.createIcons();
  });
}

function closeEditModal() {
  const modal = document.getElementById('editModal');
  modal.classList.add('hidden');
  modal.classList.remove('flex');
}

function setupEditModal() {
  document.getElementById('btnCloseEditModal').addEventListener('click', closeEditModal);
  document.getElementById('btnCancelEdit').addEventListener('click', closeEditModal);
  document.getElementById('editModal').addEventListener('click', (e) => {
    if (e.target.id === 'editModal') closeEditModal();
  });

  document.getElementById('editTransactionForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = Number(document.getElementById('editId').value);
    const type = document.getElementById('editType').value;
    const category = document.getElementById('editCategory').value;
    const amount = parseRupiahInput(document.getElementById('editAmount').value);
    const date = document.getElementById('editDate').value;
    const note = document.getElementById('editNote').value.trim();

    const errors = validateTransactionInput({ type, category, amount, date, note });
    if (errors.length) { showErrors(errors); return; }

    await updateTransaction(id, { type, category, amount, date, note });
    closeEditModal();
    showToast('Transaksi berhasil diperbarui.');
    renderHistory();
    renderHome();
    if (currentPage === 'report') renderReport();
  });
}

// ── REPORT ────────────────────────────────────
function setupReportControls() {
  const reportMonth = document.getElementById('reportMonth');
  const reportYear = document.getElementById('reportYear');
  const reportStartDate = document.getElementById('reportStartDate');
  const reportEndDate = document.getElementById('reportEndDate');

  const monthNames = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];
  reportMonth.innerHTML = monthNames.map((name, i) => `<option value="${i + 1}">${name}</option>`).join('');
  const currentYear = new Date().getFullYear();
  let yearOptions = '';
  for (let y = currentYear - 5; y <= currentYear + 1; y++) {
    yearOptions += `<option value="${y}">${y}</option>`;
  }
  reportYear.innerHTML = yearOptions;
  reportMonth.value = String(reportFilters.month);
  reportYear.value = String(reportFilters.year);

  function updateReportFilter() {
    reportFilters.month = Number(reportMonth.value);
    reportFilters.year = Number(reportYear.value);
    reportFilters.startDate = reportStartDate.value;
    reportFilters.endDate = reportEndDate.value;
    renderReport();
  }

  [reportMonth, reportYear, reportStartDate, reportEndDate].forEach((el) => el.addEventListener('change', updateReportFilter));
}

async function renderReport() {
  const year = reportFilters.year;
  const month = reportFilters.month;
  const allTx = await getAllTransactions();
  const yearTx = allTx.filter((t) => new Date(t.date).getFullYear() === year);
  let periodTx = allTx.filter((t) => {
    const d = new Date(t.date);
    return d.getFullYear() === year && d.getMonth() + 1 === month;
  });

  if (reportFilters.startDate || reportFilters.endDate) {
    periodTx = allTx.filter((t) => {
      const matchStart = !reportFilters.startDate || t.date >= reportFilters.startDate;
      const matchEnd = !reportFilters.endDate || t.date <= reportFilters.endDate;
      return matchStart && matchEnd;
    });
  }

  renderYearlyExpenseChart(yearTx, month);
  renderCategoryDonut(periodTx);
  renderDailyChart(periodTx);
  renderCategoryBar(periodTx);
  renderSavingsTrend(year, month);
  renderStatCards(periodTx);
}

function renderYearlyExpenseChart(yearTx, currentMonth) {
  if (!window.Chart) { fallbackChartMessage('yearlyExpenseChart'); return; }
  const months = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Ags','Sep','Okt','Nov','Des'];
  const sym = currencySymbol();
  const data = months.map((_, i) =>
    yearTx.filter((t) => t.type === 'expense' && new Date(t.date).getMonth() === i)
      .reduce((sum, t) => sum + t.amount, 0)
  );
  yearlyExpenseInstance = destroyChart(yearlyExpenseInstance);
  yearlyExpenseInstance = new Chart(document.getElementById('yearlyExpenseChart'), {
    type: 'bar',
    data: { labels: months, datasets: [{ label: 'Pengeluaran', data, backgroundColor: data.map((_, i) => i === currentMonth - 1 ? '#ea580c' : '#fed7aa'), borderRadius: 8, borderSkipped: false }] },
    options: {
      responsive: true,
      plugins: { legend: { display: false } },
      scales: {
        y: { ticks: { callback: (v) => sym + ' ' + (v / 1000000).toFixed(1) + 'jt', color: '#64748b' }, grid: { color: '#e5e7eb' } },
        x: { grid: { display: false }, ticks: { color: '#64748b' } },
      },
    },
  });
}

function renderCategoryDonut(monthTx) {
  if (!window.Chart) { fallbackChartMessage('categoryDonutChart'); return; }
  const expenses = monthTx.filter((t) => t.type === 'expense');
  const catMap = {};
  expenses.forEach((t) => { catMap[t.category] = (catMap[t.category] || 0) + t.amount; });
  const labels = Object.keys(catMap);
  const values = Object.values(catMap);
  const palette = ['#ea580c','#eab308','#fb923c','#facc15','#fbbf24','#f59e0b','#d97706','#fde68a'];
  const colors = labels.map((_, i) => palette[i % palette.length]);
  const total = values.reduce((a, b) => a + b, 0);

  categoryDonutInstance = destroyChart(categoryDonutInstance);
  categoryDonutInstance = new Chart(document.getElementById('categoryDonutChart'), {
    type: 'doughnut',
    data: { labels, datasets: [{ data: values, backgroundColor: colors, borderWidth: 2, borderColor: '#ffffff', hoverOffset: 6 }] },
    options: {
      responsive: true, cutout: '65%',
      plugins: { legend: { display: false }, tooltip: { callbacks: { label: (ctx) => ' ' + formatCurrency(ctx.raw) } } },
    },
  });

  const legendContainer = document.getElementById('donutLegend');
  legendContainer.innerHTML = '';
  if (labels.length === 0) { legendContainer.innerHTML = '<p class="text-sm text-slate-500 text-center">Belum ada data.</p>'; return; }
  labels.forEach((label, i) => {
    const pct = total > 0 ? Math.round((values[i] / total) * 100) : 0;
    legendContainer.innerHTML += `
      <div class="flex items-center justify-between text-sm">
        <div class="flex items-center gap-2">
          <span class="w-3 h-3 rounded-full inline-block" style="background:${colors[i]}"></span>
          <span class="text-slate-600">${safeText(label)}</span>
        </div>
        <span class="font-semibold text-slate-700">${pct}%</span>
      </div>`;
  });
}

function renderDailyChart(monthTx) {
  if (!window.Chart) { fallbackChartMessage('dailyExpenseChart'); return; }
  const sym = currencySymbol();
  const dayNames = ['Min','Sen','Sel','Rab','Kam','Jum','Sab'];
  const daySums = Array(7).fill(0), dayCounts = Array(7).fill(0);
  monthTx.filter((t) => t.type === 'expense').forEach((t) => {
    const d = new Date(t.date).getDay();
    daySums[d] += t.amount; dayCounts[d]++;
  });
  const avgData = daySums.map((s, i) => dayCounts[i] > 0 ? Math.round(s / dayCounts[i]) : 0);
  const maxVal = Math.max(...avgData);

  dailyExpenseInstance = destroyChart(dailyExpenseInstance);
  dailyExpenseInstance = new Chart(document.getElementById('dailyExpenseChart'), {
    type: 'bar',
    data: { labels: dayNames, datasets: [{ label: 'Rata-rata Pengeluaran', data: avgData, backgroundColor: avgData.map((v) => v === maxVal && maxVal > 0 ? '#eab308' : '#fef3c7'), borderRadius: 8, borderSkipped: false }] },
    options: {
      responsive: true,
      plugins: { legend: { display: false }, tooltip: { callbacks: { label: (ctx) => ' ' + formatCurrency(ctx.raw) } } },
      scales: {
        y: { ticks: { callback: (v) => sym + ' ' + v.toLocaleString('id-ID'), color: '#64748b' }, grid: { color: '#e5e7eb' } },
        x: { grid: { display: false }, ticks: { color: '#64748b' } },
      },
    },
  });
}

function renderCategoryBar(monthTx) {
  if (!window.Chart) { fallbackChartMessage('categoryBarChart'); return; }
  const sym = currencySymbol();
  const expenses = monthTx.filter((t) => t.type === 'expense');
  const catMap = {};
  expenses.forEach((t) => { catMap[t.category] = (catMap[t.category] || 0) + t.amount; });
  const sorted = Object.entries(catMap).sort((a, b) => b[1] - a[1]);
  const labels = sorted.map(([k]) => k);
  const values = sorted.map(([, v]) => v);
  const palette = ['#ea580c','#eab308','#fb923c','#facc15','#fbbf24','#f59e0b','#d97706','#fde68a'];

  categoryBarInstance = destroyChart(categoryBarInstance);
  categoryBarInstance = new Chart(document.getElementById('categoryBarChart'), {
    type: 'bar',
    data: { labels, datasets: [{ label: 'Pengeluaran', data: values, backgroundColor: labels.map((_, i) => palette[i % palette.length]), borderRadius: 6, borderSkipped: false }] },
    options: {
      indexAxis: 'y', responsive: true,
      plugins: { legend: { display: false }, tooltip: { callbacks: { label: (ctx) => ' ' + formatCurrency(ctx.raw) } } },
      scales: {
        x: { ticks: { callback: (v) => sym + ' ' + (v / 1000) + 'rb', color: '#64748b' }, grid: { color: '#e5e7eb' } },
        y: { grid: { display: false }, ticks: { color: '#64748b' } },
      },
    },
  });
}

async function renderSavingsTrend(year, month) {
  if (!window.Chart) { fallbackChartMessage('savingsTrendChart'); return; }
  const sym = currencySymbol();
  const labels = [], savings = [];
  for (let i = 4; i >= 0; i--) {
    let m = month - i, y = year;
    if (m <= 0) { m += 12; y -= 1; }
    const tx = await getTransactionsByMonth(y, m);
    const s = calcSummary(tx);
    labels.push(new Date(y, m - 1).toLocaleDateString('id-ID', { month: 'short' }));
    savings.push(s.income - s.expense);
  }
  savingsTrendInstance = destroyChart(savingsTrendInstance);
  savingsTrendInstance = new Chart(document.getElementById('savingsTrendChart'), {
    type: 'line',
    data: { labels, datasets: [{ label: 'Tabungan', data: savings, borderColor: '#ea580c', backgroundColor: 'rgba(234,88,12,0.1)', borderWidth: 3, tension: 0.4, fill: true, pointBackgroundColor: '#ea580c', pointRadius: 5 }] },
    options: {
      responsive: true,
      plugins: { legend: { display: false }, tooltip: { callbacks: { label: (ctx) => ' ' + formatCurrency(ctx.raw) } } },
      scales: {
        y: { ticks: { callback: (v) => sym + ' ' + (v / 1000000).toFixed(1) + 'jt', color: '#64748b' }, grid: { color: '#e5e7eb' } },
        x: { grid: { display: false }, ticks: { color: '#64748b' } },
      },
    },
  });
}

function renderStatCards(monthTx) {
  const expenses = monthTx.filter((t) => t.type === 'expense');
  const total = expenses.reduce((s, t) => s + t.amount, 0);
  const uniqueDays = new Set(expenses.map((t) => t.date)).size;
  const dailyAvg = uniqueDays > 0 ? Math.round(total / uniqueDays) : 0;

  const catMap = {};
  expenses.forEach((t) => { catMap[t.category] = (catMap[t.category] || 0) + t.amount; });
  const topCat = Object.entries(catMap).sort((a, b) => b[1] - a[1])[0];

  const dayNames = ['Minggu','Senin','Selasa','Rabu','Kamis','Jumat','Sabtu'];
  const daySums = Array(7).fill(0);
  expenses.forEach((t) => { daySums[new Date(t.date).getDay()] += t.amount; });
  const topDayIdx = daySums.indexOf(Math.max(...daySums));

  document.getElementById('statDailyAvg').textContent = formatCurrency(dailyAvg);
  document.getElementById('statTopCategory').textContent = topCat ? topCat[0] : '-';
  document.getElementById('statTopDay').textContent = expenses.length > 0 ? dayNames[topDayIdx] : '-';
  document.getElementById('statTxCount').textContent = monthTx.length + 'x';
}

// ── TOAST ─────────────────────────────────────
function showToast(message) {
  const toast = document.getElementById('toast');
  toast.textContent = message;
  toast.classList.remove('opacity-0', 'translate-y-4');
  toast.classList.add('opacity-100', 'translate-y-0');
  setTimeout(() => {
    toast.classList.add('opacity-0', 'translate-y-4');
    toast.classList.remove('opacity-100', 'translate-y-0');
  }, 2500);
}

// ── SETTING ───────────────────────────────────
let settingState = { notifBudget: true };

function applyToggleUI(btnId, dotId, isOn) {
  const btn = document.getElementById(btnId);
  const dot = document.getElementById(dotId);
  if (!btn || !dot) return;
  if (isOn) {
    btn.style.background = 'linear-gradient(135deg,#f97316,#eab308)';
    dot.classList.remove('translate-x-1');
    dot.classList.add('translate-x-6');
  } else {
    btn.style.background = '#cbd5e1';
    dot.classList.remove('translate-x-6');
    dot.classList.add('translate-x-1');
  }
}

function saveSettings() {
  const name = document.getElementById('settingName').value.trim();
  const email = document.getElementById('settingEmail').value.trim();
  const budgetRaw = document.getElementById('settingBudget').value.replace(/\./g, '').replace(/,/g, '');
  const data = {
    name, email,
    budget: Number(budgetRaw) || 0,
    notifBudget: settingState.notifBudget,
  };

  saveSettingsData(data);
  showToast('Pengaturan disimpan.');
  showPage('home');
}

function renderCategoryManagement() {
  const categories = getCategories();
  const incomeList = document.getElementById('incomeCategoryList');
  const expenseList = document.getElementById('expenseCategoryList');
  if (!incomeList || !expenseList) return;

  function itemHtml(type, cat) {
    const isDefault = DEFAULT_CATEGORIES[type].includes(cat);
    return `
      <div class="flex items-center justify-between gap-3 rounded-xl border border-slate-200 px-3 py-2 bg-slate-50">
        <span class="text-sm font-medium text-slate-700">${safeText(cat)}</span>
        <button type="button" ${isDefault ? 'disabled' : ''} onclick="deleteCategory('${type}', '${encodeURIComponent(cat)}')"
          class="text-xs font-bold ${isDefault ? 'text-slate-300 cursor-not-allowed' : 'text-red-500 hover:text-red-700'}">
          ${isDefault ? 'Default' : 'Hapus'}
        </button>
      </div>`;
  }

  incomeList.innerHTML = categories.income.map((cat) => itemHtml('income', cat)).join('');
  expenseList.innerHTML = categories.expense.map((cat) => itemHtml('expense', cat)).join('');
}

function deleteCategory(type, category) {
  category = decodeURIComponent(category);
  const categories = getCategories();
  if (DEFAULT_CATEGORIES[type].includes(category)) return;
  categories[type] = categories[type].filter((cat) => cat !== category);
  saveCategories(categories);
  renderCategoryOptions(inputType.value);
  renderHistoryCategoryFilter(historyFilters.category);
  renderCategoryManagement();
  showToast('Kategori dihapus.');
}

async function renderSetting() {
  const saved = getSettings();

  document.getElementById('settingName').value = saved.name || '';
  document.getElementById('settingEmail').value = saved.email || '';
  document.getElementById('settingBudget').value = saved.budget ? Number(saved.budget).toLocaleString('id-ID') : '';

  settingState.notifBudget = saved.notifBudget !== false;
  applyToggleUI('toggleNotif', 'toggleNotifDot', settingState.notifBudget);

  const all = await getAllTransactions();
  document.getElementById('settingTotalTx').textContent = all.length + ' transaksi';

  const budgetStatus = document.getElementById('budgetStatus');
  if (saved.budget && saved.budget > 0) {
    const now = new Date();
    const monthTx = await getTransactionsByMonth(now.getFullYear(), now.getMonth() + 1);
    const { expense } = calcSummary(monthTx);
    const pct = Math.min(Math.round((expense / saved.budget) * 100), 100);
    const barColor = pct >= 100 ? 'bg-red-500' : pct >= 80 ? 'bg-orange-400' : 'bg-green-500';

    budgetStatus.classList.remove('hidden');
    document.getElementById('budgetUsedLabel').textContent = formatCurrency(expense) + ' / ' + formatCurrency(saved.budget);
    const bar = document.getElementById('budgetBar');
    bar.style.width = pct + '%';
    bar.className = 'h-2 rounded-full transition-all duration-500 ' + barColor;
    document.getElementById('budgetNote').textContent =
      pct >= 100 ? 'Budget bulan ini sudah terlampaui.' :
      pct >= 80 ? 'Budget hampir habis (' + pct + '% terpakai).' :
      pct + '% dari budget bulan ini terpakai.';
  } else {
    budgetStatus.classList.add('hidden');
  }

  document.getElementById('settingBudget').oninput = function () {
    const raw = this.value.replace(/\D/g, '');
    this.value = raw ? Number(raw).toLocaleString('id-ID') : '';
  };

  renderCategoryManagement();
  lucide.createIcons();
}

function setupSettingListeners() {
  document.getElementById('toggleNotif').addEventListener('click', function () {
    settingState.notifBudget = !settingState.notifBudget;
    applyToggleUI('toggleNotif', 'toggleNotifDot', settingState.notifBudget);
  });

  document.getElementById('btnSaveSetting').addEventListener('click', saveSettings);

  document.getElementById('btnAddCategory').addEventListener('click', () => {
    const type = document.getElementById('newCategoryType').value;
    const nameInput = document.getElementById('newCategoryName');
    const name = nameInput.value.trim();
    if (!name || name.length < 2) { alert('Nama kategori minimal 2 karakter.'); return; }
    if (name.length > 30) { alert('Nama kategori maksimal 30 karakter.'); return; }

    const categories = getCategories();
    const exists = categories[type].some((cat) => cat.toLowerCase() === name.toLowerCase());
    if (exists) { alert('Kategori sudah ada.'); return; }

    categories[type].push(name);
    saveCategories(categories);
    nameInput.value = '';
    renderCategoryOptions(inputType.value);
    renderHistoryCategoryFilter(historyFilters.category);
    renderCategoryManagement();
    showToast('Kategori berhasil ditambahkan.');
  });

  document.getElementById('btnExportCSV').addEventListener('click', async () => {
    const all = await getAllTransactions();
    if (all.length === 0) { showToast('Belum ada data untuk diekspor.'); return; }

    const header = ['Tanggal','Kategori','Jenis','Nominal','Catatan'];
    const rows = all.map((t) => [
      t.date, t.category,
      t.type === 'income' ? 'Pemasukan' : 'Pengeluaran',
      t.amount, t.note || '',
    ]);
    const csv = [header, ...rows].map((r) => r.map((v) => '"' + String(v).replace(/"/g, '""') + '"').join(',')).join('\n');
    downloadTextFile('moneytrack_' + new Date().toISOString().slice(0, 10) + '.csv', '\uFEFF' + csv, 'text/csv;charset=utf-8;');
    showToast('Data berhasil diekspor.');
  });

  document.getElementById('btnBackupJSON').addEventListener('click', async () => {
    const all = await getAllTransactions();
    const payload = {
      app: 'MoneyTrack',
      version: 1,
      exportedAt: new Date().toISOString(),
      settings: getSettings(),
      categories: getCategories(),
      transactions: all,
    };
    downloadTextFile('moneytrack_backup_' + new Date().toISOString().slice(0, 10) + '.json', JSON.stringify(payload, null, 2), 'application/json;charset=utf-8;');
    showToast('Backup JSON berhasil dibuat.');
  });

  document.getElementById('inputRestoreJSON').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    try {
      const text = await file.text();
      const payload = JSON.parse(text);
      if (!payload || !Array.isArray(payload.transactions)) throw new Error('Format file tidak valid.');

      const invalid = payload.transactions.find((t) => {
        return !['income','expense'].includes(t.type) || !t.category || !t.date || !Number(t.amount);
      });
      if (invalid) throw new Error('Ada data transaksi yang tidak valid.');

      if (!confirm('Restore akan mengganti semua transaksi saat ini. Lanjutkan?')) return;

      await replaceAllTransactions(payload.transactions);
      if (payload.settings && typeof payload.settings === 'object') saveSettingsData(payload.settings);
      if (payload.categories && Array.isArray(payload.categories.expense) && Array.isArray(payload.categories.income)) saveCategories(payload.categories);

      showToast('Restore JSON berhasil.');
      renderCategoryOptions(inputType.value);
      renderHistoryCategoryFilter('all');
      showPage('home');
    } catch (err) {
      alert('Restore gagal: ' + err.message);
    } finally {
      e.target.value = '';
    }
  });

  document.getElementById('btnResetData').addEventListener('click', async () => {
    if (!confirm('Yakin ingin menghapus SEMUA data transaksi? Aksi ini tidak bisa dibatalkan.')) return;
    await clearTransactions();
    showToast('Semua data berhasil dihapus.');
    renderSetting();
    renderHistory();
    renderHome();
  });
}

// ── FORMAT NOMINAL FORM ───────────────────────
function setupFormattedNumberInput(id) {
  const el = document.getElementById(id);
  if (!el) return;

  el.addEventListener('input', function () {
    const raw = this.value.replace(/\D/g, '');
    if (!raw) { this.value = ''; return; }
    const pos = this.selectionStart;
    const prevLen = this.value.length;
    this.value = Number(raw).toLocaleString('id-ID');
    const diff = this.value.length - prevLen;
    try { this.setSelectionRange(pos + diff, pos + diff); } catch(e) {}
  });

  el.addEventListener('keydown', function (e) {
    const ctrl = e.ctrlKey || e.metaKey;
    if (ctrl) return;
    const allowed = ['Backspace','Delete','ArrowLeft','ArrowRight','Tab','Home','End'];
    if (!allowed.includes(e.key) && !/^\d$/.test(e.key)) e.preventDefault();
  });
}

function setupPWA() {
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('./service-worker.js').catch(() => {
        console.warn('Service worker gagal didaftarkan.');
      });
    });
  }
}

// ── INIT ──────────────────────────────────────
async function init() {
  await initDB();
  await seedDummyData();
  renderCategoryOptions(inputType.value);
  renderHistoryCategoryFilter();
  setupFormattedNumberInput('inputAmount');
  setupFormattedNumberInput('editAmount');
  setupHistoryFilters();
  setupReportControls();
  setupEditModal();
  setupSettingListeners();
  setupPWA();
  // Init icons after all DOM content is ready
  if (window.lucide && typeof lucide.createIcons === 'function') {
    lucide.createIcons();
  }
  showPage('home');
}

init().catch((error) => {
  console.error(error);
  alert('Aplikasi gagal dimuat: ' + error.message);
});