const { Pool } = require('pg');

const pool = new Pool({
    user: 'postgres',
    host: 'localhost',
    database: 'online_teacher',
    password: '123123',
    port: 5432,
});

module.exports = pool;