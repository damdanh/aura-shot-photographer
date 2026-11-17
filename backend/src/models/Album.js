const mongoose = require('mongoose');

const albumSchema = new mongoose.Schema({
  user_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  name: {
    type: String,
    required: true
  },
  drive_folder_id: {
    type: String,
    required: true
  },
  pin_code: {
    type: String,
    required: true
  },
  is_locked: {
    type: Boolean,
    default: false
  },
  is_public: {
    type: Boolean,
    default: false
  },
  is_banned: {
    type: Boolean,
    default: false
  },
  status: {
    type: String,
    enum: ['active', 'banned'],
    default: 'active'
  },
  is_safe: {
    type: Boolean,
    default: true
  },
  ai_moderation_note: {
    type: String,
    default: null
  },
  restored_by: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  storage_owner: {
    type: String,
    enum: ['system', 'photographer'],
    default: 'system'
  },
  allow_free_download: {
    type: Boolean,
    default: true
  },
  retouch_notes: {
    type: String,
    default: null
  },
  expires_at: {
    type: Date,
    default: null
  }
}, { timestamps: true });

module.exports = mongoose.model('Album', albumSchema);