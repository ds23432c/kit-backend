// src/routes/groups.js
const express = require('express');
const router  = express.Router();
const Group   = require('../models/Group');
const { authMiddleware, requireRole } = require('../middleware/auth');

// ── GET /api/groups ──
// Все группы (публично — для поиска студентом)
router.get('/', async (req, res) => {
  try {
    const groups = await Group.find({ isActive: true })
      .populate('curatorId', 'name email')
      .sort('name');
    res.json(groups);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/groups/:id ──
// Одна группа с куратором и старостой
router.get('/:id', authMiddleware, async (req, res) => {
  try {
    const group = await Group.findById(req.params.id)
      .populate('curatorId',  'name email')
      .populate('starostaId', 'name');
    if (!group) return res.status(404).json({ error: 'Группа не найдена' });
    res.json(group);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── POST /api/groups ──
// Создать группу (только admin)
router.post('/', authMiddleware, requireRole('admin'), async (req, res) => {
  try {
    const { name, curatorId } = req.body;
    if (!name) return res.status(400).json({ error: 'Укажи название группы' });

    const exists = await Group.findOne({ name: name.trim() });
    if (exists) return res.status(400).json({ error: 'Группа уже существует' });

    const group = await Group.create({ name: name.trim(), curatorId });
    res.status(201).json(group);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── PUT /api/groups/:id ──
// Обновить группу (admin или teacher)
router.put('/:id', authMiddleware, requireRole('admin', 'teacher'), async (req, res) => {
  try {
    const { name, curatorId, starostaId, starostaPassword } = req.body;
    const group = await Group.findByIdAndUpdate(
      req.params.id,
      { name, curatorId, starostaId, starostaPassword },
      { new: true, runValidators: true }
    );
    if (!group) return res.status(404).json({ error: 'Группа не найдена' });
    res.json(group);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── DELETE /api/groups/:id ──
// Удалить (деактивировать) группу (только admin)
router.delete('/:id', authMiddleware, requireRole('admin'), async (req, res) => {
  try {
    await Group.findByIdAndUpdate(req.params.id, { isActive: false });
    res.json({ message: 'Группа деактивирована' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
