import { Router } from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { getOrders, saveOrders } from '../services/db.js';

const router = Router();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.join(__dirname, '..', 'data'); // server/data directory

router.post('/monthly-close', (req, res) => {
  const orders = getOrders();
  
  const now = new Date();
  // Get last month
  const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const yearStr = lastMonth.getFullYear();
  const monthStr = String(lastMonth.getMonth() + 1).padStart(2, '0');
  
  // Find orders to archive (from last month or older, and completed/rejected)
  // Or just by strict date, let's say all orders created before the current month start
  const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  
  const ordersToArchive = orders.filter(o => o.createdAt < currentMonthStart && (o.status === 'COMPLETADO' || o.status === 'RECHAZADO'));
  const activeOrders = orders.filter(o => !ordersToArchive.includes(o));
  
  if (ordersToArchive.length > 0) {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    const archiveFileName = `orders_archive_${yearStr}_${monthStr}.json`;
    const archiveFilePath = path.join(DATA_DIR, archiveFileName);
    
    // Read existing archive if any
    let archivedData = [];
    if (fs.existsSync(archiveFilePath)) {
      archivedData = JSON.parse(fs.readFileSync(archiveFilePath, 'utf-8'));
    }
    
    // Add new ones
    const newArchived = ordersToArchive.map(o => ({...o, isArchived: true}));
    archivedData = [...archivedData, ...newArchived];
    
    // Write archive
    fs.writeFileSync(archiveFilePath, JSON.stringify(archivedData, null, 2));
    
    // Update main orders
    saveOrders(activeOrders);
    
    // TODO: Also sync to Google Sheets "Historico_MM_YYYY" here
    
    return res.json({ 
      success: true, 
      message: `Archived ${ordersToArchive.length} orders to ${archiveFileName}`,
      archivedCount: ordersToArchive.length 
    });
  }
  
  res.json({ success: true, message: 'No orders to archive', archivedCount: 0 });
});

export default router;
