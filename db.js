// db.js — MoneyTrack IndexedDB Layer

const DB_NAME = 'MoneyTrackDB';
const DB_VERSION = 1;
const STORE_NAME = 'transactions';

let db = null;

function initDB() {
  return new Promise((resolve, reject) => {
    if (db) return resolve(db);

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (e) => {
      const database = e.target.result;

      if (!database.objectStoreNames.contains(STORE_NAME)) {
        const store = database.createObjectStore(STORE_NAME, {
          keyPath: 'id',
          autoIncrement: true,
        });

        store.createIndex('date', 'date', { unique: false });
        store.createIndex('type', 'type', { unique: false });
        store.createIndex('category', 'category', { unique: false });
      }
    };

    request.onsuccess = (e) => {
      db = e.target.result;
      resolve(db);
    };

    request.onerror = (e) => {
      console.error('IndexedDB error:', e.target.error);
      reject(e.target.error);
    };
  });
}

/**
 * Tambah transaksi baru.
 * @param {{ type: 'income'|'expense', category: string, amount: number, date: string, note?: string }} data
 */
function addTransaction(data) {
  return new Promise(async (resolve, reject) => {
    await initDB();

    const transaction = db.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);

    const record = {
      type: data.type,
      category: data.category.trim(),
      amount: Number(data.amount),
      date: data.date,
      note: data.note ? data.note.trim() : '',
      createdAt: new Date().toISOString(),
    };

    const request = store.add(record);
    request.onsuccess = (e) => resolve(e.target.result);
    request.onerror = (e) => reject(e.target.error);
  });
}

function getAllTransactions() {
  return new Promise(async (resolve, reject) => {
    await initDB();

    const transaction = db.transaction(STORE_NAME, 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.getAll();

    request.onsuccess = (e) => {
      const sorted = e.target.result.sort(
        (a, b) => new Date(b.date) - new Date(a.date)
      );
      resolve(sorted);
    };

    request.onerror = (e) => reject(e.target.error);
  });
}

async function getTransactionsByMonth(year, month) {
  const all = await getAllTransactions();
  return all.filter((t) => {
    const d = new Date(t.date);
    return d.getFullYear() === year && d.getMonth() + 1 === month;
  });
}

async function getTransactionsByYear(year) {
  const all = await getAllTransactions();
  return all.filter((t) => new Date(t.date).getFullYear() === year);
}

function getTransactionById(id) {
  return new Promise(async (resolve, reject) => {
    await initDB();

    const transaction = db.transaction(STORE_NAME, 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.get(Number(id));

    request.onsuccess = (e) => resolve(e.target.result || null);
    request.onerror = (e) => reject(e.target.error);
  });
}

function updateTransaction(id, data) {
  return new Promise(async (resolve, reject) => {
    await initDB();

    const transaction = db.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const getRequest = store.get(Number(id));

    getRequest.onsuccess = () => {
      const oldData = getRequest.result;

      if (!oldData) {
        reject(new Error('Transaksi tidak ditemukan.'));
        return;
      }

      const updatedRecord = {
        ...oldData,
        type: data.type,
        category: data.category.trim(),
        amount: Number(data.amount),
        date: data.date,
        note: data.note ? data.note.trim() : '',
        updatedAt: new Date().toISOString(),
      };

      const putRequest = store.put(updatedRecord);
      putRequest.onsuccess = () => resolve(updatedRecord);
      putRequest.onerror = (e) => reject(e.target.error);
    };

    getRequest.onerror = (e) => reject(e.target.error);
  });
}

function clearTransactions() {
  return new Promise(async (resolve, reject) => {
    await initDB();

    const transaction = db.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.clear();

    request.onsuccess = () => resolve();
    request.onerror = (e) => reject(e.target.error);
  });
}

async function replaceAllTransactions(records) {
  await clearTransactions();

  for (const item of records) {
    await addTransaction({
      type: item.type,
      category: item.category,
      amount: item.amount,
      date: item.date,
      note: item.note || '',
    });
  }
}

function deleteTransaction(id) {
  return new Promise(async (resolve, reject) => {
    await initDB();

    const transaction = db.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.delete(id);

    request.onsuccess = () => resolve();
    request.onerror = (e) => reject(e.target.error);
  });
}

function calcSummary(transactions) {
  let income = 0;
  let expense = 0;

  transactions.forEach((t) => {
    if (t.type === 'income') income += t.amount;
    else expense += t.amount;
  });

  return { balance: income - expense, income, expense };
}

function formatRupiah(amount) {
  return 'Rp ' + amount.toLocaleString('id-ID');
}

async function seedDummyData() {
  const all = await getAllTransactions();
  if (all.length > 0) return;

  const dummies = [
    { type: 'income',  category: 'Gaji',         amount: 5000000, date: '2026-05-12', note: 'Gaji bulan Mei' },
    { type: 'expense', category: 'Makan',         amount: 75000,   date: '2026-05-12', note: 'Makan siang berdua' },
    { type: 'expense', category: 'Transportasi',  amount: 35000,   date: '2026-05-11', note: '' },
    { type: 'expense', category: 'Belanja',       amount: 150000,  date: '2026-05-10', note: 'Belanja bulanan' },
    { type: 'expense', category: 'Lain-lain',     amount: 80000,   date: '2026-05-09', note: '' },
    { type: 'income',  category: 'Freelance',     amount: 1200000, date: '2026-05-08', note: 'Project desain logo' },
    { type: 'expense', category: 'Tagihan',       amount: 250000,  date: '2026-05-07', note: 'Tagihan listrik' },
    { type: 'expense', category: 'Makan',         amount: 60000,   date: '2026-05-06', note: '' },
    { type: 'expense', category: 'Transportasi',  amount: 45000,   date: '2026-05-05', note: '' },
    { type: 'expense', category: 'Kesehatan',     amount: 50000,   date: '2026-05-04', note: 'Beli obat' },
  ];

  for (const d of dummies) {
    await addTransaction(d);
  }

  console.log('Dummy data seeded.');
}