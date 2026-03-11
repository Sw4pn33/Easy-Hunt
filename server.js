require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const path = require('path');

const searchRoutes = require('./src/routes/search');
const emailRoutes = require('./src/routes/email');

const app = express();
const PORT = process.env.PORT || 4500;

app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors());
app.use(express.json({ limit: '5mb' }));
app.use(express.static(path.join(__dirname, 'public')));

app.use('/api/search', searchRoutes);
app.use('/api/email', emailRoutes);

app.get('/{*path}', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`\n  Easy-Hunt running at http://localhost:${PORT}\n`);
});
