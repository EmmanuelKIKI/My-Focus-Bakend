const mongoose = require('mongoose');
const bcrypt   = require('bcryptjs');

// ─── Tâche ponctuelle ─────────────────────────────────────
const TaskSchema = new mongoose.Schema({
  id:        { type: Number, required: true },
  text:      { type: String, required: true, maxlength: 500 },
  done:      { type: Boolean, default: false },
  time:      { type: String, default: '' },   // HH:MM optionnel
  notified:  { type: Boolean, default: false },
  createdAt: { type: String }
}, { _id: false });

// ─── Journée ──────────────────────────────────────────────
const DaySchema = new mongoose.Schema({
  key:    { type: String, required: true },   // YYYY-MM-DD
  tasks:  { type: [TaskSchema], default: [] },
  memory: { type: String, default: '', maxlength: 2000 },
  mood:   { type: String, default: '' }
}, { _id: false });

// ─── Habitude (tâche récurrente mensuelle) ────────────────
const HabitSchema = new mongoose.Schema({
  id:        { type: Number, required: true },
  text:      { type: String, required: true, maxlength: 300 },
  type:      { type: String, enum: ['daily','monthly'], default: 'daily' }, // daily=tous les jours, monthly=ponctuelle
  time:      { type: String, default: '' },      // HH:MM — heure de rappel
  days:      { type: [Number], default: [] },    // pour monthly: jours du mois [1,5,12...]
  monthKey:  { type: String, required: true },   // YYYY-MM — mois concerné
  color:     { type: String, default: '#10B981' },
  createdAt: { type: Number }
}, { _id: false });

// ─── Complétion d'une habitude ────────────────────────────
const HabitLogSchema = new mongoose.Schema({
  habitId:  { type: Number, required: true },
  dateKey:  { type: String, required: true },    // YYYY-MM-DD
  done:     { type: Boolean, default: false },
  doneAt:   { type: String, default: '' }
}, { _id: false });

// ─── Objectif ─────────────────────────────────────────────
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

// ─── Note rapide ──────────────────────────────────────────
const NoteSchema = new mongoose.Schema({
  id:        { type: String, required: true },
  title:     { type: String, default: '', maxlength: 200 },
  body:      { type: String, default: '', maxlength: 10000 },
  pinned:    { type: Boolean, default: false },
  createdAt: { type: Number },
  updatedAt: { type: Number }
}, { _id: false });

// ─── Subscription push ────────────────────────────────────
const PushSubSchema = new mongoose.Schema({
  endpoint:  { type: String },
  keys:      { p256dh: String, auth: String }
}, { _id: false });

// ─── Utilisateur ──────────────────────────────────────────
const UserSchema = new mongoose.Schema({
  name:     { type: String, required: true, trim: true, maxlength: 100 },
  phone:    { type: String, required: true, unique: true, trim: true },
  password: { type: String, required: true, minlength: 6, select: false },
  days:     { type: [DaySchema],      default: [] },
  goals:    { type: [GoalSchema],     default: [] },
  notes:    { type: [NoteSchema],     default: [] },
  habits:   { type: [HabitSchema],    default: [] },
  habitLogs:{ type: [HabitLogSchema], default: [] },
  pushSub:  { type: PushSubSchema,    default: null },
  createdAt:{ type: Date, default: Date.now }
});

UserSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});
UserSchema.methods.comparePassword = function(p) { return bcrypt.compare(p, this.password); };

module.exports = mongoose.model('User', UserSchema);
