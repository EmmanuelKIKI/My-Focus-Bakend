const express = require('express');
const User    = require('../models/User');
const { protect } = require('../middleware/auth');

const router = express.Router();
router.use(protect);

// ════════════════════════════════════════════════════════════
// GET ALL DATA
// ════════════════════════════════════════════════════════════
router.get('/', async (req, res) => {
  try {
    const user = await User.findById(req.user._id)
      .select('days goals notes habits habitLogs');
    res.json({
      success: true,
      data: {
        days:      user.days,
        goals:     user.goals,
        notes:     user.notes     || [],
        habits:    user.habits    || [],
        habitLogs: user.habitLogs || []
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Erreur serveur.' });
  }
});

// ════════════════════════════════════════════════════════════
// JOURNÉES – TÂCHES PONCTUELLES
// ════════════════════════════════════════════════════════════

// POST /api/data/day/:key/task
router.post('/day/:key/task', async (req, res) => {
  try {
    const { key } = req.params;
    const { text, time } = req.body;
    if (!text || !text.trim())
      return res.status(400).json({ success: false, message: 'Texte requis.' });

    const user    = await User.findById(req.user._id);
    let dayIndex  = user.days.findIndex(d => d.key === key);
    const newTask = {
      id:        Date.now(),
      text:      text.trim().slice(0, 500),
      done:      false,
      time:      time || '',
      notified:  false,
      createdAt: new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
    };
    if (dayIndex === -1) user.days.push({ key, tasks: [newTask], memory: '', mood: '' });
    else                 user.days[dayIndex].tasks.push(newTask);
    await user.save();
    res.status(201).json({ success: true, task: newTask });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Erreur serveur.' });
  }
});

// PATCH /api/data/day/:key/task/:taskId  – toggle done
router.patch('/day/:key/task/:taskId', async (req, res) => {
  try {
    const { key, taskId } = req.params;
    const user = await User.findById(req.user._id);
    const day  = user.days.find(d => d.key === key);
    if (!day) return res.status(404).json({ success: false, message: 'Journée introuvable.' });
    const task = day.tasks.find(t => t.id === Number(taskId));
    if (!task) return res.status(404).json({ success: false, message: 'Tâche introuvable.' });
    task.done = !task.done;
    await user.save();
    res.json({ success: true, done: task.done });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Erreur serveur.' });
  }
});

// DELETE /api/data/day/:key/task/:taskId
router.delete('/day/:key/task/:taskId', async (req, res) => {
  try {
    const { key, taskId } = req.params;
    const user = await User.findById(req.user._id);
    const day  = user.days.find(d => d.key === key);
    if (!day) return res.status(404).json({ success: false, message: 'Journée introuvable.' });
    day.tasks = day.tasks.filter(t => t.id !== Number(taskId));
    await user.save();
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Erreur serveur.' });
  }
});

// PATCH /api/data/day/:key/memory
router.patch('/day/:key/memory', async (req, res) => {
  try {
    const { key } = req.params;
    const { memory, mood } = req.body;
    const user = await User.findById(req.user._id);
    let day = user.days.find(d => d.key === key);
    if (!day) user.days.push({ key, tasks: [], memory: memory || '', mood: mood || '' });
    else {
      if (memory !== undefined) day.memory = memory.slice(0, 2000);
      if (mood   !== undefined) day.mood   = mood;
    }
    await user.save();
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Erreur serveur.' });
  }
});

// ════════════════════════════════════════════════════════════
// HABITUDES (tâches récurrentes mensuelles)
// ════════════════════════════════════════════════════════════

// GET /api/data/habits?month=YYYY-MM
router.get('/habits', async (req, res) => {
  try {
    const { month } = req.query;
    const user = await User.findById(req.user._id).select('habits habitLogs');
    const habits = month
      ? user.habits.filter(h => h.monthKey === month)
      : user.habits;
    const logs = month
      ? user.habitLogs.filter(l => l.dateKey.startsWith(month))
      : user.habitLogs;
    res.json({ success: true, habits, logs });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Erreur serveur.' });
  }
});

// POST /api/data/habits  — créer une habitude
router.post('/habits', async (req, res) => {
  try {
    const { text, type, time, days, monthKey, color } = req.body;
    if (!text || !text.trim())
      return res.status(400).json({ success: false, message: 'Texte requis.' });

    const now = Date.now();
    // Determine monthKey (default: current month)
    const mk = monthKey || new Date().toISOString().slice(0, 7);
    const newHabit = {
      id:        now,
      text:      text.trim().slice(0, 300),
      type:      type || 'daily',
      time:      time || '',
      days:      Array.isArray(days) ? days : [],
      monthKey:  mk,
      color:     color || '#10B981',
      createdAt: now
    };
    await User.findByIdAndUpdate(req.user._id, { $push: { habits: newHabit } });
    res.status(201).json({ success: true, habit: newHabit });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Erreur serveur.' });
  }
});

// PATCH /api/data/habits/:habitId  — modifier une habitude
router.patch('/habits/:habitId', async (req, res) => {
  try {
    const { habitId } = req.params;
    const { text, type, time, days, color } = req.body;
    const user  = await User.findById(req.user._id);
    const habit = user.habits.find(h => h.id === Number(habitId));
    if (!habit) return res.status(404).json({ success: false, message: 'Habitude introuvable.' });
    if (text  !== undefined) habit.text  = text.slice(0, 300);
    if (type  !== undefined) habit.type  = type;
    if (time  !== undefined) habit.time  = time;
    if (days  !== undefined) habit.days  = days;
    if (color !== undefined) habit.color = color;
    await user.save();
    res.json({ success: true, habit });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Erreur serveur.' });
  }
});

// DELETE /api/data/habits/:habitId
router.delete('/habits/:habitId', async (req, res) => {
  try {
    const { habitId } = req.params;
    await User.findByIdAndUpdate(req.user._id, {
      $pull: {
        habits:    { id: Number(habitId) },
        habitLogs: { habitId: Number(habitId) }
      }
    });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Erreur serveur.' });
  }
});

// POST /api/data/habits/:habitId/log  — cocher/décocher un jour
router.post('/habits/:habitId/log', async (req, res) => {
  try {
    const { habitId } = req.params;
    const { dateKey } = req.body;
    if (!dateKey) return res.status(400).json({ success: false, message: 'dateKey requis.' });

    const user    = await User.findById(req.user._id);
    const logIdx  = user.habitLogs.findIndex(l => l.habitId === Number(habitId) && l.dateKey === dateKey);

    let done;
    if (logIdx === -1) {
      done = true;
      user.habitLogs.push({
        habitId: Number(habitId),
        dateKey,
        done: true,
        doneAt: new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
      });
    } else {
      done = !user.habitLogs[logIdx].done;
      user.habitLogs[logIdx].done = done;
    }
    await user.save();
    res.json({ success: true, done });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Erreur serveur.' });
  }
});

// ════════════════════════════════════════════════════════════
// OBJECTIFS
// ════════════════════════════════════════════════════════════

router.post('/goal', async (req, res) => {
  try {
    const { title, desc, cat, deadline } = req.body;
    if (!title || !title.trim())
      return res.status(400).json({ success: false, message: 'Titre requis.' });
    const newGoal = {
      id: Date.now(), title: title.trim().slice(0, 200),
      desc: (desc||'').slice(0,1000), cat: cat||'autre',
      deadline: deadline||'', done: false, progress: 0,
      createdAt: new Date().toISOString().split('T')[0]
    };
    await User.findByIdAndUpdate(req.user._id, { $push: { goals: newGoal } });
    res.status(201).json({ success: true, goal: newGoal });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Erreur serveur.' });
  }
});

router.patch('/goal/:goalId/toggle', async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    const goal = user.goals.find(g => g.id === Number(req.params.goalId));
    if (!goal) return res.status(404).json({ success: false, message: 'Objectif introuvable.' });
    goal.done = !goal.done; goal.progress = goal.done ? 100 : 0;
    await user.save();
    res.json({ success: true, done: goal.done, progress: goal.progress });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Erreur serveur.' });
  }
});

router.delete('/goal/:goalId', async (req, res) => {
  try {
    await User.findByIdAndUpdate(req.user._id, { $pull: { goals: { id: Number(req.params.goalId) } } });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Erreur serveur.' });
  }
});

// ════════════════════════════════════════════════════════════
// NOTES RAPIDES
// ════════════════════════════════════════════════════════════

router.get('/notes', async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('notes');
    res.json({ success: true, notes: user.notes || [] });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Erreur serveur.' });
  }
});

router.post('/notes', async (req, res) => {
  try {
    const { title, body } = req.body;
    const now = Date.now();
    const newNote = { id: 'note_'+now, title: (title||'').slice(0,200), body: (body||'').slice(0,10000), pinned: false, createdAt: now, updatedAt: now };
    await User.findByIdAndUpdate(req.user._id, { $push: { notes: newNote } });
    res.status(201).json({ success: true, note: newNote });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Erreur serveur.' });
  }
});

router.patch('/notes/:noteId', async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    const note = user.notes.find(n => n.id === req.params.noteId);
    if (!note) return res.status(404).json({ success: false, message: 'Note introuvable.' });
    const { title, body, pinned } = req.body;
    if (title   !== undefined) note.title  = title.slice(0,200);
    if (body    !== undefined) note.body   = body.slice(0,10000);
    if (pinned  !== undefined) note.pinned = pinned;
    note.updatedAt = Date.now();
    await user.save();
    res.json({ success: true, note });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Erreur serveur.' });
  }
});

router.patch('/notes/:noteId/pin', async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    const note = user.notes.find(n => n.id === req.params.noteId);
    if (!note) return res.status(404).json({ success: false, message: 'Note introuvable.' });
    note.pinned = !note.pinned; note.updatedAt = Date.now();
    await user.save();
    res.json({ success: true, pinned: note.pinned });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Erreur serveur.' });
  }
});

router.delete('/notes/:noteId', async (req, res) => {
  try {
    await User.findByIdAndUpdate(req.user._id, { $pull: { notes: { id: req.params.noteId } } });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Erreur serveur.' });
  }
});

// ════════════════════════════════════════════════════════════
// PUSH SUBSCRIPTION (Service Worker)
// ════════════════════════════════════════════════════════════

router.post('/push/subscribe', async (req, res) => {
  try {
    const { subscription } = req.body;
    await User.findByIdAndUpdate(req.user._id, { pushSub: subscription });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Erreur serveur.' });
  }
});

module.exports = router;
