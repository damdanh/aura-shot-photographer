const mongoose = require('mongoose');
const softDeletePlugin = require('../plugins/softDelete');
const Package = require('./Package');

const userSchema = new mongoose.Schema({
    package_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Package', 
        default: null
    },
    photographer_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        default: null
    },
    email: {
        type: String,
        required: true,
        unique: true, 
        trim: true,
        lowercase: true
    },
    password: {
        type: String,
        required: true,
    },
    full_name: {
        type: String,
        required: true
    },
    role: {
        type: String,
        enum: ['customer', 'photographer', 'admin', 'super_admin'],
        default: 'photographer'
    },
    phone: {
        type: String,
        default: null
    },
    avatar_url: { 
        type: String,
        default: null
    },
    is_active: {
        type: Boolean,
        default: true
    },
    is_banned: {
        type: Boolean,
        default: false
    },
    googleDrive: {
        isConnected: { type: Boolean, default: false },
        refreshToken: { type: String, default: null },
        rootFolderId: { type: String, default: null }
    },
    used_storage_bytes: {
        type: Number,
        default: 0
    }
}, { timestamps: true });


userSchema.plugin(softDeletePlugin);

module.exports = mongoose.model('User', userSchema);