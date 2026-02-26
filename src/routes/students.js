// src/routes/students.js
const express = require('express');
const router  = express.Router();
const XLSX    = require('xlsx');
const Student = require('../models/Student');
const Group   = require('../models/Group');
const { authMiddleware, requireRole } = require('../middleware/auth');

// ── GET /api/students?group=ИСП-1.1 ──
// Список студентов группы (публично — для поиска явки)
router.get('/', async (req, res) => {
  try {
    const { group, groupId } = req.query;
    let filter = { isActive: true };

    if (groupId) {
      filter.groupId = groupId;
    } else if (group) {
      const g = await Group.findOne({ name: group });
      if (!g) return res.status(404).json({ error: 'Группа не найдена' });
      filter.groupId = g._id;
    }

    const students = await Student.find(filter)
      .populate('groupId', 'name')
      .sort('fullName');

    res.json(students);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── POST /api/students ──
// Добавить одного студента (admin или teacher)
router.post('/', authMiddleware, requireRole('admin', 'teacher'), async (req, res) => {
  try {
    const { fullName, groupId, phone, email, notes } = req.body;
    if (!fullName || !groupId) {
      return res.status(400).json({ error: 'Укажи ФИО и группу' });
    }

    const student = await Student.create({ fullName, groupId, phone, email, notes });
    res.status(201).json(student);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── POST /api/students/import ──
// Массовый импорт из Excel
// Формат Excel: колонки — Группа | ФИО | Телефон (необяз.) | Email (необяз.)
router.post('/import', authMiddleware, requireRole('admin', 'teacher'), async (req, res) => {
  try {
    const { data } = req.body; // base64 строка Excel-файла

    if (!data) return res.status(400).json({ error: 'Нет данных файла' });

    // Декодируем base64 → Buffer → читаем Excel
    const buffer   = Buffer.from(data, 'base64');
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    const sheet    = workbook.Sheets[workbook.SheetNames[0]];
    const rows     = XLSX.utils.sheet_to_json(sheet);

    const results = { added: 0, skipped: 0, errors: [] };

    for (const row of rows) {
      // Поддерживаем разные названия столбцов
      const groupName = row['Группа'] || row['группа'] || row['group'];
      const fullName  = row['ФИО']    || row['фио']    || row['fullName'] || row['Студент'];

      if (!groupName || !fullName) {
        results.skipped++;
        continue;
      }

      // Находим или создаём группу
      let group = await Group.findOne({ name: groupName.trim() });
      if (!group) {
        group = await Group.create({ name: groupName.trim() });
      }

      // Проверяем не существует ли уже
      const exists = await Student.findOne({
        fullName: fullName.trim(),
        groupId: group._id
      });

      if (exists) {
        results.skipped++;
        continue;
      }

      await Student.create({
        fullName: fullName.trim(),
        groupId:  group._id,
        phone:    row['Телефон'] || null,
        email:    row['Email']   || null,
        notes:    row['Примечание'] || null
      });

      results.added++;
    }

    res.json({
      message: `Импорт завершён: добавлено ${results.added}, пропущено ${results.skipped}`,
      ...results
    });

  } catch (err) {
    res.status(500).json({ error: 'Ошибка импорта: ' + err.message });
  }
});

// ── PUT /api/students/:id ──
// Обновить студента
router.put('/:id', authMiddleware, requireRole('admin', 'teacher'), async (req, res) => {
  try {
    const student = await Student.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!student) return res.status(404).json({ error: 'Студент не найден' });
    res.json(student);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── DELETE /api/students/:id ──
// Деактивировать студента
router.delete('/:id', authMiddleware, requireRole('admin', 'teacher'), async (req, res) => {
  try {
    await Student.findByIdAndUpdate(req.params.id, { isActive: false });
    res.json({ message: 'Студент деактивирован' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
