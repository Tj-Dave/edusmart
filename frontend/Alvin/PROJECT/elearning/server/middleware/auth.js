// server/middleware/auth.js
const jwt = require('jsonwebtoken');

const verifyToken = (req, res, next) => {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Access token missing.' });
  }

  const token = header.split(' ')[1];
  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ message: 'Access token expired.', expired: true });
    }
    return res.status(401).json({ message: 'Invalid access token.' });
  }
};

const requireRole = (...roles) => {
  return (req, res, next) => {
    const allowed = roles.flat();
    if (!req.user || !allowed.includes(req.user.role)) {
      return res.status(403).json({ message: 'Access denied.' });
    }
    next();
  };
};

module.exports = { verifyToken, requireRole };