// server/controllers/authController.js
const bcrypt    = require('bcryptjs');
const jwt       = require('jsonwebtoken');
const UserModel = require('../models/usermodel');

const signAccess  = (p) => jwt.sign(p, process.env.JWT_SECRET,         { expiresIn: process.env.JWT_EXPIRES_IN  || '15m' });
const signRefresh = (p) => jwt.sign(p, process.env.JWT_REFRESH_SECRET, { expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d' });

const COOKIE = {
  httpOnly: true,
  secure:   process.env.NODE_ENV === 'production',
  sameSite: 'strict',
  maxAge:   7 * 24 * 60 * 60 * 1000,
  path:     '/api/auth',
};

exports.login = async (req, res) => {
  try {
    const { mustId, password, role } = req.body;
    const user = await UserModel.findByMustIdAndRole(mustId, role);
    if (!user)            return res.status(401).json({ message: 'Invalid MUST ID, password, or role.' });
    if (!user.is_active)  return res.status(403).json({ message: 'Account deactivated. Contact your administrator.' });

    const valid = await bcrypt.compare(password, user.password);
    if (!valid)           return res.status(401).json({ message: 'Invalid MUST ID, password, or role.' });

    const payload      = { id: user.id, role: user.role };
    const accessToken  = signAccess(payload);
    const refreshToken = signRefresh(payload);
    const expiresAt    = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    await UserModel.saveRefreshToken(user.id, refreshToken, expiresAt);
    res.cookie('refreshToken', refreshToken, COOKIE);

    return res.status(200).json({
      message: 'Login successful',
      accessToken,
      user: {
        id:          user.id,
        mustId:      user.must_id,
        fullName:    user.full_name,
        email:       user.email,
        role:        user.role,
        department:  user.department,
        yearOfStudy: user.year_of_study,
      },
    });
  } catch (err) {
    console.error('[login]', err);
    return res.status(500).json({ message: 'Server error. Please try again.' });
  }
};

exports.register = async (req, res) => {
  try {
    const { mustId, fullName, email, password, role, department, yearOfStudy } = req.body;
    const { mustIdExists, emailExists } = await UserModel.exists({ mustId, email });
    if (mustIdExists) return res.status(409).json({ message: 'MUST ID already registered.' });
    if (emailExists)  return res.status(409).json({ message: 'Email already in use.' });

    const hashedPassword = await bcrypt.hash(password, 12);
    const newUser = await UserModel.create({ mustId, fullName, email, hashedPassword, role, department, yearOfStudy });

    return res.status(201).json({
      message: 'Account created successfully.',
      user: { id: newUser.id, mustId: newUser.must_id, fullName: newUser.full_name, email: newUser.email, role: newUser.role },
    });
  } catch (err) {
    console.error('[register]', err);
    return res.status(500).json({ message: 'Server error. Please try again.' });
  }
};

exports.refresh = async (req, res) => {
  try {
    const token = req.cookies?.refreshToken;
    if (!token) return res.status(401).json({ message: 'No refresh token.' });

    let decoded;
    try { decoded = jwt.verify(token, process.env.JWT_REFRESH_SECRET); }
    catch { return res.status(401).json({ message: 'Invalid or expired token.' }); }

    const dbToken = await UserModel.findRefreshToken(token);
    if (!dbToken) return res.status(401).json({ message: 'Token revoked.' });

    const accessToken = signAccess({ id: decoded.id, role: decoded.role });
    return res.status(200).json({ accessToken });
  } catch (err) {
    console.error('[refresh]', err);
    return res.status(500).json({ message: 'Server error.' });
  }
};

exports.logout = async (req, res) => {
  try {
    const token = req.cookies?.refreshToken;
    if (token) await UserModel.deleteRefreshToken(token);
    res.clearCookie('refreshToken', { path: '/api/auth' });
    return res.status(200).json({ message: 'Logged out.' });
  } catch (err) {
    console.error('[logout]', err);
    return res.status(500).json({ message: 'Server error.' });
  }
};

exports.me = async (req, res) => {
  try {
    const user = await UserModel.findById(req.user.id);
    if (!user) return res.status(404).json({ message: 'User not found.' });
    return res.status(200).json({
      id: user.id, mustId: user.must_id, fullName: user.full_name,
      email: user.email, role: user.role, department: user.department, yearOfStudy: user.year_of_study,
    });
  } catch (err) {
    console.error('[me]', err);
    return res.status(500).json({ message: 'Server error.' });
  }
};