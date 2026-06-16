const express = require('express');
const router = express.Router();
const requireUser = require('../middleware/requireUser');
const {
  createInStock,
  listInStock,
  restockItem,
  deleteItem,
  deleteEntry,
} = require('../controllers/inStockController');

router.post('/api/in-stock', requireUser, createInStock);
router.get('/api/in-stock', requireUser, listInStock);

// Re-stock / delete individual items inside an entry (admin only)
router.patch('/api/in-stock/:entryId/items/:productNo/restock', requireUser, restockItem);
router.delete('/api/in-stock/:entryId/items/:productNo', requireUser, deleteItem);

// Delete an entire stock entry (admin only)
router.delete('/api/in-stock/:entryId', requireUser, deleteEntry);

module.exports = router;
