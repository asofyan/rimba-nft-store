const multer = require('multer');

// Error handler terpusat — pasang paling akhir di server.js:
//   app.use(errorHandler);
const errorHandler = (err, req, res, next) => {
  // Error upload dari Multer / fileFilter
  if (err instanceof multer.MulterError) {
    return res.status(400).json({ error: err.message });
  }
  if (err.message && err.message.includes('images are allowed')) {
    return res.status(400).json({ error: err.message });
  }

  // ID Mongo tidak valid
  if (err.name === 'CastError') {
    return res.status(400).json({ error: 'Invalid ID format' });
  }

  // Duplikat unique key (mis. username sudah dipakai)
  if (err.code === 11000) {
    return res.status(400).json({ error: 'Duplicate value', field: Object.keys(err.keyValue || {}) });
  }

  console.error(`[${req.method} ${req.originalUrl}]`, err);
  res.status(500).json({ error: 'Server error' });
};

module.exports = errorHandler;
