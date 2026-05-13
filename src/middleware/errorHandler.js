export const notFound = (req, res) => {
  res.status(404).json({ error: 'Route not found' });
};

export const errorHandler = (err, req, res, next) => {
  console.error('Error:', err.message);
  res.status(err.status || 500).json({ error: err.message || 'Internal server error' });
};