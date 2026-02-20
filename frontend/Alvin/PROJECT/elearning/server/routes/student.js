// server/routes/student.js
const express = require('express');
const ctrl    = require('../controllers/studentController');
const { verifyToken, requireRole } = require('../middleware/auth');

const router = express.Router();

// All student routes require a valid token and student role
router.get('/dashboard',   verifyToken, requireRole('student'), ctrl.getDashboard);
router.post('/save-query', verifyToken, requireRole('student'), ctrl.saveQuery);

module.exports = router;