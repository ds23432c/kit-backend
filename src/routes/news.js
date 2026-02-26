// src/routes/news.js
const express = require('express');
const router  = express.Router();
const News    = require('../models/News');
const { authMiddleware, requireRole } = require('../middleware/auth');

// GET /api/news — публично
router.get('/', async (req, res) => {
  try {
    const news = await News.find({ isActive: true })
      .populate('createdBy', 'name')
      .sort({ createdAt: -1 })
      .limit(20);
    res.json(news);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/news — только admin
router.post('/', authMiddleware, requireRole('admin'), async (req, res) => {
  try {
    const { title, content, category, imageUrl, fileUrl, fileName } = req.body;
    if (!title || !content) {
      return res.status(400).json({ error: 'Заголовок и текст обязательны' });
    }
    const item = await News.create({
      title, content, category, imageUrl, fileUrl, fileName,
      createdBy: req.user._id
    });
    res.status(201).json(item);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/news/:id — только admin
router.put('/:id', authMiddleware, requireRole('admin'), async (req, res) => {
  try {
    const item = await News.findByIdAndUpdate(
      req.params.id,
      { ...req.body, updatedAt: new Date() },
      { new: true }
    );
    res.json(item);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/news/:id
router.delete('/:id', authMiddleware, requireRole('admin'), async (req, res) => {
  try {
    await News.findByIdAndUpdate(req.params.id, { isActive: false });
    res.json({ message: 'Новость удалена' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
