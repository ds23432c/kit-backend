// src/middleware/auth.js
const jwt  = require('jsonwebtoken');
const User = require('../models/User');

// ── Проверка токена ──
const authMiddleware = async (req, res, next) => {
  try {
    const header = req.headers.authorization;
    if (!header || !header.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Нет токена авторизации' });
    }

    const token = header.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const user = await User.findById(decoded.id).select('-password');
    if (!user || !user.isActive) {
      return res.status(401).json({ error: 'Пользователь не найден или заблокирован' });
    }

    req.user = user;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Токен недействителен или истёк' });
  }
};

// ── Проверка роли ──
const requireRole = (...roles) => (req, res, next) => {
  if (!roles.includes(req.user.role)) {
    return res.status(403).json({
      error: `Доступ запрещён. Нужна роль: ${roles.join(' или ')}`
    });
  }
  next();
};

module.exports = { authMiddleware, requireRole };
