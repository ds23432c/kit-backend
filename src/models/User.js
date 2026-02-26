// src/models/User.js
const mongoose = require('mongoose');
const bcrypt   = require('bcryptjs');

const UserSchema = new mongoose.Schema({
  login: {
    type: String, required: true, unique: true, trim: true
  },
  password: {
    type: String, required: true, minlength: 6
  },
  role: {
    type: String,
    enum: ['admin', 'teacher', 'starosta'],
    required: true
  },
  name:  { type: String, required: true, trim: true },
  email: { type: String, trim: true, lowercase: true },

  // Для старосты — привязка к группе
  groupId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Group',
    default: null
  },

  isActive: { type: Boolean, default: true },

  // Метаданные
  createdAt: { type: Date, default: Date.now },
  lastLogin: { type: Date, default: null }
});

// Хэшируем пароль перед сохранением
UserSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

// Метод проверки пароля
UserSchema.methods.checkPassword = async function(plain) {
  return bcrypt.compare(plain, this.password);
};

// Убираем пароль из ответа
UserSchema.methods.toJSON = function() {
  const obj = this.toObject();
  delete obj.password;
  return obj;
};

module.exports = mongoose.model('User', UserSchema);
