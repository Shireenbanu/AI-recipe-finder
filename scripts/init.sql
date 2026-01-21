-- Create extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users table
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Medical conditions table
CREATE TABLE IF NOT EXISTS medical_conditions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) UNIQUE NOT NULL,
    description TEXT,
    recommended_nutrients JSONB, -- e.g., {"vitamin_d": "high", "protein": "medium"}
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- User medical conditions (many-to-many relationship)
CREATE TABLE IF NOT EXISTS user_medical_conditions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    medical_condition_id UUID REFERENCES medical_conditions(id) ON DELETE CASCADE,
    severity VARCHAR(50), -- e.g., "mild", "moderate", "severe"
    diagnosed_at DATE,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, medical_condition_id)
);

-- Recipes table (stores LLM-generated recipes)
CREATE TABLE IF NOT EXISTS recipes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title VARCHAR(255) NOT NULL,
    description TEXT,
    ingredients JSONB NOT NULL, -- Array of ingredients with quantities
    instructions JSONB NOT NULL, -- Array of step-by-step instructions
    nutritional_info JSONB, -- Nutrients, calories, etc.
    prep_time INTEGER, -- in minutes
    cook_time INTEGER, -- in minutes
    servings INTEGER,
    difficulty VARCHAR(50), -- "easy", "medium", "hard"
    tags JSONB, -- ["high-protein", "vitamin-d-rich", etc.]
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- User favorites (saved recipes)
CREATE TABLE IF NOT EXISTS user_favorites (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    recipe_id UUID REFERENCES recipes(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, recipe_id)
);

-- Note: Chat sessions are handled in-memory, not stored in database
-- Users can chat with LLM in real-time without persistence

-- Recipe recommendations log (track what was recommended and why)
CREATE TABLE IF NOT EXISTS recipe_recommendations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    recipe_id UUID REFERENCES recipes(id) ON DELETE CASCADE,
    matched_conditions JSONB, -- Which medical conditions this recipe addresses
    llm_reasoning TEXT, -- Why the LLM recommended this recipe
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for better query performance
CREATE INDEX idx_user_medical_conditions_user ON user_medical_conditions(user_id);
CREATE INDEX idx_user_medical_conditions_condition ON user_medical_conditions(medical_condition_id);
CREATE INDEX idx_user_favorites_user ON user_favorites(user_id);
CREATE INDEX idx_user_favorites_recipe ON user_favorites(recipe_id);
CREATE INDEX idx_recipe_recommendations_user ON recipe_recommendations(user_id);
CREATE INDEX idx_recipes_tags ON recipes USING GIN(tags);
CREATE INDEX idx_recipes_nutritional_info ON recipes USING GIN(nutritional_info);

-- Insert some sample medical conditions
INSERT INTO medical_conditions (name, description, recommended_nutrients) VALUES
    ('Vitamin D Deficiency', 'Low levels of vitamin D in the blood', '{"vitamin_d": "high", "calcium": "medium"}'),
    ('Protein Deficiency', 'Insufficient protein intake', '{"protein": "high", "amino_acids": "high"}'),
    ('Iron Deficiency Anemia', 'Low iron levels causing anemia', '{"iron": "high", "vitamin_c": "medium"}'),
    ('Diabetes Type 2', 'Metabolic disorder affecting blood sugar', '{"fiber": "high", "complex_carbs": "medium", "simple_sugars": "low"}'),
    ('Hypertension', 'High blood pressure', '{"potassium": "high", "sodium": "low", "fiber": "medium"}')
ON CONFLICT (name) DO NOTHING;