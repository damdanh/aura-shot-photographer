const mongoose = require('mongoose');

const photoSchema = new mongoose.Schema({
  album_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Album',
    required: true
  },
  file_name: {
    type: String,
    required: true
  },
  thumbnail_url: {
    type: String,
    required: true
  },
  drive_file_id: {
    type: String,
    default: null
  },
  drive_link: {
    type: String,
    default: null
  },
  file_size: {
      type: Number,
      require: true,
      default: 0
  },
  is_favorited: {
    type: Boolean,
    default: false
  },
  is_banned: {
    type: Boolean,
    default: false
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
  face: [
    {
      box: {
        x: Number,
        y: Number,
        width: Number,
        height: Number
      },
      descriptor: {
        type: [Number]
      }
    }
  ],
  annotations: [
      {
        access_id: { type: mongoose.Schema.Types.ObjectId, ref: 'CustomerAlbumAccess' },
        coord_x: { type: Number, required: true },
        coord_y: { type: Number, required: true },
        note: { type: String, default: "" },
        createdAt: { type: Date, default: Date.now }
      }
    ]
  },{
  timestamps: true
});

module.exports = mongoose.model('Photo', photoSchema);
