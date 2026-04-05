const express = require('express');
const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');
const User = require('../models/User');
const LoginLog = require('../models/LoginLog');
const { protect } = require('../middleware/auth');

const router = express.Router();

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { success: false, message: 'Trop de tentatives. Réessayez dans 15 minutes.' }
});

const signToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d'
  });
};

// ─── POST /api/auth/register ─────────────────────────────
router.post('/register', authLimiter, async (req, res) => {
  try {
    const { name, phone, password } = req.body;
    if (!name || !phone || !password) {
      return res.status(400).json({ success: false, message: 'Veuillez remplir tous les champs.' });
    }
    const normalizedPhone = phone.replace(/\s+/g, '').replace(/[^\+\d]/g, '');
    const existing = await User.findOne({ phone: normalizedPhone });
    if (existing) {
      return res.status(400).json({ success: false, message: 'Un compte existe déjà avec ce numéro.' });
    }
    const user = await User.create({
      name: name.trim(),
      phone: normalizedPhone,
      password,
      lastLoginAt: new Date(),
      loginCount: 1,
      lastActiveAt: new Date()
    });
    // Enregistrer l'inscription dans les logs
    await LoginLog.create({ userId: user._id, userName: user.name, userPhone: user.phone, type: 'register' });
    const token = signToken(user._id);
    res.status(201).json({ success: true, token, user: { id: user._id, name: user.name, phone: user.phone } });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(400).json({ success: false, message: 'Ce numéro est déjà utilisé.' });
    }
    if (err.name === 'ValidationError') {
      const msg = Object.values(err.errors).map(e => e.message).join('. ');
      return res.status(400).json({ success: false, message: msg });
    }
    res.status(500).json({ success: false, message: 'Erreur serveur. Réessayez plus tard.' });
  }
});

// ─── POST /api/auth/login ────────────────────────────────
router.post('/login', authLimiter, async (req, res) => {
  try {
    const { phone, password } = req.body;
    if (!phone || !password) {
      return res.status(400).json({ success: false, message: 'Veuillez remplir tous les champs.' });
    }
    const normalizedPhone = phone.replace(/\s+/g, '').replace(/[^\+\d]/g, '');
    const user = await User.findOne({ phone: normalizedPhone }).select('+password');
    if (!user || !(await user.comparePassword(password))) {
      return res.status(401).json({ success: false, message: 'Numéro ou mot de passe incorrect.' });
    }
    // Mettre à jour les stats de connexion
    user.lastLoginAt  = new Date();
    user.lastActiveAt = new Date();
    user.loginCount   = (user.loginCount || 0) + 1;
    await user.save();
    // Enregistrer dans les logs
    await LoginLog.create({ userId: user._id, userName: user.name, userPhone: user.phone, type: 'login' });
    const token = signToken(user._id);
    res.json({ success: true, token, user: { id: user._id, name: user.name, phone: user.phone, isAdmin: user.isAdmin } });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Erreur serveur. Réessayez plus tard.' });
  }
});

// ─── GET /api/auth/me ────────────────────────────────────
router.get('/me', protect, async (req, res) => {
  res.json({ success: true, user: { id: req.user._id, name: req.user.name, phone: req.user.phone, isAdmin: req.user.isAdmin } });
});

module.exports = router;
