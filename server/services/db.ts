import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { DbOrder } from '../../src/types.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.join(__dirname, '..', 'data');

const ORDERS_FILE = path.join(DATA_DIR, 'orders.json');
const ARCHIVE_FILE = path.join(DATA_DIR, 'orders_archive.json');
const DELETED_FILE = path.join(DATA_DIR, 'deleted_orders.json');

// Ensure data directory and files exist
function initDB() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  const files = [ORDERS_FILE, ARCHIVE_FILE, DELETED_FILE];
  files.forEach(file => {
    if (!fs.existsSync(file)) {
      fs.writeFileSync(file, JSON.stringify([]), 'utf-8');
    }
  });
}

initDB();

export function getOrders(): DbOrder[] {
  try {
    const data = fs.readFileSync(ORDERS_FILE, 'utf-8');
    return JSON.parse(data);
  } catch (error) {
    console.error('Error reading orders:', error);
    return [];
  }
}

export function saveOrders(orders: DbOrder[]) {
  try {
    fs.writeFileSync(ORDERS_FILE, JSON.stringify(orders, null, 2), 'utf-8');
  } catch (error) {
    console.error('Error saving orders:', error);
  }
}
