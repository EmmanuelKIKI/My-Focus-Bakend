/**
 * Script pour se promouvoir administrateur
 * Usage depuis le dossier backend : node scripts/make-admin.js +22901234567
 */
require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');

const phone = process.argv[2];
if (!phone) {
  console.log('Usage : node scripts/make-admin.js +22901234567');
  process.exit(1);
}

mongoose.connect(process.env.MONGODB_URI).then(async () => {
  const normalized = phone.replace(/\s+/g, '').replace(/[^\+\d]/g, '');
  const user = await User.findOne({ phone: normalized });
  if (!user) {
    console.log('Aucun utilisateur trouvé avec ce numero :', normalized);
    process.exit(1);
  }
  user.isAdmin = true;
  await user.save();
  console.log('OK -', user.name, '(' + user.phone + ') est maintenant administrateur !');
  process.exit(0);
}).catch(err => {
  console.error('Erreur MongoDB :', err.message);
  process.exit(1);
});
