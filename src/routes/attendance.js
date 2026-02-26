// src/routes/attendance.js
const express    = require('express');
const router     = express.Router();
const Attendance = require('../models/Attendance');
const Student    = require('../models/Student');
const Group      = require('../models/Group');
const { authMiddleware, requireRole } = require('../middleware/auth');

// Статусы на русском для ответов
const STATUS_LABELS = {
  present: '✅ Присутствует',
  late:    '⏱ Опоздал',
  absent:  '✗ Не явился',
  sick:    '🤒 Болеет',
  remote:  '💻 Дистанционно',
  family:  '👨‍👩‍👧 Семейные обстоятельства',
  other:   '📝 Другое'
};

// ── GET /api/attendance/student/:studentId ──
// Явка конкретного студента (публично — для поиска)
router.get('/student/:studentId', async (req, res) => {
  try {
    const { from, to } = req.query;
    const filter = { studentId: req.params.studentId };

    if (from || to) {
      filter.date = {};
      if (from) filter.date.$gte = new Date(from);
      if (to)   filter.date.$lte = new Date(to);
    }

    const records = await Attendance.find(filter)
      .select('date status comment')
      .sort('date');

    // Считаем статистику
    const stats = {
      present: 0, late: 0, absent: 0, sick: 0, remote: 0, total: records.length
    };
    records.forEach(r => {
      if (stats[r.status] !== undefined) stats[r.status]++;
    });

    res.json({ records, stats });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/attendance/group/:groupId?date=2026-02-26 ──
// Явка всей группы за день
router.get('/group/:groupId', authMiddleware, async (req, res) => {
  try {
    const { date } = req.query;
    const targetDate = date ? new Date(date) : new Date();

    // Начало и конец дня
    const start = new Date(targetDate); start.setHours(0,0,0,0);
    const end   = new Date(targetDate); end.setHours(23,59,59,999);

    // Все студенты группы
    const students = await Student.find({
      groupId: req.params.groupId, isActive: true
    }).sort('fullName');

    // Отметки за этот день
    const records = await Attendance.find({
      groupId: req.params.groupId,
      date: { $gte: start, $lte: end }
    }).populate('markedBy', 'name role');

    // Совмещаем студентов с отметками
    const result = students.map(s => {
      const rec = records.find(r => r.studentId.toString() === s._id.toString());
      return {
        student: { _id: s._id, fullName: s.fullName },
        attendance: rec ? {
          status:   rec.status,
          label:    STATUS_LABELS[rec.status],
          comment:  rec.comment,
          markedBy: rec.markedBy,
          markedAt: rec.markedAt
        } : null
      };
    });

    res.json({ date: targetDate, group: req.params.groupId, students: result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── POST /api/attendance ──
// Поставить отметку (старосты, куратора или админа)
router.post('/', authMiddleware, async (req, res) => {
  try {
    const { studentId, groupId, date, status, comment } = req.body;

    if (!studentId || !status) {
      return res.status(400).json({ error: 'Укажи студента и статус' });
    }

    const targetDate = new Date(date || new Date());
    targetDate.setHours(0,0,0,0);

    // Проверяем существующую запись
    const existing = await Attendance.findOne({ studentId, date: targetDate });

    if (existing) {
      // Сохраняем историю изменения
      existing.history.push({
        status:    existing.status,
        comment:   existing.comment,
        changedBy: req.user._id,
        changedAt: new Date()
      });
      existing.status    = status;
      existing.comment   = comment || null;
      existing.markedBy  = req.user._id;
      existing.markedByRole = req.user.role;
      existing.markedAt  = new Date();
      await existing.save();
      return res.json({ message: 'Отметка обновлена', record: existing });
    }

    // Создаём новую запись
    const record = await Attendance.create({
      studentId,
      groupId: groupId || (await Student.findById(studentId))?.groupId,
      date:    targetDate,
      status,
      comment: comment || null,
      markedBy: req.user._id,
      markedByRole: req.user.role
    });

    res.status(201).json({ message: 'Отметка поставлена', record });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── POST /api/attendance/bulk ──
// Массовая отметка (вся группа за один раз — для старосты)
router.post('/bulk', authMiddleware, async (req, res) => {
  try {
    const { groupId, date, records } = req.body;
    // records = [{ studentId, status, comment }, ...]

    if (!groupId || !records?.length) {
      return res.status(400).json({ error: 'Укажи группу и список отметок' });
    }

    const targetDate = new Date(date || new Date());
    targetDate.setHours(0,0,0,0);

    let saved = 0;
    for (const rec of records) {
      await Attendance.findOneAndUpdate(
        { studentId: rec.studentId, date: targetDate },
        {
          studentId:    rec.studentId,
          groupId,
          date:         targetDate,
          status:       rec.status || 'present',
          comment:      rec.comment || null,
          markedBy:     req.user._id,
          markedByRole: req.user.role,
          markedAt:     new Date()
        },
        { upsert: true, new: true }
      );
      saved++;
    }

    res.json({ message: `Сохранено отметок: ${saved}` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/attendance/report?groupId=...&from=...&to=... ──
// Отчёт за период (для куратора / экспорт)
router.get('/report', authMiddleware, requireRole('admin', 'teacher'), async (req, res) => {
  try {
    const { groupId, from, to } = req.query;
    if (!groupId || !from || !to) {
      return res.status(400).json({ error: 'Укажи groupId, from и to' });
    }

    const students = await Student.find({ groupId, isActive: true }).sort('fullName');
    const records  = await Attendance.find({
      groupId,
      date: { $gte: new Date(from), $lte: new Date(to) }
    }).sort('date');

    // Формируем матрицу: студент × дата
    const report = students.map(s => {
      const sRecords = records.filter(r => r.studentId.toString() === s._id.toString());
      const stats = { present:0, late:0, absent:0, sick:0, remote:0, family:0, other:0 };
      sRecords.forEach(r => { if (stats[r.status] !== undefined) stats[r.status]++; });

      return {
        student: { _id: s._id, fullName: s.fullName },
        records: sRecords.map(r => ({
          date: r.date, status: r.status,
          label: STATUS_LABELS[r.status], comment: r.comment
        })),
        stats,
        attendanceRate: sRecords.length > 0
          ? Math.round(((stats.present + stats.late + stats.remote) / sRecords.length) * 100)
          : 0
      };
    });

    res.json({ from, to, groupId, report });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
