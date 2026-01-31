import pool from '../config/database.js';

// Get all available medical conditions
export async function getAllMedicalConditions() {
  const query = `
    SELECT * FROM medical_conditions
    ORDER BY name ASC
  `;

  const result = await pool.query(query);
  return result.rows;
}

// export async function getUserMedicalConditions(userId) {
//   const query = `
//   select * from medical_conditions where medical_conditions in
//   (select medical_conditions from user_medical_conditions 
//   where user_id = $1); `
//   const result = await pool.query(query, [userId]);
//   return result.rows;
// }

// Get medical condition by ID
export async function getMedicalConditionById(conditionId) {
  const query = `
    SELECT * FROM medical_conditions
    WHERE id = $1
  `;

  const result = await pool.query(query, [conditionId]);
  return result.rows[0];
}

// Get medical condition by name
export async function getMedicalConditionByName(name) {
  const query = `
    SELECT * FROM medical_conditions
    WHERE name ILIKE $1
  `;
  
  const result = await pool.query(query, [name]);
  return result.rows[0];
}

// Search medical conditions
export async function searchMedicalConditions(searchTerm) {
  const query = `
    SELECT * FROM medical_conditions
    WHERE name ILIKE $1 OR description ILIKE $1
    ORDER BY name ASC
  `;
  
  const result = await pool.query(query, [`%${searchTerm}%`]);
  return result.rows;
}

// Create new medical condition (admin function)
export async function createMedicalCondition(name, description, recommendedNutrients) {
  const query = `
    INSERT INTO medical_conditions (name, description, recommended_nutrients)
    VALUES ($1, $2, $3)
    RETURNING *
  `;
  
  const result = await pool.query(query, [name, description, JSON.stringify(recommendedNutrients)]);
  return result.rows[0];
}