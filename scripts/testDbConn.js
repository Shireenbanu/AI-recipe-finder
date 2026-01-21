import pool from '../config/database.js';

async function testConnection() {
  try {
    console.log('🔍 Testing database connection...');
    
    const result = await pool.query('SELECT NOW() AS CURRENT_TIME, VERSION() AS VERSION;');
    console.log(result)
    console.log('✅ Database connection successful!');
    console.log(`⏰ Current time: ${result.rows[0].current_time}`);
    console.log(`📦 PostgreSQL version: ${result.rows[0].version.split(' ')[0]} ${result.rows[0].version.split(' ')[1]}`);
    
    // Test if tables exist
    const tables = await pool.query(`
      SELECT COUNT(*) as table_count 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
    `);
    
    console.log(`📊 Number of tables: ${tables.rows[0].table_count}`);
    
  } catch (error) {
    console.error('❌ Database connection failed:', error.message);
    console.error('\n💡 Make sure:');
    console.error('  1. Docker PostgreSQL is running: docker-compose up -d');
    console.error('  2. .env file has correct credentials');
    console.error('  3. Port 5432 is not blocked');
  } finally {
    await pool.end();
  }
}

testConnection();