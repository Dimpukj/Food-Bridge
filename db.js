const mysql = require('mysql2/promise');
const { Pool } = require('pg');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

// Determine database mode
const postgresUrl = process.env.DATABASE_URL || process.env.SUPABASE_DB_URL;
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || 'https://dbogtgvhoonqeuzdpqjw.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_ANON_KEY || 'sb_publishable_b4fugmtnUk9-O5ZdT0S07g_JedRJt96';

const isPostgres = Boolean(postgresUrl || process.env.DB_TYPE === 'supabase' || process.env.DB_TYPE === 'postgres' || supabaseUrl);

console.log('Database Mode:', isPostgres ? 'Supabase PostgreSQL' : 'MySQL');

let pgPool = null;
let mysqlPool = null;
let supabaseClient = null;

// Initialize Supabase Client
if (supabaseUrl && supabaseKey) {
    supabaseClient = createClient(supabaseUrl, supabaseKey);
    console.log('✓ Supabase Client initialized successfully with project:', supabaseUrl);
}

if (isPostgres) {
    const isPlaceholderUrl = postgresUrl && (postgresUrl.includes('[YOUR-') || postgresUrl.includes('YOUR_PASSWORD') || postgresUrl.includes('[YOUR_'));
    if (postgresUrl && !isPlaceholderUrl) {
        pgPool = new Pool({
            connectionString: postgresUrl,
            ssl: process.env.DB_SSL === 'false' ? false : { rejectUnauthorized: false },
            max: 10,
            idleTimeoutMillis: 10000,
            connectionTimeoutMillis: 3000,
        });
        console.log('✓ PostgreSQL Pool initialized for Supabase');
    } else if (isPlaceholderUrl) {
        console.warn('⚠ DATABASE_URL contains placeholder credentials. Direct PostgreSQL connection skipped until credentials are added.');
    }
} else {
    mysqlPool = mysql.createPool({
        host: process.env.DB_HOST || 'localhost',
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '',
        database: process.env.DB_NAME || 'foodbridge',
        port: process.env.DB_PORT || 3306,
        ssl: process.env.DB_HOST && process.env.DB_HOST !== 'localhost' ? { rejectUnauthorized: false } : false,
        waitForConnections: true,
        connectionLimit: 10,
        queueLimit: 0
    });
    console.log('✓ MySQL Pool initialized');
}

/**
 * Convert MySQL style parameter placeholders (?) to PostgreSQL style ($1, $2, ...)
 */
function convertPlaceholders(sql) {
    let paramIndex = 1;
    let inString = false;
    let stringChar = '';
    let result = '';

    for (let i = 0; i < sql.length; i++) {
        const char = sql[i];
        if ((char === "'" || char === '"') && (i === 0 || sql[i - 1] !== '\\')) {
            if (!inString) {
                inString = true;
                stringChar = char;
            } else if (char === stringChar) {
                inString = false;
            }
        }

        if (char === '?' && !inString) {
            result += `$${paramIndex++}`;
        } else {
            result += char;
        }
    }
    return result;
}

/**
 * Transform SQL query syntax from MySQL dialect to PostgreSQL/Supabase if needed
 */
function adaptSqlForPostgres(sql) {
    let adapted = sql;

    // Convert CURDATE() to CURRENT_DATE
    adapted = adapted.replace(/CURDATE\(\)/gi, 'CURRENT_DATE');

    // Convert NOW() to CURRENT_TIMESTAMP
    adapted = adapted.replace(/NOW\(\)/gi, 'CURRENT_TIMESTAMP');

    // Convert DATE_ADD(NOW(), INTERVAL 2 HOUR) to (CURRENT_TIMESTAMP + INTERVAL '2 HOUR')
    adapted = adapted.replace(/DATE_ADD\s*\(\s*NOW\(\s*\)\s*,\s*INTERVAL\s+([0-9]+)\s+([A-Z]+)\s*\)/gi, "(CURRENT_TIMESTAMP + INTERVAL '$1 $2')");

    // Convert ON DUPLICATE KEY UPDATE for known tables
    if (/ON\s+DUPLICATE\s+KEY\s+UPDATE/i.test(adapted)) {
        if (/INSERT\s+INTO\s+Geolocation_Cache/i.test(adapted)) {
            adapted = adapted.replace(/ON\s+DUPLICATE\s+KEY\s+UPDATE\s+cached_at\s*=\s*NOW\(\)/gi, 'ON CONFLICT (address) DO UPDATE SET cached_at = CURRENT_TIMESTAMP');
        } else if (/INSERT\s+INTO\s+Delivery/i.test(adapted)) {
            adapted = adapted.replace(/ON\s+DUPLICATE\s+KEY\s+UPDATE\s+status\s*=\s*VALUES\(status\)/gi, 'ON CONFLICT (request_id) DO UPDATE SET status = EXCLUDED.status');
        } else if (/INSERT\s+INTO\s+Review/i.test(adapted)) {
            adapted = adapted.replace(/ON\s+DUPLICATE\s+KEY\s+UPDATE\s+rating\s*=\s*\?,\s*comment\s*=\s*\?/gi, 'ON CONFLICT (ngo_id, restaurant_id) DO UPDATE SET rating = EXCLUDED.rating, comment = EXCLUDED.comment');
        }
    }

    // Append RETURNING for INSERT statements if not present
    if (/^\s*INSERT\s+INTO/i.test(adapted) && !/RETURNING/i.test(adapted)) {
        adapted += ' RETURNING *';
    }

    return convertPlaceholders(adapted);
}

/**
 * Execute SQL Query across active DB engine
 */
async function query(sql, params = []) {
    if (isPostgres && pgPool) {
        try {
            const pgSql = adaptSqlForPostgres(sql);
            const res = await pgPool.query(pgSql, params);
            const rows = res.rows || [];

            // Attach MySQL compatible helper properties
            rows.affectedRows = res.rowCount || 0;
            if (rows.length > 0) {
                const first = rows[0];
                rows.insertId = first.id || first.listing_id || first.request_id || first.delivery_id || first.restaurant_id || first.ngo_id || first.review_id || first.location_id || first.cache_id || 0;
            } else {
                rows.insertId = 0;
            }

            // Return in [rows, fields] tuple format for mysql2 compatibility
            return [rows, res.fields || []];
        } catch (err) {
            console.warn('⚠ PostgreSQL query warning:', err.message);
            const emptyRows = [];
            emptyRows.affectedRows = 0;
            emptyRows.insertId = 0;
            return [emptyRows, []];
        }
    } else if (mysqlPool) {
        try {
            return await mysqlPool.query(sql, params);
        } catch (err) {
            console.warn('⚠ MySQL query warning:', err.message);
            const emptyRows = [];
            emptyRows.affectedRows = 0;
            emptyRows.insertId = 0;
            return [emptyRows, []];
        }
    } else {
        const emptyRows = [];
        emptyRows.affectedRows = 0;
        emptyRows.insertId = 0;
        return [emptyRows, []];
    }
}

/**
 * Get single connection from connection pool
 */
async function getConnection() {
    if (isPostgres && pgPool) {
        const client = await pgPool.connect();
        return {
            query: async (sql, params = []) => {
                const pgSql = adaptSqlForPostgres(sql);
                const res = await client.query(pgSql, params);
                const rows = res.rows || [];
                rows.affectedRows = res.rowCount || 0;
                if (rows.length > 0) {
                    const first = rows[0];
                    rows.insertId = first.id || first.listing_id || first.request_id || first.delivery_id || first.restaurant_id || first.ngo_id || first.review_id || first.location_id || first.cache_id || 0;
                } else {
                    rows.insertId = 0;
                }
                return [rows, res.fields || []];
            },
            beginTransaction: async () => {
                await client.query('BEGIN');
            },
            commit: async () => {
                await client.query('COMMIT');
            },
            rollback: async () => {
                await client.query('ROLLBACK');
            },
            release: () => {
                client.release();
            }
        };
    } else if (mysqlPool) {
        return await mysqlPool.getConnection();
    } else {
        throw new Error('No active database connection configured.');
    }
}

module.exports = {
    query,
    getConnection,
    isPostgres,
    supabaseClient,
    pgPool,
    mysqlPool
};
