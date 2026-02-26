// src/models/News.js
const mongoose = require('mongoose');

const NewsSchema = new mongoose.Schema({
  title:    { type: String, required: true, trim: true },
  content:  { type: String, required: true },
  category: {
    type: String,
    enum: ['contest', 'conference', 'news'],
    default: 'news'
  },
  imageUrl: { type: String, default: null },
  fileUrl:  { type: String, default: null },
  fileName: { type: String, default: null },

  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  isActive:  { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('News', NewsSchema);
