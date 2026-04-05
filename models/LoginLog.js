const mongoose = require('mongoose');

// ─── Enregistre chaque connexion ────────────────────────
const LoginLogSchema = new mongoose.Schema({
  userId:    { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  userName:  { type: String, required: true },
  userPhone: { type: String, required: true },
  loginAt:   { type: Date, default: Date.now },
  type:      { type: String, enum: ['login', 'register'], default: 'login' }
});

// Index pour accélérer les requêtes par date et par utilisateur
LoginLogSchema.index({ loginAt: -1 });
LoginLogSchema.index({ userId: 1, loginAt: -1 });

module.exports = mongoose.model('LoginLog', LoginLogSchema);
