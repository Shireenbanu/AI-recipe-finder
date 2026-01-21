import pool from '../config/database.js';

// Create a new user
export async function createUser(email, name) {
  const query = `
    INSERT INTO users (email, name)
    VALUES ($1, $2)
    RETURNING *
  `;
  
  const result = await pool.query(query, [email, name]);
  return result.rows[0];
}

// Get user by ID
export async function getUserById(userId) {
  const query = `
    SELECT * FROM users
    WHERE id = $1
  `;
  
  const result = await pool.query(query, [userId]);
  return result.rows[0];
}

// Get user by email
export async function getUserByEmail(email) {
  const query = `
    SELECT * FROM users
    WHERE email = $1
  `;
  
  const result = await pool.query(query, [email]);
  return result.rows[0];
}

// Update user profile
export async function updateUser(userId, updates) {
  const { name, email } = updates;
  const query = `
    UPDATE users
    SET name = COALESCE($1, name),
        email = COALESCE($2, email),
        updated_at = CURRENT_TIMESTAMP
    WHERE id = $3
    RETURNING *
  `;
  
  const result = await pool.query(query, [name, email, userId]);
  return result.rows[0];
}

// Delete user
export async function deleteUser(userId) {
  const query = `
    DELETE FROM users
    WHERE id = $1
    RETURNING *
  `;
  
  const result = await pool.query(query, [userId]);
  return result.rows[0];
}

// Add medical condition to user
export async function addUserMedicalCondition(userId, conditionId, severity, notes) {
  const query = `
    INSERT INTO user_medical_conditions (user_id, medical_condition_id, severity, notes, diagnosed_at)
    VALUES ($1, $2, $3, $4, CURRENT_DATE)
    RETURNING *
  `;
  
  const result = await pool.query(query, [userId, conditionId, severity, notes]);
  return result.rows[0];
}

// Get user's medical conditions with details
export async function getUserMedicalConditions(userId) {
  const query = `
    SELECT 
      umc.id,
      umc.severity,
      umc.diagnosed_at,
      umc.notes,
      mc.id as condition_id,
      mc.name as condition_name,
      mc.description,
      mc.recommended_nutrients
    FROM user_medical_conditions umc
    JOIN medical_conditions mc ON umc.medical_condition_id = mc.id
    WHERE umc.user_id = $1
    ORDER BY umc.created_at DESC
  `;
  
  const result = await pool.query(query, [userId]);
  return result.rows;
}

// Remove medical condition from user
export async function removeUserMedicalCondition(userId, conditionId) {
  const query = `
    DELETE FROM user_medical_conditions
    WHERE user_id = $1 AND medical_condition_id = $2
    RETURNING *
  `;
  
  const result = await pool.query(query, [userId, conditionId]);
  return result.rows[0];
}

// Get aggregated nutritional requirements for a user
export async function getUserNutritionalNeeds(userId) {
  const conditions = await getUserMedicalConditions(userId);
  
  // Merge all recommended nutrients from user's conditions
  const aggregatedNeeds = {};
  
  conditions.forEach(condition => {
    const nutrients = condition.recommended_nutrients || {};
    Object.entries(nutrients).forEach(([nutrient, level]) => {
      // Priority: high > medium > low
      const priorities = { high: 3, medium: 2, low: 1 };
      const currentPriority = priorities[aggregatedNeeds[nutrient]] || 0;
      const newPriority = priorities[level] || 0;
      
      if (newPriority > currentPriority) {
        aggregatedNeeds[nutrient] = level;
      }
    });
  });
  
  return {
    conditions: conditions.map(c => ({
      name: c.condition_name,
      severity: c.severity
    })),
    nutritionalNeeds: aggregatedNeeds
  };
}