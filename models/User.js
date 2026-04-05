const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const TaskSchema = new mongoose.Schema({
  id:        { type: Number, required: true },
  text:      { type: String, required: true, maxlength: 500 },
  done:      { type: Boolean, default: false },
  createdAt: { type: String }
}, { _id: false });

const DaySchema = new mongoose.Schema({
  key:    { type: String, required: true },
  tasks:  { type: [TaskSchema], default: [] },
  memory: { type: String, default: '', maxlength: 2000 },
  mood:   { type: String, default: '' }
}, { _id: false });

const GoalSchema = new mongoose.Schema({
  id:        { type: Number, required: true },
  title:     { type: String, required: true, maxlength: 200 },
  desc:      { type: String, default: '', maxlength: 1000 },
  cat:       { type: String, enum: ['perso','pro','sante','finance','famille','autre'], default: 'autre' },
  deadline:  { type: String, default: '' },
  done:      { type: Boolean, default: false },
  progress:  { type: Number, default: 0, min: 0, max: 100 },
  createdAt: { type: String }
}, { _id: false });

const UserSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Le prénom est requis'],
    trim: true,
    maxlength: [100, 'Le prénom ne peut pas dépasser 100 caractères']
  },
  phone: {
    type: String,
    required: [true, 'Le numéro de téléphone est requis'],
    unique: true,
    trim: true,
    match: [/^\+?\d{8,15}$/, 'Numéro de téléphone invalide']
  },
  password: {
    type: String,
    required: [true, 'Le mot de passe est requis'],
    minlength: [6, 'Le mot de passe doit contenir au moins 6 caractères'],
    select: false
  },
  isAdmin:      { type: Boolean, default: false },
  lastLoginAt:  { type: Date, default: null },
  loginCount:   { type: Number, default: 0 },
  lastActiveAt: { type: Date, default: null },
  days:         { type: [DaySchema], default: [] },
  goals:        { type: [GoalSchema], default: [] },
  createdAt:    { type: Date, default: Date.now }
});

UserSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  const salt = await bcrypt.genSalt(12);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

UserSchema.methods.comparePassword = async function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

module.exports = mongoose.model('User', UserSchema);
