// src/models/Student.js
const mongoose = require('mongoose');

const StudentSchema = new mongoose.Schema({
  fullName: {
    type: String, required: true, trim: true
    // Пример: "Алтунин Даниил Павлович"
  },
  groupId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Group',
    required: true
  },
  isActive: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now },

  // Дополнительно
  phone:  { type: String, default: null },
  email:  { type: String, default: null },
  notes:  { type: String, default: null }
});

// Индекс для быстрого поиска
StudentSchema.index({ groupId: 1, fullName: 1 });

module.exports = mongoose.model('Student', StudentSchema);
