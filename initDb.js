const db = require('./db');

let initialized = false;
let initPromise = null;

async function initDatabase() {
    if (initialized) return true;
    if (initPromise) return initPromise;

    initPromise = (async () => {
        try {
            console.log('⚡ Running automatic database initialization & verification...');

            if (db.isPostgres) {
                // PostgreSQL / Supabase auto-create tables if they do not exist
                await db.query(`
                    CREATE TABLE IF NOT EXISTS Restaurant (
                        restaurant_id SERIAL PRIMARY KEY,
                        name VARCHAR(150) NOT NULL,
                        location VARCHAR(300) NOT NULL,
                        contact VARCHAR(15) NOT NULL,
                        email VARCHAR(100) NOT NULL UNIQUE,
                        password VARCHAR(255) NOT NULL,
                        latitude DECIMAL(10, 8) DEFAULT NULL,
                        longitude DECIMAL(11, 8) DEFAULT NULL,
                        address_geocoded VARCHAR(255) DEFAULT NULL,
                        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
                    );
                `);

                await db.query(`
                    CREATE TABLE IF NOT EXISTS NGO (
                        ngo_id SERIAL PRIMARY KEY,
                        name VARCHAR(150) NOT NULL,
                        location VARCHAR(300) NOT NULL,
                        contact VARCHAR(15) NOT NULL,
                        email VARCHAR(100) NOT NULL UNIQUE,
                        password VARCHAR(255) NOT NULL,
                        latitude DECIMAL(10, 8) DEFAULT NULL,
                        longitude DECIMAL(11, 8) DEFAULT NULL,
                        address_geocoded VARCHAR(255) DEFAULT NULL,
                        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
                    );
                `);

                await db.query(`
                    CREATE TABLE IF NOT EXISTS Food_Listing (
                        listing_id SERIAL PRIMARY KEY,
                        restaurant_id INT NOT NULL REFERENCES Restaurant(restaurant_id) ON DELETE CASCADE,
                        food_type VARCHAR(200) NOT NULL,
                        quantity INT NOT NULL DEFAULT 1,
                        pickup_by TIMESTAMP WITH TIME ZONE DEFAULT NULL,
                        status VARCHAR(20) DEFAULT 'available',
                        category VARCHAR(50) DEFAULT NULL,
                        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
                    );
                `);

                await db.query(`
                    CREATE TABLE IF NOT EXISTS Request (
                        request_id SERIAL PRIMARY KEY,
                        ngo_id INT NOT NULL REFERENCES NGO(ngo_id) ON DELETE CASCADE,
                        listing_id INT NOT NULL REFERENCES Food_Listing(listing_id) ON DELETE CASCADE,
                        request_time TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                        status VARCHAR(20) DEFAULT 'pending',
                        remarks TEXT DEFAULT NULL,
                        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
                    );
                `);

                await db.query(`
                    CREATE TABLE IF NOT EXISTS Delivery (
                        delivery_id SERIAL PRIMARY KEY,
                        request_id INT NOT NULL UNIQUE REFERENCES Request(request_id) ON DELETE CASCADE,
                        status VARCHAR(20) DEFAULT 'pending',
                        delivery_time TIMESTAMP WITH TIME ZONE DEFAULT NULL,
                        delivery_agent VARCHAR(100) DEFAULT NULL,
                        agent_phone VARCHAR(15) DEFAULT NULL,
                        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
                    );
                `);

                await db.query(`
                    CREATE TABLE IF NOT EXISTS Review (
                        review_id SERIAL PRIMARY KEY,
                        ngo_id INT NOT NULL REFERENCES NGO(ngo_id) ON DELETE CASCADE,
                        restaurant_id INT NOT NULL REFERENCES Restaurant(restaurant_id) ON DELETE CASCADE,
                        rating INT NOT NULL CHECK (rating >= 1 AND rating <= 5),
                        comment TEXT DEFAULT NULL,
                        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                        CONSTRAINT unique_ngo_restaurant_review UNIQUE (ngo_id, restaurant_id)
                    );
                `);

                await db.query(`
                    CREATE TABLE IF NOT EXISTS Location_History (
                        location_id SERIAL PRIMARY KEY,
                        delivery_id INT NOT NULL REFERENCES Delivery(delivery_id) ON DELETE CASCADE,
                        latitude DECIMAL(10, 8) NOT NULL,
                        longitude DECIMAL(11, 8) NOT NULL,
                        timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
                    );
                `);

                await db.query(`
                    CREATE TABLE IF NOT EXISTS Geolocation_Cache (
                        cache_id SERIAL PRIMARY KEY,
                        address VARCHAR(500) UNIQUE NOT NULL,
                        latitude DECIMAL(10, 8) NOT NULL,
                        longitude DECIMAL(11, 8) NOT NULL,
                        cached_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
                    );
                `);

                await db.query(`
                    CREATE TABLE IF NOT EXISTS Audit_Log (
                        id SERIAL PRIMARY KEY,
                        table_name VARCHAR(64) NOT NULL,
                        row_id INT,
                        action VARCHAR(16) NOT NULL,
                        changed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                        who VARCHAR(100) DEFAULT 'SYSTEM',
                        payload JSONB DEFAULT NULL,
                        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
                    );
                `);

                console.log('✓ All Supabase PostgreSQL tables verified/created successfully.');
            }

            initialized = true;
            return true;
        } catch (err) {
            console.error('⚠ Database auto-initialization error:', err.message);
            // Non-blocking so server can still serve static requests
            return false;
        }
    })();

    return initPromise;
}

module.exports = { initDatabase };
