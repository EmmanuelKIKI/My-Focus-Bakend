const express = require('express');
const User     = require('../models/User');
const LoginLog = require('../models/LoginLog');
const { protect, adminOnly } = require('../middleware/auth');

const router = express.Router();
router.use(protect, adminOnly);

// ─── GET /api/admin/stats ────────────────────────────────
// Statistiques globales du tableau de bord
router.get('/stats', async (req, res) => {
  try {
    const now   = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const week  = new Date(today); week.setDate(week.getDate() - 7);
    const month = new Date(today); month.setDate(month.getDate() - 30);

    const [
      totalUsers,
      newToday,
      newThisWeek,
      newThisMonth,
      loginsToday,
      loginsThisWeek,
      loginsThisMonth,
      activeToday,
      recentLogins
    ] = await Promise.all([
      User.countDocuments(),
      User.countDocuments({ createdAt: { $gte: today } }),
      User.countDocuments({ createdAt: { $gte: week } }),
      User.countDocuments({ createdAt: { $gte: month } }),
      LoginLog.countDocuments({ loginAt: { $gte: today } }),
      LoginLog.countDocuments({ loginAt: { $gte: week } }),
      LoginLog.countDocuments({ loginAt: { $gte: month } }),
      User.countDocuments({ lastActiveAt: { $gte: today } }),
      // 10 dernières connexions
      LoginLog.find().sort({ loginAt: -1 }).limit(10)
        .select('userName userPhone loginAt type')
    ]);

    // Connexions par jour sur les 30 derniers jours
    const dailyLogins = await LoginLog.aggregate([
      { $match: { loginAt: { $gte: month } } },
      {
        $group: {
          _id: {
            y: { $year: '$loginAt' },
            m: { $month: '$loginAt' },
            d: { $dayOfMonth: '$loginAt' }
          },
          count: { $sum: 1 }
        }
      },
      { $sort: { '_id.y': 1, '_id.m': 1, '_id.d': 1 } }
    ]);

    // Formater les données quotidiennes
    const dailyData = dailyLogins.map(d => ({
      date: `${d._id.y}-${String(d._id.m).padStart(2,'0')}-${String(d._id.d).padStart(2,'0')}`,
      count: d.count
    }));

    res.json({
      success: true,
      stats: {
        users:  { total: totalUsers, today: newToday, week: newThisWeek, month: newThisMonth },
        logins: { today: loginsToday, week: loginsThisWeek, month: loginsThisMonth },
        activeToday,
        dailyData,
        recentLogins
      }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Erreur serveur.' });
  }
});

// ─── GET /api/admin/users ────────────────────────────────
// Liste de tous les utilisateurs avec leurs stats
router.get('/users', async (req, res) => {
  try {
    const page  = parseInt(req.query.page)  || 1;
    const limit = parseInt(req.query.limit) || 20;
    const search = req.query.search || '';

    const query = search
      ? { $or: [
          { name:  { $regex: search, $options: 'i' } },
          { phone: { $regex: search, $options: 'i' } }
        ]}
      : {};

    const [users, total] = await Promise.all([
      User.find(query)
        .select('name phone createdAt lastLoginAt loginCount lastActiveAt isAdmin days goals')
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit),
      User.countDocuments(query)
    ]);

    // Calculer les stats par utilisateur
    const usersWithStats = users.map(u => {
      const totalTasks = u.days.reduce((acc, d) => acc + (d.tasks?.length || 0), 0);
      const doneTasks  = u.days.reduce((acc, d) => acc + (d.tasks?.filter(t => t.done).length || 0), 0);
      const activeDays = u.days.filter(d => d.tasks?.length > 0).length;
      return {
        id:           u._id,
        name:         u.name,
        phone:        u.phone,
        isAdmin:      u.isAdmin,
        createdAt:    u.createdAt,
        lastLoginAt:  u.lastLoginAt,
        lastActiveAt: u.lastActiveAt,
        loginCount:   u.loginCount || 0,
        totalTasks,
        doneTasks,
        activeDays,
        goalsCount:   u.goals?.length || 0
      };
    });

    res.json({
      success: true,
      users: usersWithStats,
      pagination: { total, page, pages: Math.ceil(total / limit) }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Erreur serveur.' });
  }
});

// ─── GET /api/admin/logs ─────────────────────────────────
// Historique complet des connexions
router.get('/logs', async (req, res) => {
  try {
    const page  = parseInt(req.query.page)  || 1;
    const limit = parseInt(req.query.limit) || 30;

    const [logs, total] = await Promise.all([
      LoginLog.find().sort({ loginAt: -1 }).skip((page - 1) * limit).limit(limit),
      LoginLog.countDocuments()
    ]);

    res.json({
      success: true,
      logs,
      pagination: { total, page, pages: Math.ceil(total / limit) }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Erreur serveur.' });
  }
});

// ─── PATCH /api/admin/users/:id/toggle-admin ─────────────
// Promouvoir/rétrograder un utilisateur en admin
router.patch('/users/:id/toggle-admin', async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ success: false, message: 'Utilisateur introuvable.' });
    // Ne pas se rétrograder soi-même
    if (user._id.toString() === req.user._id.toString()) {
      return res.status(400).json({ success: false, message: 'Vous ne pouvez pas modifier votre propre rôle.' });
    }
    user.isAdmin = !user.isAdmin;
    await user.save();
    res.json({ success: true, isAdmin: user.isAdmin });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Erreur serveur.' });
  }
});

module.exports = router;
