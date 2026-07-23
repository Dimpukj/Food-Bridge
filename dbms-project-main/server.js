const express = require('express');
const mysql = require('mysql2/promise');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const path = require('path');
require('dotenv').config();
const emailService = require('./emailService');
const geolocationService = require('./geolocationService');

const app = express();
app.use(express.json());
app.use(cors());
app.use(express.static(__dirname)); // Serve static files like index.html and images

const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'supersecret_foodbridge_key_2026';

// Keep database awake on free tier
setInterval(async () => {
    try {
        const conn = await pool.getConnection();
        await conn.query('SELECT 1');
        conn.release();
        console.log('✓ Keep-alive ping successful');
    } catch (err) {
        console.warn('⚠ Keep-alive ping failed:', err.message);
    }
}, 4 * 60 * 1000); // Every 4 minutes (before the 30-min timeout)

console.log('Environment variables loaded:');
console.log('DB_HOST:', process.env.DB_HOST);
console.log('DB_USER:', process.env.DB_USER);
console.log('DB_PASSWORD:', process.env.DB_PASSWORD ? '***' : 'NOT SET');
console.log('DB_NAME:', process.env.DB_NAME);
console.log('DB_PORT:', process.env.DB_PORT);

// Create MySQL connection pool
const pool = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'foodbridge',
    port: process.env.DB_PORT || 3306,
    ssl: process.env.DB_HOST && process.env.DB_HOST !== 'localhost'
        ? { rejectUnauthorized: false }
        : false,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

// Middleware to verify JWT token
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) return res.status(401).json({ error: 'Access Denied. Login required.' });

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) return res.status(403).json({ error: 'Invalid or expired token.' });
        req.user = user;
        next();
    });
};

/* ====================================
   AUTHENTICATION ROUTES
==================================== */

// REGISTRATION
app.post('/api/auth/register', async (req, res) => {
    const { role, name, location, contact, email, password, extraInfo } = req.body;

    try {
        if (!['restaurant', 'ngo'].includes(role)) {
            return res.status(400).json({ error: 'Invalid role selected.' });
        }

        if (!name || !location || !contact || !email || !password) {
            return res.status(400).json({ error: 'All registration fields are required.' });
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        const table = role === 'restaurant' ? 'Restaurant' : 'NGO';

        // Prevent same email from being registered in either role table.
        const [existingRestaurant] = await pool.query(`SELECT email FROM Restaurant WHERE email = ?`, [email]);
        const [existingNgo] = await pool.query(`SELECT email FROM NGO WHERE email = ?`, [email]);
        if (existingRestaurant.length > 0 || existingNgo.length > 0) {
            return res.status(400).json({ error: 'Email already registered.' });
        }

        const query = `INSERT INTO ${table} (name, location, contact, email, password) VALUES (?, ?, ?, ?, ?)`;
        const [result] = await pool.query(query, [name.trim(), location.trim(), contact.trim(), email.trim(), hashedPassword]);

        // Automatically geocode their location in the background
        const insertId = result.insertId;
        const idColumn = role === 'restaurant' ? 'restaurant_id' : 'ngo_id';
        geolocationService.geocodeAddress(location.trim())
            .then(async (coords) => {
                await pool.query(
                    `UPDATE ${table} SET latitude = ?, longitude = ? WHERE ${idColumn} = ?`,
                    [coords.latitude, coords.longitude, insertId]
                );
            })
            .catch(err => console.error(`Background geocoding failed for new ${role}:`, err.message));

        const token = jwt.sign(
            { id: result.insertId, role, name: name.trim() },
            JWT_SECRET,
            { expiresIn: '2h' }
        );

        res.status(201).json({
            message: 'Registration successful!',
            id: result.insertId,
            token,
            user: { name: name.trim(), role }
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Database error during registration.' });
    }
});

// LOGIN
app.post('/api/auth/login', async (req, res) => {
    const { role, email, password } = req.body;
    console.log('Login attempt:', { role, email, password: '***' });

    try {
        if (role && !['restaurant', 'ngo'].includes(role)) {
            return res.status(400).json({ error: 'Invalid role selected.' });
        }

        let restaurantRows, ngoRows;
        try {
            [restaurantRows] = await pool.query(`SELECT * FROM Restaurant WHERE email = ?`, [email]);
            [ngoRows] = await pool.query(`SELECT * FROM NGO WHERE email = ?`, [email]);
        } catch (dbErr) {
            console.error('Database query failed:', dbErr.message);
            return res.status(503).json({ error: 'Database connection failed. Please try again.' });
        }

        const candidates = [];
        if (restaurantRows.length > 0) candidates.push({ role: 'restaurant', user: restaurantRows[0] });
        if (ngoRows.length > 0) candidates.push({ role: 'ngo', user: ngoRows[0] });

        if (candidates.length === 0) {
            return res.status(400).json({ error: 'Invalid email or password.' });
        }

        let matched = null;
        for (const candidate of candidates) {
            const valid = await bcrypt.compare(password, candidate.user.password);
            if (valid) {
                matched = candidate;
                break;
            }
        }

        if (!matched) {
            return res.status(400).json({ error: 'Invalid email or password.' });
        }

        const resolvedRole = matched.role;
        const user = matched.user;

        const token = jwt.sign(
            { id: resolvedRole === 'restaurant' ? user.restaurant_id : user.ngo_id, role: resolvedRole, name: user.name },
            JWT_SECRET,
            { expiresIn: '2h' }
        );

        const roleSwitched = role && role !== resolvedRole;
        res.json({
            message: roleSwitched ? `Logged in as ${resolvedRole}.` : 'Login successful',
            token,
            user: { name: user.name, role: resolvedRole }
        });

    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: 'Database error during login.' });
    }
});

/* ====================================
   DASHBOARD ROUTES
==================================== */

// PROFILE & HISTORY ROUTE
app.get('/api/profile', authenticateToken, async (req, res) => {
    try {
        const { id, role } = req.user;
        let profileDetails, history;

        if (role === 'restaurant') {
            const [users] = await pool.query('SELECT name, email, location, contact FROM Restaurant WHERE restaurant_id = ?', [id]);
            profileDetails = users[0];

            // Get Listing History — uses real columns: listing_id, food_type, created_at
            const [listings] = await pool.query(
                'SELECT food_type, quantity, status, created_at FROM Food_Listing WHERE restaurant_id = ? ORDER BY created_at DESC LIMIT 10',
                [id]
            );
            history = listings.map(l => ({
                action: `Listed ${l.food_type} (${l.quantity} qty)`,
                status: l.status,
                time: l.created_at
            }));

        } else {
            const [users] = await pool.query('SELECT name, email, location, contact FROM NGO WHERE ngo_id = ?', [id]);
            profileDetails = users[0];

            // Get Request History — uses real columns: listing_id FK, food_type
            const [requests] = await pool.query(`
                SELECT r.status, r.created_at, f.food_type
                FROM Request r
                JOIN Food_Listing f ON r.listing_id = f.listing_id
                WHERE r.ngo_id = ? ORDER BY r.created_at DESC LIMIT 10
            `, [id]);
            history = requests.map(r => ({
                action: `Requested ${r.food_type}`,
                status: r.status,
                time: r.created_at
            }));
        }

        res.json({ profile: profileDetails, history: history });

    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Database error fetching profile.' });
    }
});

app.put('/api/profile', authenticateToken, async (req, res) => {
    try {
        const { id, role } = req.user;
        const { name, email, location, contact } = req.body;

        if (!name || !email || !location || !contact) {
            return res.status(400).json({ error: 'All profile fields are required.' });
        }

        const table = role === 'restaurant' ? 'Restaurant' : 'NGO';
        const idColumn = role === 'restaurant' ? 'restaurant_id' : 'ngo_id';

        const [existingRestaurant] = await pool.query(
            `SELECT ${idColumn} FROM ${table} WHERE email = ? AND ${idColumn} != ?`,
            [email.trim(), id]
        );
        const otherTable = role === 'restaurant' ? 'NGO' : 'Restaurant';
        const otherIdColumn = role === 'restaurant' ? 'ngo_id' : 'restaurant_id';
        const [existingOther] = await pool.query(
            `SELECT ${otherIdColumn} FROM ${otherTable} WHERE email = ?`,
            [email.trim()]
        );

        if (existingRestaurant.length > 0 || existingOther.length > 0) {
            return res.status(400).json({ error: 'Email already registered.' });
        }

        await pool.query(
            `UPDATE ${table} SET name = ?, email = ?, location = ?, contact = ? WHERE ${idColumn} = ?`,
            [name.trim(), email.trim(), location.trim(), contact.trim(), id]
        );

        // Automatically geocode the new location in the background
        geolocationService.geocodeAddress(location.trim())
            .then(async (coords) => {
                await pool.query(
                    `UPDATE ${table} SET latitude = ?, longitude = ? WHERE ${idColumn} = ?`,
                    [coords.latitude, coords.longitude, id]
                );
            })
            .catch(err => console.error('Background geocoding failed for profile update:', err.message));

        res.json({
            message: 'Profile updated successfully',
            profile: { name: name.trim(), email: email.trim(), location: location.trim(), contact: contact.trim(), role }
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Database error updating profile.' });
    }
});

// RESTAURANT STATS
app.get('/api/dashboard/stats/restaurant', authenticateToken, async (req, res) => {
    if (req.user.role !== 'restaurant') return res.status(403).json({ error: 'Unauthorized' });
    try {
        const restId = req.user.id;

        const [[{ active_count }]] = await pool.query(
            `SELECT COUNT(*) as active_count FROM Food_Listing WHERE restaurant_id = ? AND status = 'available'`,
            [restId]
        );
        const [[{ deliveries_today }]] = await pool.query(
            `SELECT COUNT(*) as deliveries_today FROM Delivery d JOIN Request r ON d.request_id = r.request_id JOIN Food_Listing f ON r.listing_id = f.listing_id WHERE f.restaurant_id = ? AND DATE(d.created_at) = CURDATE()`,
            [restId]
        );
        const [[{ meals_saved }]] = await pool.query(
            `SELECT COALESCE(SUM(f.quantity), 0) as meals_saved FROM Food_Listing f JOIN Request r ON f.listing_id = r.listing_id JOIN Delivery d ON d.request_id = r.request_id WHERE f.restaurant_id = ? AND d.status = 'delivered'`,
            [restId]
        );
        const [[{ expiring_soon }]] = await pool.query(
            `SELECT COUNT(*) as expiring_soon FROM Food_Listing WHERE restaurant_id = ? AND status = 'available' AND pickup_by <= DATE_ADD(NOW(), INTERVAL 2 HOUR)`,
            [restId]
        );

        res.json({
            active_listings: active_count,
            deliveries_today: deliveries_today,
            meals_saved: meals_saved,
            expiring_soon: expiring_soon
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Database error fetching stats.' });
    }
});

// NGO STATS
app.get('/api/dashboard/stats/ngo', authenticateToken, async (req, res) => {
    if (req.user.role !== 'ngo') return res.status(403).json({ error: 'Unauthorized' });
    try {
        const ngoId = req.user.id;

        const [[{ pending_count }]] = await pool.query(
            `SELECT COUNT(*) as pending_count FROM Request WHERE ngo_id = ? AND status = 'pending'`,
            [ngoId]
        );
        const [[{ in_transit }]] = await pool.query(
            `SELECT COUNT(*) as in_transit FROM Request r JOIN Delivery d ON r.request_id = d.request_id WHERE r.ngo_id = ? AND d.status = 'in transit'`,
            [ngoId]
        );
        const [[{ meals_received }]] = await pool.query(
            `SELECT COALESCE(SUM(f.quantity), 0) as meals_received FROM Request r JOIN Food_Listing f ON r.listing_id = f.listing_id JOIN Delivery d ON d.request_id = r.request_id WHERE r.ngo_id = ? AND d.status = 'delivered'`,
            [ngoId]
        );
        const [[{ partners }]] = await pool.query(
            `SELECT COUNT(DISTINCT f.restaurant_id) as partners FROM Request r JOIN Food_Listing f ON r.listing_id = f.listing_id WHERE r.ngo_id = ? AND r.status = 'approved'`,
            [ngoId]
        );

        res.json({
            pending_requests: pending_count,
            in_transit: in_transit,
            meals_received: meals_received,
            partner_restaurants: partners
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Database error fetching stats.' });
    }
});

/* ====================================
   FOOD & REQUEST ROUTES
==================================== */

// Create Food Listing (Restaurant)
// Real columns: listing_id (PK), restaurant_id, food_type, quantity (INT), status, pickup_by, created_at
app.post('/api/food-listings', authenticateToken, async (req, res) => {
    if (req.user.role !== 'restaurant') return res.status(403).json({ error: 'Unauthorized' });
    const { food_name, quantity, expiry_time } = req.body;

    if (!food_name || !String(food_name).trim()) return res.status(400).json({ error: 'Food name is required.' });
    if (!quantity) return res.status(400).json({ error: 'Quantity is required.' });
    if (!expiry_time) return res.status(400).json({ error: 'Pickup deadline is required.' });

    // quantity from frontend is like "10 kg" — extract numeric part for INT column
    const qtyNumeric = parseInt(String(quantity).trim(), 10) || 1;

    try {
        await pool.query(
            `INSERT INTO Food_Listing (restaurant_id, food_type, quantity, pickup_by, status) VALUES (?, ?, ?, ?, 'available')`,
            [req.user.id, String(food_name).trim(), qtyNumeric, expiry_time]
        );

        // Send confirmation email to restaurant
        const [restaurantData] = await pool.query(`SELECT email, name AS restaurant_name FROM Restaurant WHERE restaurant_id = ?`, [req.user.id]);
        if (restaurantData.length > 0) {
            const restaurant = restaurantData[0];
            emailService.sendFoodListingConfirmationEmail(
                restaurant.email,
                restaurant.restaurant_name,
                String(food_name).trim(),
                quantity,
                expiry_time
            );
        }

        res.json({ message: 'Listing created successfully!' });
    } catch (err) {
        console.error('Error creating listing:', err);
        res.status(500).json({ error: 'Database error: ' + err.message });
    }
});

// Get My Listings (Restaurant)
app.get('/api/food-listings/me', authenticateToken, async (req, res) => {
    if (req.user.role !== 'restaurant') return res.status(403).json({ error: 'Unauthorized' });
    try {
        const [rows] = await pool.query(
            `SELECT listing_id as food_id, food_type as food_name, quantity, pickup_by as expiry_time, status, created_at FROM Food_Listing WHERE restaurant_id = ? ORDER BY created_at DESC`,
            [req.user.id]
        );
        res.json({ listings: rows });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Database error: ' + err.message });
    }
});

// Browse Available Food (NGO)
app.get('/api/food/available', authenticateToken, async (req, res) => {
    if (req.user.role !== 'ngo') return res.status(403).json({ error: 'Unauthorized' });
    try {
        const [foods] = await pool.query(`
            SELECT f.listing_id as food_id, f.food_type as food_name, f.quantity, f.pickup_by as expiry_time, f.status, f.created_at,
                   r.name as restaurant_name, r.location
            FROM Food_Listing f
            JOIN Restaurant r ON f.restaurant_id = r.restaurant_id
            WHERE f.status = 'available' AND (f.pickup_by IS NULL OR f.pickup_by > NOW())
            ORDER BY f.created_at DESC
        `);
        res.json({ foods });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Database error: ' + err.message });
    }
});

// Request Food (NGO)
app.post('/api/requests', authenticateToken, async (req, res) => {
    if (req.user.role !== 'ngo') return res.status(403).json({ error: 'Unauthorized' });
    const { food_id } = req.body; // food_id is actually listing_id
    try {
        // Get food and restaurant details before updating
        const [foodData] = await pool.query(
            `SELECT restaurant_id, food_type, quantity FROM Food_Listing WHERE listing_id = ? AND status = 'available'`,
            [food_id]
        );

        if (foodData.length === 0) {
            return res.status(404).json({ error: 'Food listing not found or already requested.' });
        }

        await pool.query(
            `UPDATE Food_Listing SET status = 'requested' WHERE listing_id = ? AND status = 'available'`,
            [food_id]
        );
        await pool.query(
            `INSERT INTO Request (listing_id, ngo_id, status) VALUES (?, ?, 'pending')`,
            [food_id, req.user.id]
        );

        // Send notification email to restaurant
        const [restaurantData] = await pool.query(`SELECT email, name AS restaurant_name FROM Restaurant WHERE restaurant_id = ?`, [foodData[0].restaurant_id]);
        const [ngoData] = await pool.query(`SELECT name AS ngo_name FROM NGO WHERE ngo_id = ?`, [req.user.id]);
        
        if (restaurantData.length > 0 && ngoData.length > 0) {
            emailService.sendNewRequestNotificationEmail(
                restaurantData[0].email,
                restaurantData[0].restaurant_name,
                ngoData[0].ngo_name,
                foodData[0].food_type,
                foodData[0].quantity
            );
        }

        res.json({ message: 'Food requested successfully!' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Database error requesting food: ' + err.message });
    }
});

// Get requests for current user context
app.get('/api/requests/me', authenticateToken, async (req, res) => {
    try {
        if (req.user.role === 'restaurant') {
            const [rows] = await pool.query(`
                SELECT
                    r.request_id,
                    r.status,
                    r.created_at as request_time,
                    n.name AS ngo_name,
                    f.food_type as food_name,
                    f.quantity
                FROM Request r
                JOIN Food_Listing f ON r.listing_id = f.listing_id
                JOIN NGO n ON r.ngo_id = n.ngo_id
                WHERE f.restaurant_id = ?
                ORDER BY r.created_at DESC
            `, [req.user.id]);

            return res.json({ requests: rows });
        }

        if (req.user.role === 'ngo') {
            const [rows] = await pool.query(`
                SELECT
                    r.request_id,
                    r.status,
                    r.created_at as request_time,
                    f.food_type as food_name,
                    f.quantity,
                    rs.name AS restaurant_name
                FROM Request r
                JOIN Food_Listing f ON r.listing_id = f.listing_id
                JOIN Restaurant rs ON f.restaurant_id = rs.restaurant_id
                WHERE r.ngo_id = ?
                ORDER BY r.created_at DESC
            `, [req.user.id]);

            return res.json({ requests: rows });
        }

        return res.status(403).json({ error: 'Unauthorized' });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ error: 'Database error fetching requests: ' + err.message });
    }
});

// Approve or reject a request (Restaurant only)
app.patch('/api/requests/:requestId/decision', authenticateToken, async (req, res) => {
    if (req.user.role !== 'restaurant') return res.status(403).json({ error: 'Unauthorized' });

    const requestId = Number(req.params.requestId);
    const { action } = req.body;
    if (!['approve', 'reject'].includes(action)) {
        return res.status(400).json({ error: 'Action must be approve or reject.' });
    }

    const conn = await pool.getConnection();
    try {
        await conn.beginTransaction();

        const [rows] = await conn.query(`
            SELECT r.request_id, r.status, r.listing_id, r.ngo_id, f.restaurant_id, f.food_type
            FROM Request r
            JOIN Food_Listing f ON r.listing_id = f.listing_id
            WHERE r.request_id = ?
            LIMIT 1
        `, [requestId]);

        if (rows.length === 0) {
            await conn.rollback();
            return res.status(404).json({ error: 'Request not found.' });
        }

        const requestRow = rows[0];
        if (requestRow.restaurant_id !== req.user.id) {
            await conn.rollback();
            return res.status(403).json({ error: 'You can only manage your own listing requests.' });
        }

        if (requestRow.status !== 'pending') {
            await conn.rollback();
            return res.status(400).json({ error: 'Only pending requests can be updated.' });
        }

        // Get NGO and restaurant details for email
        const [ngoData] = await conn.query(`SELECT email, name AS ngo_name FROM NGO WHERE ngo_id = ?`, [requestRow.ngo_id]);
        const [restaurantData] = await conn.query(`SELECT name AS restaurant_name FROM Restaurant WHERE restaurant_id = ?`, [requestRow.restaurant_id]);

        if (action === 'approve') {
            await conn.query(`UPDATE Request SET status = 'approved' WHERE request_id = ?`, [requestId]);
            await conn.query(`UPDATE Food_Listing SET status = 'allocated' WHERE listing_id = ?`, [requestRow.listing_id]);

            await conn.query(`
                INSERT INTO Delivery (request_id, status)
                VALUES (?, 'pending')
                ON DUPLICATE KEY UPDATE status = VALUES(status)
            `, [requestId]);

            // Send approval email
            if (ngoData.length > 0) {
                const ngo = ngoData[0];
                emailService.sendRequestApprovedEmail(
                    ngo.email,
                    ngo.ngo_name,
                    requestRow.food_type,
                    restaurantData[0].restaurant_name
                );
            }
        } else {
            await conn.query(`UPDATE Request SET status = 'rejected' WHERE request_id = ?`, [requestId]);
            await conn.query(`UPDATE Food_Listing SET status = 'available' WHERE listing_id = ?`, [requestRow.listing_id]);

            // Send rejection email
            if (ngoData.length > 0) {
                const ngo = ngoData[0];
                emailService.sendRequestRejectedEmail(
                    ngo.email,
                    ngo.ngo_name,
                    requestRow.food_type,
                    restaurantData[0].restaurant_name
                );
            }
        }

        await conn.commit();
        return res.json({ message: `Request ${action}d successfully.` });
    } catch (err) {
        await conn.rollback();
        console.error(err);
        return res.status(500).json({ error: 'Database error updating request decision: ' + err.message });
    } finally {
        conn.release();
    }
});

// Delivery tracker for current user
app.get('/api/deliveries/me', authenticateToken, async (req, res) => {
    try {
        if (req.user.role === 'restaurant') {
            const [rows] = await pool.query(`
                SELECT
                    d.delivery_id,
                    d.status as delivery_status,
                    d.created_at as delivery_time,
                    r.request_id,
                    r.created_at as request_time,
                    n.name AS ngo_name,
                    f.food_type as food_name,
                    f.quantity
                FROM Delivery d
                JOIN Request r ON d.request_id = r.request_id
                JOIN Food_Listing f ON r.listing_id = f.listing_id
                JOIN NGO n ON r.ngo_id = n.ngo_id
                WHERE f.restaurant_id = ?
                ORDER BY r.created_at DESC
            `, [req.user.id]);

            return res.json({ deliveries: rows });
        }

        if (req.user.role === 'ngo') {
            const [rows] = await pool.query(`
                SELECT
                    d.delivery_id,
                    d.status as delivery_status,
                    d.created_at as delivery_time,
                    r.request_id,
                    r.created_at as request_time,
                    rs.name AS restaurant_name,
                    f.food_type as food_name,
                    f.quantity
                FROM Delivery d
                JOIN Request r ON d.request_id = r.request_id
                JOIN Food_Listing f ON r.listing_id = f.listing_id
                JOIN Restaurant rs ON f.restaurant_id = rs.restaurant_id
                WHERE r.ngo_id = ?
                ORDER BY r.created_at DESC
            `, [req.user.id]);

            return res.json({ deliveries: rows });
        }

        return res.status(403).json({ error: 'Unauthorized' });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ error: 'Database error fetching deliveries: ' + err.message });
    }
});

// Update delivery status (Restaurant only)
// Note: real Delivery table only has: delivery_id, request_id, status, created_at
app.patch('/api/deliveries/:deliveryId/status', authenticateToken, async (req, res) => {
    if (req.user.role !== 'restaurant') return res.status(403).json({ error: 'Unauthorized' });

    const deliveryId = Number(req.params.deliveryId);
    const { status } = req.body;
    const allowed = ['in transit', 'delivered', 'cancelled'];
    const statusLower = String(status || '').toLowerCase();
    if (!allowed.includes(statusLower)) {
        return res.status(400).json({ error: 'Invalid delivery status. Use: in transit, delivered, cancelled' });
    }

    try {
        const [rows] = await pool.query(`
            SELECT d.delivery_id, f.restaurant_id, r.ngo_id, f.food_type
            FROM Delivery d
            JOIN Request r ON d.request_id = r.request_id
            JOIN Food_Listing f ON r.listing_id = f.listing_id
            WHERE d.delivery_id = ?
            LIMIT 1
        `, [deliveryId]);

        if (rows.length === 0) {
            return res.status(404).json({ error: 'Delivery not found.' });
        }

        if (rows[0].restaurant_id !== req.user.id) {
            return res.status(403).json({ error: 'You can only update your own deliveries.' });
        }

        await pool.query(`UPDATE Delivery SET status = ? WHERE delivery_id = ?`, [statusLower, deliveryId]);

        // Send delivery status update email
        if (['in transit', 'delivered'].includes(statusLower)) {
            const [ngoData] = await pool.query(`SELECT email, name AS ngo_name FROM NGO WHERE ngo_id = ?`, [rows[0].ngo_id]);
            const [restaurantData] = await pool.query(`SELECT name AS restaurant_name FROM Restaurant WHERE restaurant_id = ?`, [rows[0].restaurant_id]);
            
            if (ngoData.length > 0) {
                const ngo = ngoData[0];
                emailService.sendDeliveryUpdateEmail(
                    ngo.email,
                    ngo.ngo_name,
                    rows[0].food_type,
                    restaurantData[0].restaurant_name,
                    statusLower
                );
            }
        }

        return res.json({ message: 'Delivery status updated successfully.' });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ error: 'Database error updating delivery status: ' + err.message });
    }
});

/* ====================================
   SEARCH & FILTER ROUTES
==================================== */

// Search and filter available food (NGO)
app.get('/api/food/search', authenticateToken, async (req, res) => {
    if (req.user.role !== 'ngo') return res.status(403).json({ error: 'Unauthorized' });
    try {
        const { food_type, location, category, sort_by } = req.query;
        let query = `
            SELECT f.listing_id as food_id, f.food_type as food_name, f.quantity, f.pickup_by as expiry_time, 
                   f.status, f.created_at, f.category,
                   r.name as restaurant_name, r.location, r.restaurant_id
            FROM Food_Listing f
            JOIN Restaurant r ON f.restaurant_id = r.restaurant_id
            WHERE f.status = 'available' AND (f.pickup_by IS NULL OR f.pickup_by > NOW())
        `;
        const params = [];

        if (food_type && food_type.trim()) {
            query += ` AND f.food_type LIKE ?`;
            params.push(`%${food_type.trim()}%`);
        }

        if (location && location.trim()) {
            query += ` AND r.location LIKE ?`;
            params.push(`%${location.trim()}%`);
        }

        if (category && category.trim()) {
            query += ` AND f.category = ?`;
            params.push(category.trim());
        }

        if (sort_by === 'expiry_asc') {
            query += ` ORDER BY f.pickup_by ASC`;
        } else if (sort_by === 'newest') {
            query += ` ORDER BY f.created_at DESC`;
        } else {
            query += ` ORDER BY f.created_at DESC`;
        }

        const [foods] = await pool.query(query, params);
        res.json({ foods, count: foods.length });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Database error searching food: ' + err.message });
    }
});

// Get all categories (for filter dropdown)
app.get('/api/categories', async (req, res) => {
    try {
        const [categories] = await pool.query(
            `SELECT DISTINCT category FROM Food_Listing WHERE category IS NOT NULL ORDER BY category ASC`
        );
        res.json({ categories: categories.map(c => c.category) });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Database error fetching categories: ' + err.message });
    }
});

/* ====================================
   RATING & REVIEW ROUTES
==================================== */

// Submit a review (NGO can review restaurants)
app.post('/api/reviews', authenticateToken, async (req, res) => {
    if (req.user.role !== 'ngo') return res.status(403).json({ error: 'Only NGOs can submit reviews' });
    
    const { restaurant_id, rating, comment } = req.body;
    
    if (!restaurant_id) return res.status(400).json({ error: 'Restaurant ID is required' });
    if (!rating || rating < 1 || rating > 5) return res.status(400).json({ error: 'Rating must be 1-5' });

    try {
        // Check if NGO has made at least one request to this restaurant
        const [requests] = await pool.query(`
            SELECT COUNT(*) as count FROM Request r
            JOIN Food_Listing f ON r.listing_id = f.listing_id
            WHERE r.ngo_id = ? AND f.restaurant_id = ? AND r.status IN ('approved', 'pending')
            LIMIT 1
        `, [req.user.id, restaurant_id]);

        if (requests[0].count === 0) {
            return res.status(403).json({ error: 'You can only review restaurants you have interacted with' });
        }

        await pool.query(`
            INSERT INTO Review (ngo_id, restaurant_id, rating, comment)
            VALUES (?, ?, ?, ?)
            ON DUPLICATE KEY UPDATE rating = ?, comment = ?
        `, [req.user.id, restaurant_id, rating, comment || null, rating, comment || null]);

        res.status(201).json({ message: 'Review submitted successfully!' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Database error submitting review: ' + err.message });
    }
});

// Get reviews for a restaurant
app.get('/api/reviews/restaurant/:restaurantId', async (req, res) => {
    const restaurantId = Number(req.params.restaurantId);
    
    try {
        const [reviews] = await pool.query(`
            SELECT 
                rv.review_id,
                rv.rating,
                rv.comment,
                rv.created_at,
                n.name as ngo_name
            FROM Review rv
            JOIN NGO n ON rv.ngo_id = n.ngo_id
            WHERE rv.restaurant_id = ?
            ORDER BY rv.created_at DESC
        `, [restaurantId]);

        // Calculate average rating
        const [stats] = await pool.query(`
            SELECT 
                AVG(rating) as avg_rating,
                COUNT(*) as total_reviews
            FROM Review
            WHERE restaurant_id = ?
        `, [restaurantId]);

        res.json({
            reviews,
            stats: {
                average_rating: stats[0].avg_rating ? parseFloat(stats[0].avg_rating).toFixed(1) : 0,
                total_reviews: stats[0].total_reviews
            }
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Database error fetching reviews: ' + err.message });
    }
});

// Get user's own review for a restaurant (if exists)
app.get('/api/reviews/my-review/:restaurantId', authenticateToken, async (req, res) => {
    if (req.user.role !== 'ngo') return res.status(403).json({ error: 'Only NGOs can view reviews' });
    
    const restaurantId = Number(req.params.restaurantId);
    
    try {
        const [review] = await pool.query(`
            SELECT review_id, rating, comment, created_at
            FROM Review
            WHERE ngo_id = ? AND restaurant_id = ?
        `, [req.user.id, restaurantId]);

        res.json({ review: review.length > 0 ? review[0] : null });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Database error fetching review: ' + err.message });
    }
});

/* ====================================
   AUDIT LOG ROUTES
==================================== */

// Get audit logs (Admin/System only - limit to authenticated users)
app.get('/api/audit-logs', authenticateToken, async (req, res) => {
    try {
        const limit = Math.min(parseInt(req.query.limit) || 50, 1000);
        const offset = parseInt(req.query.offset) || 0;
        const table = req.query.table || null;

        let query = 'SELECT * FROM Audit_Log';
        const params = [];

        if (table) {
            query += ' WHERE table_name = ?';
            params.push(table);
        }

        query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
        params.push(limit, offset);

        const [logs] = await pool.query(query, params);
        const [countResult] = await pool.query('SELECT COUNT(*) as total FROM Audit_Log');

        res.json({
            logs,
            total: countResult[0].total,
            limit,
            offset
        });
    } catch (err) {
        console.error('Audit log error:', err);
        res.status(500).json({ error: 'Database error fetching audit logs.' });
    }
});

/* ====================================
   GEOLOCATION ROUTES (NEW)
==================================== */

// GEOCODE ADDRESS - Convert address to coordinates
app.post('/api/geolocation/geocode', async (req, res) => {
    const { address } = req.body;

    try {
        if (!address || address.trim() === '') {
            return res.status(400).json({ error: 'Address is required' });
        }

        // Try to get from cache first
        const [cached] = await pool.query(
            'SELECT latitude, longitude FROM Geolocation_Cache WHERE address = ?',
            [address.trim()]
        );

        if (cached.length > 0) {
            return res.json({
                source: 'cache',
                address,
                latitude: cached[0].latitude,
                longitude: cached[0].longitude
            });
        }

        // Geocode using Nominatim API
        const result = await geolocationService.geocodeAddress(address);

        // Cache the result
        await pool.query(
            'INSERT INTO Geolocation_Cache (address, latitude, longitude) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE cached_at = NOW()',
            [address.trim(), result.latitude, result.longitude]
        );

        res.json({
            source: 'nominatim',
            address: result.display_name,
            latitude: result.latitude,
            longitude: result.longitude,
            display_name: result.display_name
        });
    } catch (error) {
        console.error('Geocoding error:', error);
        res.status(500).json({ error: error.message || 'Failed to geocode address' });
    }
});

// UPDATE RESTAURANT LOCATION - Store coordinates for restaurant
app.put('/api/restaurant/:id/location', authenticateToken, async (req, res) => {
    const { latitude, longitude, address } = req.body;
    const restaurantId = req.params.id;

    try {
        // Validate coordinates
        if (!geolocationService.isValidCoordinates(latitude, longitude)) {
            return res.status(400).json({ error: 'Invalid coordinates provided' });
        }

        // Update restaurant with coordinates
        const query = `
            UPDATE Restaurant 
            SET latitude = ?, longitude = ?, address_geocoded = ?
            WHERE restaurant_id = ?
        `;

        const [result] = await pool.query(query, [latitude, longitude, address || '', restaurantId]);

        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Restaurant not found' });
        }

        res.json({
            success: true,
            message: 'Location updated successfully',
            restaurantId,
            latitude,
            longitude,
            mapsLink: geolocationService.getOpenStreetMapLink(latitude, longitude)
        });
    } catch (error) {
        console.error('Error updating restaurant location:', error);
        res.status(500).json({ error: 'Failed to update location' });
    }
});

// UPDATE NGO LOCATION - Store coordinates for NGO
app.put('/api/ngo/:id/location', authenticateToken, async (req, res) => {
    const { latitude, longitude, address } = req.body;
    const ngoId = req.params.id;

    try {
        // Validate coordinates
        if (!geolocationService.isValidCoordinates(latitude, longitude)) {
            return res.status(400).json({ error: 'Invalid coordinates provided' });
        }

        // Update NGO with coordinates
        const query = `
            UPDATE NGO 
            SET latitude = ?, longitude = ?, address_geocoded = ?
            WHERE ngo_id = ?
        `;

        const [result] = await pool.query(query, [latitude, longitude, address || '', ngoId]);

        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'NGO not found' });
        }

        res.json({
            success: true,
            message: 'Location updated successfully',
            ngoId,
            latitude,
            longitude,
            mapsLink: geolocationService.getOpenStreetMapLink(latitude, longitude)
        });
    } catch (error) {
        console.error('Error updating NGO location:', error);
        res.status(500).json({ error: 'Failed to update location' });
    }
});

// GET ALL LOCATIONS FOR MAP
app.get('/api/nearby-restaurants', authenticateToken, async (req, res) => {
    try {
        const [restaurants] = await pool.query(`
            SELECT restaurant_id, name, location, latitude, longitude
            FROM Restaurant 
            WHERE latitude IS NOT NULL AND longitude IS NOT NULL
        `);
        const [ngos] = await pool.query(`
            SELECT ngo_id, name, location, latitude, longitude
            FROM NGO 
            WHERE latitude IS NOT NULL AND longitude IS NOT NULL
        `);
        res.json({ restaurants, ngos });
    } catch (error) {
        console.error('Map endpoint error:', error);
        res.status(500).json({ error: 'Failed to load map data' });
    }
});

// GET NEARBY RESTAURANTS - Find restaurants near an NGO
app.get('/api/nearby/restaurants', authenticateToken, async (req, res) => {
    const { latitude, longitude, radius = 5 } = req.query;

    try {
        if (!latitude || !longitude) {
            return res.status(400).json({ error: 'Latitude and longitude are required' });
        }

        const lat = parseFloat(latitude);
        const lon = parseFloat(longitude);
        const radiusKm = parseFloat(radius);

        if (!geolocationService.isValidCoordinates(lat, lon)) {
            return res.status(400).json({ error: 'Invalid coordinates' });
        }

        if (radiusKm <= 0 || radiusKm > 50) {
            return res.status(400).json({ error: 'Radius must be between 0 and 50 km' });
        }

        // Get all restaurants with coordinates
        const [restaurants] = await pool.query(`
            SELECT restaurant_id, name, location, contact, latitude, longitude, 
                   COUNT(food_id) as active_listings
            FROM Restaurant 
            LEFT JOIN Food_Listing ON Restaurant.restaurant_id = Food_Listing.restaurant_id 
                AND Food_Listing.status = 'Available'
            WHERE latitude IS NOT NULL AND longitude IS NOT NULL
            GROUP BY restaurant_id
        `);

        // Calculate distances and filter
        const nearby = geolocationService.findNearbyLocations(
            restaurants,
            lat,
            lon,
            radiusKm
        ).map(r => ({
            ...r,
            estimated_delivery_time_minutes: geolocationService.estimateDeliveryTime(r.distance)
        }));

        res.json({
            center: { latitude: lat, longitude: lon },
            radius_km: radiusKm,
            total_nearby: nearby.length,
            restaurants: nearby
        });
    } catch (error) {
        console.error('Error finding nearby restaurants:', error);
        res.status(500).json({ error: 'Failed to find nearby restaurants' });
    }
});

// GET NEARBY NGOS - Find NGOs near a restaurant
app.get('/api/nearby/ngos', authenticateToken, async (req, res) => {
    const { latitude, longitude, radius = 5 } = req.query;

    try {
        if (!latitude || !longitude) {
            return res.status(400).json({ error: 'Latitude and longitude are required' });
        }

        const lat = parseFloat(latitude);
        const lon = parseFloat(longitude);
        const radiusKm = parseFloat(radius);

        if (!geolocationService.isValidCoordinates(lat, lon)) {
            return res.status(400).json({ error: 'Invalid coordinates' });
        }

        if (radiusKm <= 0 || radiusKm > 50) {
            return res.status(400).json({ error: 'Radius must be between 0 and 50 km' });
        }

        // Get all NGOs with coordinates
        const [ngos] = await pool.query(`
            SELECT ngo_id, name, location, contact, latitude, longitude,
                   COUNT(request_id) as pending_requests
            FROM NGO 
            LEFT JOIN Request ON NGO.ngo_id = Request.ngo_id 
                AND Request.status = 'Pending'
            WHERE latitude IS NOT NULL AND longitude IS NOT NULL
            GROUP BY ngo_id
        `);

        // Calculate distances and filter
        const nearby = geolocationService.findNearbyLocations(
            ngos,
            lat,
            lon,
            radiusKm
        ).map(n => ({
            ...n,
            estimated_delivery_time_minutes: geolocationService.estimateDeliveryTime(n.distance)
        }));

        res.json({
            center: { latitude: lat, longitude: lon },
            radius_km: radiusKm,
            total_nearby: nearby.length,
            ngos: nearby
        });
    } catch (error) {
        console.error('Error finding nearby NGOs:', error);
        res.status(500).json({ error: 'Failed to find nearby NGOs' });
    }
});

// GET DISTANCE BETWEEN TWO LOCATIONS
app.get('/api/geolocation/distance', async (req, res) => {
    const { lat1, lon1, lat2, lon2 } = req.query;

    try {
        if (!lat1 || !lon1 || !lat2 || !lon2) {
            return res.status(400).json({ error: 'All coordinates are required' });
        }

        const latitude1 = parseFloat(lat1);
        const longitude1 = parseFloat(lon1);
        const latitude2 = parseFloat(lat2);
        const longitude2 = parseFloat(lon2);

        if (!geolocationService.isValidCoordinates(latitude1, longitude1) || 
            !geolocationService.isValidCoordinates(latitude2, longitude2)) {
            return res.status(400).json({ error: 'Invalid coordinates' });
        }

        const distance = geolocationService.calculateDistance(
            latitude1, longitude1,
            latitude2, longitude2
        );

        const deliveryTime = geolocationService.estimateDeliveryTime(distance);

        res.json({
            from: { latitude: latitude1, longitude: longitude1 },
            to: { latitude: latitude2, longitude: longitude2 },
            distance_km: distance,
            estimated_delivery_time_minutes: deliveryTime
        });
    } catch (error) {
        console.error('Error calculating distance:', error);
        res.status(500).json({ error: 'Failed to calculate distance' });
    }
});

// ADD DELIVERY LOCATION HISTORY - Track delivery route
app.post('/api/delivery/:deliveryId/location', authenticateToken, async (req, res) => {
    const { latitude, longitude } = req.body;
    const { deliveryId } = req.params;

    try {
        if (!geolocationService.isValidCoordinates(latitude, longitude)) {
            return res.status(400).json({ error: 'Invalid coordinates' });
        }

        // Verify delivery exists
        const [delivery] = await pool.query(
            'SELECT delivery_id FROM Delivery WHERE delivery_id = ?',
            [deliveryId]
        );

        if (delivery.length === 0) {
            return res.status(404).json({ error: 'Delivery not found' });
        }

        // Record location history
        const [result] = await pool.query(
            `INSERT INTO Location_History (delivery_id, latitude, longitude) 
             VALUES (?, ?, ?)`,
            [deliveryId, latitude, longitude]
        );

        res.status(201).json({
            success: true,
            message: 'Location recorded',
            location_id: result.insertId,
            deliveryId,
            latitude,
            longitude,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error('Error recording delivery location:', error);
        res.status(500).json({ error: 'Failed to record location' });
    }
});

// GET DELIVERY ROUTE HISTORY - Show all locations for a delivery
app.get('/api/delivery/:deliveryId/route', authenticateToken, async (req, res) => {
    const { deliveryId } = req.params;

    try {
        const [locations] = await pool.query(
            `SELECT location_id, latitude, longitude, timestamp 
             FROM Location_History 
             WHERE delivery_id = ? 
             ORDER BY timestamp ASC`,
            [deliveryId]
        );

        if (locations.length === 0) {
            return res.json({
                deliveryId,
                message: 'No location history yet',
                locations: []
            });
        }

        // Calculate total distance traveled
        let totalDistance = 0;
        for (let i = 1; i < locations.length; i++) {
            totalDistance += geolocationService.calculateDistance(
                locations[i - 1].latitude,
                locations[i - 1].longitude,
                locations[i].latitude,
                locations[i].longitude
            );
        }

        res.json({
            deliveryId,
            total_points: locations.length,
            total_distance_km: totalDistance.toFixed(2),
            locations: locations.map(loc => ({
                ...loc,
                coordinates: `${loc.latitude},${loc.longitude}`
            }))
        });
    } catch (error) {
        console.error('Error fetching delivery route:', error);
        res.status(500).json({ error: 'Failed to fetch delivery route' });
    }
});

// Serve the app initially
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Export the app for Vercel
module.exports = app;

// Only start the server if executed directly (not when imported by Vercel)
if (require.main === module) {
    app.listen(PORT, () => {
        console.log(`Server is running on http://localhost:${PORT}`);
    });
}
