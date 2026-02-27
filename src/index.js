// ══════════════════════════════════════════
//   КИТ — Главный файл сервера
//   src/index.js
// ══════════════════════════════════════════

require('dotenv').config();
const express    = require('express');
const mongoose   = require('mongoose');
const cors       = require('cors');
const helmet     = require('helmet');
const morgan     = require('morgan');
const rateLimit  = require('express-rate-limit');

const app = express();

// ── Безопасность ──
app.use(helmet());
app.use(morgan('dev'));

// ── Rate limiting (защита от спама) ──
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 минут
  max: 200,
  message: { error: 'Слишком много запросов. Попробуй через 15 минут.' }
});
app.use('/api/', limiter);

// ── CORS (разрешаем фронтенду обращаться к API) ──
app.use(cors({
  origin: [
    process.env.FRONTEND_URL || 'http://ejournal-kit.ru',
    'http://localhost:3000',
    'http://localhost:5500',
    // добавь сюда свой домен при деплое
  ],
  credentials: true
}));

// ── JSON парсер ──
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// ══ МАРШРУТЫ API ══
app.use('/api/auth',       require('./routes/auth'));
app.use('/api/groups',     require('./routes/groups'));
app.use('/api/students',   require('./routes/students'));
app.use('/api/attendance', require('./routes/attendance'));
app.use('/api/news',       require('./routes/news'));
app.use('/api/dashboard',  require('./routes/dashboard'));
app.use('/api/notify',     require('./routes/notify'));

// ── Главная проверка ──
app.get('/', (req, res) => {
  res.json({
    status: 'ok',
    message: '✅ КИТ API v2.0 работает',
    time: new Date().toLocaleString('ru-RU', { timeZone: 'Asia/Yekaterinburg' })
  });
});

// ── 404 ──
app.use('*', (req, res) => {
  res.status(404).json({ error: 'Маршрут не найден' });
});

// ── Глобальный обработчик ошибок ──
app.use((err, req, res, next) => {
  console.error('❌ Ошибка:', err.message);
  res.status(err.status || 500).json({
    error: err.message || 'Внутренняя ошибка сервера'
  });
});

// ══ ПОДКЛЮЧЕНИЕ К MongoDB ══
const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ MongoDB подключена — база KITBD');
  } catch (err) {
    console.error('❌ Ошибка подключения к MongoDB:', err.message);
    process.exit(1);
  }
};

// ══ ЗАПУСК ══
const PORT = process.env.PORT || 3001;
connectDB().then(() => {
  app.listen(PORT, () => {
    console.log(`🚀 КИТ-сервер запущен на порту ${PORT}`);
    console.log(`📡 API: http://localhost:${PORT}/api`);
  });
});
