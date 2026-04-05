const express = require('express');
const User = require('../models/User');
const { protect } = require('../middleware/auth');

const router = express.Router();
// Toutes les routes ici nécessitent un token JWT valide
router.use(protect);

// ─── GET /api/data ───────────────────────────────────────
// Récupérer toutes les données de l'utilisateur
router.get('/', async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('days goals');
    res.json({ success: true, data: { days: user.days, goals: user.goals } });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Erreur serveur.' });
  }
});

// ═══════════════════════════════════════════════════════
// GESTION DES JOURNÉES
// ═══════════════════════════════════════════════════════

// ─── PUT /api/data/day/:key ──────────────────────────────
// Sauvegarder/mettre à jour une journée entière
router.put('/day/:key', async (req, res) => {
  try {
    const { key } = req.params;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(key)) {
      return res.status(400).json({ success: false, message: 'Format de date invalide (YYYY-MM-DD).' });
    }

    const { tasks, memory, mood } = req.body;
    const user = await User.findById(req.user._id);
    const dayIndex = user.days.findIndex(d => d.key === key);

    if (dayIndex === -1) {
      user.days.push({ key, tasks: tasks || [], memory: memory || '', mood: mood || '' });
    } else {
      if (tasks  !== undefined) user.days[dayIndex].tasks  = tasks;
      if (memory !== undefined) user.days[dayIndex].memory = memory;
      if (mood   !== undefined) user.days[dayIndex].mood   = mood;
    }

    await user.save();
    res.json({ success: true, message: 'Journée sauvegardée.' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Erreur serveur.' });
  }
});

// ─── POST /api/data/day/:key/task ────────────────────────
// Ajouter une tâche à une journée
router.post('/day/:key/task', async (req, res) => {
  try {
    const { key } = req.params;
    const { text } = req.body;

    if (!text || !text.trim()) {
      return res.status(400).json({ success: false, message: 'Le texte de la tâche est requis.' });
    }

    const user = await User.findById(req.user._id);
    let dayIndex = user.days.findIndex(d => d.key === key);

    const newTask = {
      id: Date.now(),
      text: text.trim().slice(0, 500),
      done: false,
      createdAt: new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
    };

    if (dayIndex === -1) {
      user.days.push({ key, tasks: [newTask], memory: '', mood: '' });
    } else {
      user.days[dayIndex].tasks.push(newTask);
    }

    await user.save();
    res.status(201).json({ success: true, task: newTask });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Erreur serveur.' });
  }
});

// ─── PATCH /api/data/day/:key/task/:taskId ───────────────
// Basculer l'état done d'une tâche
router.patch('/day/:key/task/:taskId', async (req, res) => {
  try {
    const { key, taskId } = req.params;
    const user = await User.findById(req.user._id);
    const day = user.days.find(d => d.key === key);

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

// ─── DELETE /api/data/day/:key/task/:taskId ──────────────
// Supprimer une tâche
router.delete('/day/:key/task/:taskId', async (req, res) => {
  try {
    const { key, taskId } = req.params;
    const user = await User.findById(req.user._id);
    const day = user.days.find(d => d.key === key);

    if (!day) return res.status(404).json({ success: false, message: 'Journée introuvable.' });

    day.tasks = day.tasks.filter(t => t.id !== Number(taskId));
    await user.save();
    res.json({ success: true, message: 'Tâche supprimée.' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Erreur serveur.' });
  }
});

// ─── PATCH /api/data/day/:key/memory ─────────────────────
// Sauvegarder le moment mémorable
router.patch('/day/:key/memory', async (req, res) => {
  try {
    const { key } = req.params;
    const { memory, mood } = req.body;
    const user = await User.findById(req.user._id);
    let day = user.days.find(d => d.key === key);

    if (!day) {
      user.days.push({ key, tasks: [], memory: memory || '', mood: mood || '' });
    } else {
      if (memory !== undefined) day.memory = memory.slice(0, 2000);
      if (mood   !== undefined) day.mood   = mood;
    }

    await user.save();
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Erreur serveur.' });
  }
});

// ═══════════════════════════════════════════════════════
// GESTION DES OBJECTIFS
// ═══════════════════════════════════════════════════════

// ─── POST /api/data/goal ─────────────────────────────────
// Créer un objectif
router.post('/goal', async (req, res) => {
  try {
    const { title, desc, cat, deadline } = req.body;
    if (!title || !title.trim()) {
      return res.status(400).json({ success: false, message: 'Le titre est requis.' });
    }

    const newGoal = {
      id: Date.now(),
      title: title.trim().slice(0, 200),
      desc: (desc || '').slice(0, 1000),
      cat: cat || 'autre',
      deadline: deadline || '',
      done: false,
      progress: 0,
      createdAt: new Date().toISOString().split('T')[0]
    };

    await User.findByIdAndUpdate(req.user._id, { $push: { goals: newGoal } });
    res.status(201).json({ success: true, goal: newGoal });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Erreur serveur.' });
  }
});

// ─── PATCH /api/data/goal/:goalId/toggle ─────────────────
// Marquer objectif comme atteint/non atteint
router.patch('/goal/:goalId/toggle', async (req, res) => {
  try {
    const { goalId } = req.params;
    const user = await User.findById(req.user._id);
    const goal = user.goals.find(g => g.id === Number(goalId));

    if (!goal) return res.status(404).json({ success: false, message: 'Objectif introuvable.' });

    goal.done     = !goal.done;
    goal.progress = goal.done ? 100 : 0;
    await user.save();
    res.json({ success: true, done: goal.done, progress: goal.progress });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Erreur serveur.' });
  }
});

// ─── DELETE /api/data/goal/:goalId ───────────────────────
// Supprimer un objectif
router.delete('/goal/:goalId', async (req, res) => {
  try {
    const { goalId } = req.params;
    await User.findByIdAndUpdate(req.user._id, { $pull: { goals: { id: Number(goalId) } } });
    res.json({ success: true, message: 'Objectif supprimé.' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Erreur serveur.' });
  }
});

module.exports = router;
