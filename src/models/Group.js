// src/models/Group.js
const mongoose = require('mongoose');

const GroupSchema = new mongoose.Schema({
  name: {
    type: String, required: true, unique: true, trim: true
    // Пример: "ИСП-1.1", "ССА-2.1"
  },
  curatorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  starostaId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  // Пароль для входа старосты (хранится открыто — куратор его видит)
  starostaPassword: {
    type: String, default: null
  },
  isActive: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Group', GroupSchema);
