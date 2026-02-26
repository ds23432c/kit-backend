// src/routes/dashboard.js
const express    = require('express');
const router     = express.Router();
const Group      = require('../models/Group');
const Student    = require('../models/Student');
const Attendance = require('../models/Attendance');
const { authMiddleware } = require('../middleware/auth');

// ── GET /api/dashboard/today ──
// Сводка на главную страницу (публично — только агрегированные данные)
router.get('/today', async (req, res) => {
  try {
    const today = new Date(); today.setHours(0,0,0,0);
    const end   = new Date(); end.setHours(23,59,59,999);

    const [totalGroups, totalStudents, todayRecords] = await Promise.all([
      Group.countDocuments({ isActive: true }),
      Student.countDocuments({ isActive: true }),
      Attendance.find({ date: { $gte: today, $lte: end } })
    ]);

    // Группы которые уже отметились
    const markedGroupIds = [...new Set(todayRecords.map(r => r.groupId?.toString()))];

    // Статистика по статусам
    const stats = { present:0, late:0, absent:0, sick:0, remote:0, family:0, other:0 };
    todayRecords.forEach(r => { if (stats[r.status] !== undefined) stats[r.status]++; });

    // Процент явки
    const total = todayRecords.length;
    const attendRate = total > 0
      ? Math.round(((stats.present + stats.late + stats.remote) / total) * 100)
      : 0;

    res.json({
      totalGroups,
      totalStudents,
      markedGroups: markedGroupIds.length,
      attendanceRate: attendRate,
      stats,
      date: today
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/dashboard/groups-summary ──
// Сводка по всем группам (для главной — рейтинг явки)
router.get('/groups-summary', async (req, res) => {
  try {
    const today = new Date(); today.setHours(0,0,0,0);
    const end   = new Date(); end.setHours(23,59,59,999);

    const groups = await Group.find({ isActive: true }).sort('name');
    const result = [];

    for (const g of groups) {
      const totalStudents = await Student.countDocuments({ groupId: g._id, isActive: true });
      const records = await Attendance.find({
        groupId: g._id,
        date: { $gte: today, $lte: end }
      });

      const present = records.filter(r =>
        ['present','late','remote'].includes(r.status)).length;
      const absent  = records.filter(r => r.status === 'absent').length;
      const sick    = records.filter(r => r.status === 'sick').length;
      const marked  = records.length > 0;
      const rate    = totalStudents > 0 ? Math.round((present / totalStudents) * 100) : 0;

      result.push({
        _id:    g._id,
        name:   g.name,
        totalStudents,
        present, absent, sick,
        attendanceRate: rate,
        isMarked: marked,
        // Цветовой статус
        statusIcon: !marked ? '❓' : absent === 0 ? '✅' : absent <= 2 ? '⚠️' : '❌'
      });
    }

    // Сортируем по явке
    result.sort((a,b) => b.attendanceRate - a.attendanceRate);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/dashboard/full ──
// Полный дашборд (только для авторизованных)
router.get('/full', authMiddleware, async (req, res) => {
  try {
    const today = new Date(); today.setHours(0,0,0,0);
    const weekAgo = new Date(today); weekAgo.setDate(weekAgo.getDate() - 7);

    // Явка за последние 7 дней
    const weekRecords = await Attendance.find({
      date: { $gte: weekAgo, $lte: new Date() }
    });

    // Группируем по дням
    const byDay = {};
    weekRecords.forEach(r => {
      const day = r.date.toISOString().split('T')[0];
      if (!byDay[day]) byDay[day] = { total:0, present:0 };
      byDay[day].total++;
      if (['present','late','remote'].includes(r.status)) byDay[day].present++;
    });

    const chartData = Object.entries(byDay).map(([date, d]) => ({
      date,
      rate: d.total > 0 ? Math.round((d.present / d.total) * 100) : 0
    })).sort((a,b) => a.date.localeCompare(b.date));

    res.json({ chartData });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
