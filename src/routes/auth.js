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
// Получить данные текущего пользователя
router.get('/me', authMiddleware, async (req, res) => {
  res.json({ user: req.user });
});

module.exports = router;
