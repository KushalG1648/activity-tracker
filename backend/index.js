const express = require('express');
const cors    = require('cors');
const path    = require('path');
const fs      = require('fs');

const app = express();
app.use(cors());
app.use(express.json());

// API routes
app.use('/api/auth',       require('./routes/auth'));
app.use('/api/activities', require('./routes/activities'));
app.use('/api/equipment',  require('./routes/equipment'));
app.use('/api/sessions',   require('./routes/sessions'));
app.use('/api/stats',      require('./routes/stats'));
app.use('/api/expenses',   require('./routes/expenses'));

// Serve built frontend (production)
const distDir = path.join(__dirname, '../frontend/dist');
if (fs.existsSync(distDir)) {
  app.use(express.static(distDir));
  app.get('*', (req, res) => res.sendFile(path.join(distDir, 'index.html')));
}

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`Activity tracker → http://localhost:${PORT}`));
