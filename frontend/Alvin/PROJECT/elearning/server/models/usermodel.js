// server/models/userModel.js
const { query } = require('../config/db');

const UserModel = {

  async findByMustIdAndRole(mustId, role) {
    const { rows } = await query(
      `SELECT id, must_id, full_name, email, password, role, department, year_of_study, is_active
       FROM users WHERE must_id = $1 AND role = $2 LIMIT 1`,
      [mustId, role]
    );
    return rows[0] || null;
  },

  async findById(id) {
    const { rows } = await query(
      `SELECT id, must_id, full_name, email, role, department, year_of_study, is_active, created_at
       FROM users WHERE id = $1 LIMIT 1`,
      [id]
    );
    return rows[0] || null;
  },

  async create({ mustId, fullName, email, hashedPassword, role, department, yearOfStudy }) {
    const { rows } = await query(
      `INSERT INTO users (must_id, full_name, email, password, role, department, year_of_study)
       VALUES ($1,$2,$3,$4,$5,$6,$7)
       RETURNING id, must_id, full_name, email, role, department, year_of_study`,
      [mustId, fullName, email, hashedPassword, role, department || null, yearOfStudy || null]
    );
    return rows[0];
  },

  async exists({ mustId, email }) {
    const { rows } = await query(
      `SELECT
         (SELECT COUNT(*) FROM users WHERE must_id = $1)::int AS must_id_count,
         (SELECT COUNT(*) FROM users WHERE email   = $2)::int AS email_count`,
      [mustId, email]
    );
    return { mustIdExists: rows[0].must_id_count > 0, emailExists: rows[0].email_count > 0 };
  },

  async saveRefreshToken(userId, token, expiresAt) {
    await query(
      `INSERT INTO refresh_tokens (user_id, token, expires_at) VALUES ($1,$2,$3)`,
      [userId, token, expiresAt]
    );
  },

  async findRefreshToken(token) {
    const { rows } = await query(
      `SELECT rt.*, u.role, u.is_active FROM refresh_tokens rt
       JOIN users u ON u.id = rt.user_id
       WHERE rt.token = $1 AND rt.expires_at > NOW() LIMIT 1`,
      [token]
    );
    return rows[0] || null;
  },

  async deleteRefreshToken(token) {
    await query(`DELETE FROM refresh_tokens WHERE token = $1`, [token]);
  },

  // Materials for student dashboard
  async getStudentMaterials(studentId) {
    const { rows } = await query(
      `SELECT m.id, m.title, m.description, m.file_url, m.file_type,
              m.course_code, u.full_name AS lecturer_name, m.created_at,
              COALESCE(sm.synced, false) AS synced
       FROM materials m
       JOIN users u ON u.id = m.uploaded_by
       LEFT JOIN student_materials sm ON sm.material_id = m.id AND sm.student_id = $1
       ORDER BY m.created_at DESC`,
      [studentId]
    );
    return rows;
  },

  // Recent AI queries for student
  async getRecentQueries(studentId, limit = 5) {
    const { rows } = await query(
      `SELECT id, question, answer, created_at FROM ai_queries
       WHERE student_id = $1 ORDER BY created_at DESC LIMIT $2`,
      [studentId, limit]
    );
    return rows;
  },

  async saveAiQuery(studentId, question, answer) {
    const { rows } = await query(
      `INSERT INTO ai_queries (student_id, question, answer) VALUES ($1,$2,$3) RETURNING *`,
      [studentId, question, answer]
    );
    return rows[0];
  },
};

module.exports = UserModel;