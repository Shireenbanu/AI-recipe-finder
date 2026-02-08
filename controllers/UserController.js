import * as User from '../models/User.js';
import * as MedicalCondition from '../models/MedicalCondition.js';
import { trackRDS, logPerformance } from '../services/splunkLogger.js';
  const startTime = Date.now();

export async function createUser(req, res) {
  try {
    const { email, name } = req.body;
    if (!email || !name) return res.status(400).json({ success: false, error: 'Email and name required' });

    const existingUser = await trackRDS(req, 'READ_USER_EXISTENCE', () => User.getUserByEmail(email));
    if (existingUser) return res.status(409).json({ success: false, error: 'User already exists' });

    const user = await trackRDS(req, 'WRITE_CREATE_USER', () => User.createUser(email, name));
    res.status(201).json({ success: true, user });
  } catch (error) {
    logPerformance(req, 'READ_USER_EXISTENCE_ERROR', Date.now() - startTime, 'FAILURE', { failure_remark: error.message });
    res.status(500).json({ success: false, error: 'Failed to create user' });
  }
}

// Get user's medical conditions
export async function getUserConditions(req, res) {
  try {
    const { userId } = req.params;

    // We categorize this as a READ action
    const conditions = await trackRDS(req, 'READ_USER_CONDITIONS', () => 
      User.getUserMedicalConditions(userId)
    );

    res.json({
      success: true,
      conditions
    });
  } catch (error) {
    console.error('Error fetching user conditions:', error);
    logPerformance(req, 'READ_USER_CONDITIONS_ERROR', Date.now() - startTime, 'FAILURE', { userId });
    res.status(500).json({
      success: false,
      error: 'Failed to fetch medical conditions'
    });
  }
}

// Get user's nutritional needs
export async function getNutritionalNeeds(req, res) {
  try {
    const { userId } = req.params;

    // We categorize this as a READ action
    const needs = await trackRDS(req, 'READ_USER_NUTRITIONAL_NEEDS', () => 
      User.getUserNutritionalNeeds(userId)
    );

    res.json({
      success: true,
      ...needs
    });
  } catch (error) {
    console.error('Error fetching nutritional needs:', error);
    logPerformance(req, 'READ_USER_NUTRITIONAL_NEEDS_ERROR', Date.now() - startTime, 'FAILURE', { userId });
    res.status(500).json({
      success: false,
      error: 'Failed to fetch nutritional needs'
    });
  }
}

export async function getUserByEmail(req, res) {
  try {
    const { email } = req.params;
    const user = await trackRDS(req, 'READ_USER_BY_EMAIL', () => User.getUserByEmail(email));
    if (!user) return res.status(404).json({ success: false, error: 'User not found' });
    res.json({ success: true, user });
  } catch (error) {
        logPerformance(req, 'READ_USER_BY_EMAIL_ERROR', Date.now() - startTime, 'FAILURE', { userId });

    res.status(500).json({ success: false, error: 'Failed to find user' });
  }
}

export async function listUserReports(req, res) {
  try {
    const { userId } = req.params;
    const result = await trackRDS(req, 'READ_USER_REPORTS_LIST', () => User.getUserLabReports(userId));

    if (!result) return res.status(404).json({ success: false, error: 'User not found' });
    res.json({ success: true, files: result });
  } catch (error) {
    logPerformance(req, 'READ_USER_REPORTS_LIST_ERROR', Date.now() - startTime, 'FAILURE', { userId });
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
}

export async function getUserProfile(req, res) {
  try {
    const { userId } = req.params;
    const user = await trackRDS(req, 'READ_USER_PROFILE', () => User.getUserById(userId));
    if (!user) return res.status(404).json({ success: false, error: 'User not found' });

    const conditions = await trackRDS(req, 'READ_USER_CONDITIONS_PROFILE', () => User.getUserMedicalConditions(userId));
    res.json({ success: true, user: { ...user, medicalConditions: conditions } });
  } catch (error) {
    logPerformance(req, 'READ_USER_PROFILE_ERROR', Date.now() - startTime, 'FAILURE', { userId });
    res.status(500).json({ success: false, error: 'Failed to fetch user profile' });
  }
}

export async function addMedicalCondition(req, res) {
  try {
    const { userId } = req.params;
    const { conditionId, severity, notes } = req.body;

    const condition = await trackRDS(req, 'READ_VERIFY_CONDITION', () => MedicalCondition.getMedicalConditionById(conditionId));
    if (!condition) return res.status(404).json({ success: false, error: 'Medical condition not found' });

    const userCondition = await trackRDS(req, 'WRITE_ADD_USER_CONDITION', () => 
      User.addUserMedicalCondition(userId, conditionId, severity || 'moderate', notes)
    );
    
    await User.removeUserMedicalCondition(userId, conditionId)

    res.status(201).json({ success: true, userCondition });
  } catch (error) {
    if (error.code === '23505') return res.status(409).json({ success: false, error: 'User already has this condition' });
    logPerformance(req, 'ADD_MEDICAL_CONDITION_ERROR', Date.now() - startTime, status, { failure_remark: error.message });
    res.status(500).json({ success: false, error: 'Failed to add medical condition' });
  }
}

// Update user profile
export async function updateUserProfile(req, res) {
  try {
    const { userId } = req.params;
    const updates = req.body;

    // We categorize this as a WRITE action for Splunk tracking
    const updatedUser = await trackRDS(req, 'WRITE_UPDATE_USER_PROFILE', () => 
      User.updateUser(userId, updates)
    );

    if (!updatedUser) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    res.json({
      success: true,
      user: updatedUser
    });
  } catch (error) {
    console.error('Error updating user:', error);
    logPerformance(req, 'WRITE_UPDATE_USER_PROFILE_ERROR', Date.now() - startTime, 'FAILURE', { userId });
    res.status(500).json({
      success: false,
      error: 'Failed to update user'
    });
  }
}

export async function removeMedicalCondition(req, res) {
  try {
    const { userId, conditionId } = req.params;
    const removed = await trackRDS(req, 'WRITE_REMOVE_USER_CONDITION', () => User.removeUserMedicalCondition(userId, conditionId));
    
    if (!removed) return res.status(404).json({ success: false, error: 'Condition not found for this user' });
    res.json({ success: true, message: 'Removed successfully' });
  } catch (error) {
        logPerformance(req, 'WRITE_REMOVE_USER_CONDITION_ERROR', Date.now() - startTime, 'FAILURE', { userId });

    res.status(500).json({ success: false, error: 'Failed to remove condition' });
  }
}