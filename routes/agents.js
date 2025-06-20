const express = require('express');
const router = express.Router();
const { Agent } = require('../models');
const { authenticateToken } = require('./auth');

/**
 * @route GET /api/agents
 * @desc Get all agents
 * @access Private
 */
router.get('/', authenticateToken, async (req, res) => {
  try {
    const agents = await Agent.findAll({
      attributes: { exclude: ['created_at', 'updated_at'] }
    });
    
    res.json({
      success: true,
      data: { agents }
    });
  } catch (error) {
    console.error('Error fetching agents:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

module.exports = router; 