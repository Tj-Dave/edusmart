// server/routes/auth.js
const express    = require('express');
const { body, validationResult } = require('express-validator');
const rateLimit  = require('express-rate-limit');
const ctrl       = require('../controllers/authController');
const { verifyToken } = require('../middleware/auth');

const router = express.Router();

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { message: 'Too many login attempts. Please try again in 15 minutes.' },
});

const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(422).json({ message: errors.array()[0].msg });
  next();
};

router.post('/login',
  loginLimiter,
  [
    body('mustId').trim().notEmpty().withMessage('MUST ID is required.'),
    body('password').notEmpty().withMessage('Password is required.'),
    body('role').isIn(['student','lecturer']).withMessage('Invalid role.'),
  ],
  validate,
  ctrl.login
);

router.post('/register',
  [
    body('mustId').trim().notEmpty().withMessage('MUST ID is required.'),
    body('fullName').trim().isLength({ min: 2 }).withMessage('Full name is required.'),
    body('email').isEmail().withMessage('Valid email required.').normalizeEmail(),
    body('password')
      .isLength({ min: 8 }).withMessage('Password must be at least 8 characters.')
      .matches(/[A-Z]/).withMessage('Password needs an uppercase letter.')
      .matches(/[0-9]/).withMessage('Password needs a number.'),
    body('role').isIn(['student','lecturer']).withMessage('Invalid role.'),
  ],
  validate,
  ctrl.register
);

router.post('/refresh', ctrl.refresh);
router.post('/logout',  ctrl.logout);
router.get('/me',       verifyToken, ctrl.me);

module.exports = router;