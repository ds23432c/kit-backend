// src/models/Attendance.js
const mongoose = require('mongoose');

const AttendanceSchema = new mongoose.Schema({
  studentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Student',
    required: true
  },
  groupId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Group',
    required: true
  },
  date: {
    type: Date, required: true
    // Хранится как начало дня: 2026-02-26T00:00:00.000Z
  },
  status: {
    type: String,
    enum: [
      'present',   // ✅ Присутствует
      'late',      // ⏱ Опоздал
      'absent',    // ✗ Не явился
      'sick',      // 🤒 Болеет
      'remote',    // 💻 Дистанционно
      'family',    // 👨‍👩‍👧 Семейные обстоятельства
      'other'      // 📝 Другое
    ],
    default: 'present'
  },
  comment: { type: String, default: null, maxlength: 500 },

  // Кто поставил отметку
  markedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  markedByRole: {
    type: String,
    enum: ['admin', 'teacher', 'starosta'],
    required: true
  },
  markedAt: { type: Date, default: Date.now },

  // История изменений
  history: [{
    status:   String,
    comment:  String,
    changedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    changedAt: { type: Date, default: Date.now }
  }]
});

// Один студент — одна запись в день
AttendanceSchema.index({ studentId: 1, date: 1 }, { unique: true });
AttendanceSchema.index({ groupId: 1, date: 1 });

module.exports = mongoose.model('Attendance', AttendanceSchema);
