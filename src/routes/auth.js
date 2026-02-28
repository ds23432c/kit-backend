// src/routes/auth.js
const express = require('express');
const jwt     = require('jsonwebtoken');
const router  = express.Router();
const User    = require('../models/User');
const { authMiddleware } = require('../middleware/auth');

// ── POST /api/auth/login ──
// Вход по логину и паролю
router.post('/login', async (req, res) => {
  try {
    const { login, password } = req.body;

    if (!login || !password) {
      return res.status(400).json({ error: 'Введи логин и пароль' });
    }

    // Найти пользователя
    const user = await User.findOne({ login: login.trim() });
    if (!user) {
      return res.status(401).json({ error: 'Неверный логин или пароль' });
    }

    // Проверить пароль
    const ok = await user.checkPassword(password);
    if (!ok) {
      return res.status(401).json({ error: 'Неверный логин или пароль' });
    }

    // Обновить время последнего входа
    await User.findByIdAndUpdate(user._id, { lastLogin: new Date() });

    // Создать JWT-токен (живёт 7 дней)
    const token = jwt.sign(
      { id: user._id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      token,
      user: {
        id:      user._id,
        name:    user.name,
        login:   user.login,
        role:    user.role,
        groupId: user.groupId
      }
    });

  } catch (err) {
    res.status(500).json({ error: 'Ошибка сервера: ' + err.message });
  }
});

// ── GET /api/auth/me ──
router.get('/me', authMiddleware, async (req, res) => {
  res.json({ user: req.user });
});

// ── POST /api/auth/register ──
// Создать пользователя (только admin)
router.post('/register', authMiddleware, async (req, res) => {
  try {
    const { name, login, password, role, groupId, email } = req.body;
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Только администратор может создавать пользователей' });
    }
    if (!name || !login || !password || !role) {
      return res.status(400).json({ error: 'Заполни все обязательные поля' });
    }
    const exists = await User.findOne({ login });
    if (exists) return res.status(400).json({ error: 'Логин уже занят' });

    const user = await User.create({ name, login, password, role, groupId: groupId || null, email });
    res.status(201).json({ message: 'Пользователь создан', user });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/auth/users ── (только admin)
router.get('/users', authMiddleware, async (req, res) => {
  try {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Нет доступа' });
    const users = await User.find({ isActive: true }).populate('groupId', 'name').sort('name');
    res.json(users);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── PUT /api/auth/users/:id ── (только admin)
router.put('/users/:id', authMiddleware, async (req, res) => {
  try {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Нет доступа' });
    const { name, password, role, groupId, email } = req.body;

    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ error: 'Пользователь не найден' });

    if (name)              user.name    = name.trim();
    if (role)              user.role    = role;
    if (email !== undefined) user.email = email || '';
    // groupId: null = убрать привязку, строка = привязать
    user.groupId = groupId || null;

    // Пароль — только если передан и достаточно длинный (pre-save hook хеширует)
    if (password && password.trim().length >= 6) {
      user.password = password.trim();
    }

    await user.save();
    const updated = await User.findById(user._id).populate('groupId', 'name');
    res.json({ message: 'Пользователь обновлён', user: updated });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── DELETE /api/auth/users/:id ── (только admin)
router.delete('/users/:id', authMiddleware, async (req, res) => {
  try {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Нет доступа' });
    if (req.params.id === req.user._id.toString()) {
      return res.status(400).json({ error: 'Нельзя удалить самого себя' });
    }
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ error: 'Пользователь не найден' });
    await User.findByIdAndDelete(req.params.id); // полное удаление из БД
    res.json({ message: 'Пользователь удалён' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
module.exports = router;
