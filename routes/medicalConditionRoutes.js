import express from 'express';
import * as MedicalCondition from '../models/MedicalCondition.js';

const router = express.Router();

// Get all medical conditions
router.get('/', async (req, res) => {
  try {
    const conditions = await MedicalCondition.getAllMedicalConditions();
    
    res.json({
      success: true,
      conditions,
      count: conditions.length
    });
  } catch (error) {
    console.error('Error fetching medical conditions:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch medical conditions'
    });
  }
});

// Search medical conditions
router.get('/search', async (req, res) => {
  try {
    const { q } = req.query;
    
    if (!q) {
      return res.status(400).json({
        success: false,
        error: 'Search query is required'
      });
    }

    const conditions = await MedicalCondition.searchMedicalConditions(q);
    
    res.json({
      success: true,
      conditions,
      count: conditions.length
    });
  } catch (error) {
    console.error('Error searching medical conditions:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to search medical conditions'
    });
  }
});

// Get single medical condition
router.get('/:conditionId', async (req, res) => {
  try {
    const { conditionId } = req.params;
    const condition = await MedicalCondition.getMedicalConditionById(conditionId);
    
    if (!condition) {
      return res.status(404).json({
        success: false,
        error: 'Medical condition not found'
      });
    }

    res.json({
      success: true,
      condition
    });
  } catch (error) {
    console.error('Error fetching medical condition:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch medical condition'
    });
  }
});

export default router;