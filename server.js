require('dotenv').config();
const express = require('express');
const cors    = require('cors');
const helmet  = require('helmet');
const connectDB = require('./config/db');

const app = express();

connectDB();

app.use(helmet());
app.use(cors({
  origin: process.env.FRONTEND_URL || '*',
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json({ limit: '1mb' }));

app.use('/api/auth',  require('./routes/auth'));
app.use('/api/data',  require('./routes/data'));
app.use('/api/admin', require('./routes/admin'));

app.get('/api/health', (req, res) => {
  res.json({ success: true, message: 'MyFocus API opérationnelle 🚀', timestamp: new Date() });
});

app.use((req, res) => {
  res.status(404).json({ success: false, message: 'Route introuvable.' });
});
app.use((err, req, res, next) => {
  console.error('Erreur non gérée :', err);
  res.status(500).json({ success: false, message: 'Erreur interne du serveur.' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Serveur MyFocus démarré sur le port ${PORT}`);
  console.log(`   → http://localhost:${PORT}/api/health`);
});
