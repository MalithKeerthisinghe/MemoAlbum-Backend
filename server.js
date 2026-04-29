require('dotenv').config();
require('express-async-errors');
const http = require('http');
const app = require('./src/app');
const { connect, close } = require('./src/db/mongo');

const PORT = process.env.PORT || 4000;
const server = http.createServer(app);

connect().then(() => {
  server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}).catch(err => {
  console.error('Failed to connect to MongoDB:', err);
  process.exit(1);
});

process.on('SIGINT', async () => {
  await close();
  process.exit(0);
});