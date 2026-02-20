// server/controllers/studentController.js
const UserModel = require('../models/usermodel');

exports.getDashboard = async (req, res) => {
  try {
    const [user, materials, recentQueries] = await Promise.all([
      UserModel.findById(req.user.id),
      UserModel.getStudentMaterials(req.user.id),
      UserModel.getRecentQueries(req.user.id, 5),
    ]);
    if (!user) return res.status(404).json({ message: 'User not found.' });

    return res.status(200).json({
      student: {
        id: user.id, mustId: user.must_id, fullName: user.full_name,
        email: user.email, department: user.department, yearOfStudy: user.year_of_study,
      },
      materials,
      recentQueries,
      stats: {
        totalMaterials: materials.length,
        syncedMaterials: materials.filter(m => m.synced).length,
        totalQueries: recentQueries.length,
      },
    });
  } catch (err) {
    console.error('[getDashboard]', err);
    return res.status(500).json({ message: 'Server error.' });
  }
};

exports.saveQuery = async (req, res) => {
  try {
    const { question, answer } = req.body;
    if (!question) return res.status(400).json({ message: 'Question is required.' });
    const saved = await UserModel.saveAiQuery(req.user.id, question, answer || null);
    return res.status(201).json(saved);
  } catch (err) {
    console.error('[saveQuery]', err);
    return res.status(500).json({ message: 'Server error.' });
  }
};