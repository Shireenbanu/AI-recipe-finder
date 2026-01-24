import * as User from '../models/User.js';
import * as MedicalCondition from '../models/MedicalCondition.js';

// Create new user
export async function createUser(req, res) {
  try {
    const { email, name } = req.body;

    // Validate input
    if (!email || !name) {
      return res.status(400).json({
        success: false,
        error: 'Email and name are required'
      });
    }

    // Check if user already exists
    const existingUser = await User.getUserByEmail(email);
    if (existingUser) {
      return res.status(409).json({
        success: false,
        error: 'User with this email already exists'
      });
    }

    // Create user
    const user = await User.createUser(email, name);

    res.status(201).json({
      success: true,
      user
    });
  } catch (error) {
    console.error('Error creating user:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create user'
    });
  }
}

export async function getUserByEmail(req, res){
  try {
    const { email } = req.params;
    const user = await User.getUserByEmail(email);

    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    res.json({
      success: true,
      user
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to find user'
    });
  }
};


// Get user profile
export async function getUserProfile(req, res) {
  try {
    const { userId } = req.params;

    const user = await User.getUserById(userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    // Get user's medical conditions
    const conditions = await User.getUserMedicalConditions(userId);

    res.json({
      success: true,
      user: {
        ...user,
        medicalConditions: conditions
      }
    });
  } catch (error) {
    console.error('Error fetching user profile:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch user profile'
    });
  }
}

// Update user profile
export async function updateUserProfile(req, res) {
  try {
    const { userId } = req.params;
    const updates = req.body;

    const updatedUser = await User.updateUser(userId, updates);

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
    res.status(500).json({
      success: false,
      error: 'Failed to update user'
    });
  }
}

// Add medical condition to user
export async function addMedicalCondition(req, res) {
  try {
    const { userId } = req.params;
    const { conditionId, severity, notes } = req.body;

    if (!conditionId) {
      return res.status(400).json({
        success: false,
        error: 'Condition ID is required'
      });
    }

    // Verify condition exists
    const condition = await MedicalCondition.getMedicalConditionById(conditionId);
    if (!condition) {
      return res.status(404).json({
        success: false,
        error: 'Medical condition not found'
      });
    }

    // Add condition to user
    const userCondition = await User.addUserMedicalCondition(
      userId,
      conditionId,
      severity || 'moderate',
      notes
    );

    res.status(201).json({
      success: true,
      userCondition
    });
  } catch (error) {
    console.error('Error adding medical condition:', error);
    
    // Handle duplicate condition
    if (error.code === '23505') {
      return res.status(409).json({
        success: false,
        error: 'User already has this medical condition'
      });
    }

    res.status(500).json({
      success: false,
      error: 'Failed to add medical condition'
    });
  }
}

// Get user's medical conditions
export async function getUserConditions(req, res) {
  try {
    const { userId } = req.params;

    const conditions = await User.getUserMedicalConditions(userId);

    res.json({
      success: true,
      conditions
    });
  } catch (error) {
    console.error('Error fetching user conditions:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch medical conditions'
    });
  }
}

// Remove medical condition from user
export async function removeMedicalCondition(req, res) {
  try {
    const { userId, conditionId } = req.params;

    const removed = await User.removeUserMedicalCondition(userId, conditionId);

    if (!removed) {
      return res.status(404).json({
        success: false,
        error: 'Medical condition not found for this user'
      });
    }

    res.json({
      success: true,
      message: 'Medical condition removed successfully'
    });
  } catch (error) {
    console.error('Error removing medical condition:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to remove medical condition'
    });
  }
}

// Get user's nutritional needs
export async function getNutritionalNeeds(req, res) {
  try {
    const { userId } = req.params;

    const needs = await User.getUserNutritionalNeeds(userId);

    res.json({
      success: true,
      ...needs
    });
  } catch (error) {
    console.error('Error fetching nutritional needs:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch nutritional needs'
    });
  }
}