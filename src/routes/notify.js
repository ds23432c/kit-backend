// src/routes/notify.js
// ═══════════════════════════════════════════
//   КИТ — Маршруты email уведомлений
// ═══════════════════════════════════════════

const express    = require('express');
const router     = express.Router();
const Attendance = require('../models/Attendance');
const Student    = require('../models/Student');
const Group      = require('../models/Group');
const User       = require('../models/User');
const { authMiddleware, requireRole } = require('../middleware/auth');
const { sendEmail, buildAbsenceEmail, buildStreakEmail, verifyConnection } = require('../services/emailService');

// ── GET /api/notify/test-connection ──
// Проверить подключение к email серверу
router.get('/test-connection', authMiddleware, requireRole('admin'), async (req, res) => {
  const result = await verifyConnection();
  res.json(result);
});

// ── POST /api/notify/absence ──
// Отправить уведомление куратору об отсутствиях за день
// Вызывается автоматически после сохранения явки
router.post('/absence', authMiddleware, async (req, res) => {
  try {
    const { groupId, date } = req.body;
    if (!groupId) return res.status(400).json({ error: 'Укажи groupId' });

    const targetDate = new Date(date || new Date());
    targetDate.setHours(0,0,0,0);
    const endDate = new Date(targetDate);
    endDate.setHours(23,59,59,999);

    // Получаем группу с куратором
    const group = await Group.findById(groupId).populate('curatorId');
    if (!group) return res.status(404).json({ error: 'Группа не найдена' });

    // Куратор должен быть назначен и иметь email
    const curator = group.curatorId;
    if (!curator || !curator.email) {
      return res.json({ ok: false, message: 'У куратора нет email — письмо не отправлено' });
    }

    // Получаем отсутствующих за этот день
    const records = await Attendance.find({
      groupId,
      date: { $gte: targetDate, $lte: endDate },
      status: { $in: ['absent', 'sick', 'late', 'family', 'other'] }
    }).populate('studentId', 'fullName');

    if (!records.length) {
      return res.json({ ok: true, message: 'Все присутствуют — письмо не нужно' });
    }

    const students = records.map(r => ({
      fullName: r.studentId?.fullName || 'Неизвестный',
      status:   r.status,
      comment:  r.comment
    }));

    const { subject, html, text } = buildAbsenceEmail({
      teacherName: curator.name,
      groupName:   group.name,
      date:        targetDate,
      students
    });

    const result = await sendEmail({ to: curator.email, subject, html, text });
    res.json({ ...result, recipients: students.length });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── POST /api/notify/send-manual ──
// Ручная отправка — администратор отправляет куратору
router.post('/send-manual', authMiddleware, requireRole('admin', 'teacher'), async (req, res) => {
  try {
    const { groupId, date, toEmail } = req.body;

    const targetDate = new Date(date || new Date());
    targetDate.setHours(0,0,0,0);
    const endDate = new Date(targetDate);
    endDate.setHours(23,59,59,999);

    const group = await Group.findById(groupId).populate('curatorId');
    if (!group) return res.status(404).json({ error: 'Группа не найдена' });

    const records = await Attendance.find({
      groupId,
      date: { $gte: targetDate, $lte: endDate },
      status: { $in: ['absent', 'sick', 'late', 'family', 'other'] }
    }).populate('studentId', 'fullName');

    if (!records.length) {
      return res.json({ ok: false, message: 'Нет отсутствующих за этот день' });
    }

    const students = records.map(r => ({
      fullName: r.studentId?.fullName || '—',
      status:   r.status,
      comment:  r.comment
    }));

    const recipientEmail = toEmail || group.curatorId?.email;
    if (!recipientEmail) return res.status(400).json({ error: 'Укажи email получателя' });

    const teacherName = group.curatorId?.name || 'Куратор';
    const { subject, html, text } = buildAbsenceEmail({
      teacherName,
      groupName: group.name,
      date:      targetDate,
      students
    });

    const result = await sendEmail({ to: recipientEmail, subject, html, text });
    res.json({ ...result, recipients: students.length, to: recipientEmail });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── POST /api/notify/streak-check ──
// Проверить всех студентов на 3+ дней подряд
// Запускается по расписанию или вручную
router.post('/streak-check', authMiddleware, requireRole('admin', 'teacher'), async (req, res) => {
  try {
    const { groupId } = req.body;

    const groups = groupId
      ? [await Group.findById(groupId).populate('curatorId')]
      : await Group.find({ isActive: true }).populate('curatorId');

    const now     = new Date();
    const twoWeeks = new Date(now - 14 * 24 * 60 * 60 * 1000);
    let sentCount = 0;
    const alerts  = [];

    for (const group of groups) {
      if (!group) continue;
      const students = await Student.find({ groupId: group._id, isActive: true });

      for (const student of students) {
        const records = await Attendance.find({
          studentId: student._id,
          date: { $gte: twoWeeks, $lte: now }
        }).sort('date');

        // Считаем серию подряд
        let streak = 0;
        let lastDate = null;
        for (const rec of records) {
          if (['absent','sick','family'].includes(rec.status)) {
            streak++;
            lastDate = rec.date;
          } else {
            streak = 0;
          }
        }

        if (streak >= 3) {
          alerts.push({
            student: student.fullName,
            group:   group.name,
            streak,
            lastDate
          });

          // Отправляем письмо куратору если есть email
          if (group.curatorId?.email) {
            const { subject, html } = buildStreakEmail({
              teacherName: group.curatorId.name,
              groupName:   group.name,
              student:     { fullName: student.fullName },
              streak,
              lastDate
            });
            await sendEmail({ to: group.curatorId.email, subject, html });
            sentCount++;
          }
        }
      }
    }

    res.json({
      ok: true,
      alertsFound: alerts.length,
      emailsSent:  sentCount,
      alerts
    });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── POST /api/notify/test-email ──
// Отправить тестовое письмо (только admin)
router.post('/test-email', authMiddleware, requireRole('admin'), async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'Укажи email' });

    const result = await sendEmail({
      to:      email,
      subject: '✅ КИТ — Тест email уведомлений',
      html: `
        <div style="font-family:Arial;padding:28px;background:#f5f7fa;border-radius:12px;max-width:500px">
          <div style="background:linear-gradient(135deg,#1565C0,#00BCD4);padding:20px;border-radius:8px;margin-bottom:20px">
            <h2 style="color:#fff;margin:0">✅ Email работает!</h2>
          </div>
          <p style="color:#333">Система уведомлений ОБПОУ КИТ настроена и работает корректно.</p>
          <p style="color:#666;font-size:13px">Письмо отправлено: ${new Date().toLocaleString('ru-RU')}</p>
        </div>`,
      text: 'КИТ: Email уведомления работают! ' + new Date().toLocaleString('ru-RU')
    });

    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
