

const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
    googleId: {
        type: String,
        unique: true,
        sparse: true // Allows null for non-Google users
    },
    username: {
        type: String,
        required: function() { return !this.googleId; }, // Required only if not a Google user
        trim: true,
        minlength: [3, 'Username must be at least 3 characters long']
    },
    password: {
        type: String,
        required: function() { return !this.googleId; }, // Required only if not a Google user
        minlength: [6, 'Password must be at least 6 characters long']
    },
    email: {
        type: String,
        required: [true, 'Email is required'],
        unique: true,
        trim: true,
        match: [/.+@.+\..+/, 'Please provide a valid email address']
    },
    phone: {
        type: String,
        required: function() { return !this.googleId; },
        match: [/^\d{10}$/, 'Phone number must be exactly 10 digits']  // Validation for phone number format
    }
}, { timestamps: true });


const User = mongoose.model('User', userSchema);

module.exports = User;
