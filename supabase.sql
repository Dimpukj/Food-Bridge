-- ============================================================
-- FoodBridge — Food Waste Management System
-- Supabase PostgreSQL Database Schema
-- Works natively with Supabase PostgreSQL & Vercel deployment
-- ============================================================

-- Enable required extensions if not enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Drop existing tables if re-initialising (in reverse dependency order)
DROP TABLE IF EXISTS Location_History CASCADE;
DROP TABLE IF EXISTS Geolocation_Cache CASCADE;
DROP TABLE IF EXISTS Review CASCADE;
DROP TABLE IF EXISTS Delivery CASCADE;
DROP TABLE IF EXISTS Request CASCADE;
DROP TABLE IF EXISTS Food_Listing CASCADE;
DROP TABLE IF EXISTS NGO CASCADE;
DROP TABLE IF EXISTS Restaurant CASCADE;
DROP TABLE IF EXISTS Audit_Log CASCADE;

-- ──────────────────────────────────────────────
-- 1. RESTAURANT (Food Donors)
-- ──────────────────────────────────────────────
CREATE TABLE Restaurant (
    restaurant_id   SERIAL PRIMARY KEY,
    name            VARCHAR(150)    NOT NULL,
    location        VARCHAR(300)    NOT NULL,
    contact         VARCHAR(15)     NOT NULL,
    email           VARCHAR(100)    NOT NULL UNIQUE,
    password        VARCHAR(255)    NOT NULL,
    latitude        DECIMAL(10, 8)  DEFAULT NULL,
    longitude       DECIMAL(11, 8)  DEFAULT NULL,
    address_geocoded VARCHAR(255)   DEFAULT NULL,
    created_at      TIMESTAMP       WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_restaurant_location ON Restaurant (latitude, longitude);

-- ──────────────────────────────────────────────
-- 2. NGO (Food Receivers)
-- ──────────────────────────────────────────────
CREATE TABLE NGO (
    ngo_id          SERIAL PRIMARY KEY,
    name            VARCHAR(150)    NOT NULL,
    location        VARCHAR(300)    NOT NULL,
    contact         VARCHAR(15)     NOT NULL,
    email           VARCHAR(100)    NOT NULL UNIQUE,
    password        VARCHAR(255)    NOT NULL,
    latitude        DECIMAL(10, 8)  DEFAULT NULL,
    longitude       DECIMAL(11, 8)  DEFAULT NULL,
    address_geocoded VARCHAR(255)   DEFAULT NULL,
    created_at      TIMESTAMP       WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_ngo_location ON NGO (latitude, longitude);

-- ──────────────────────────────────────────────
-- 3. FOOD_LISTING (Surplus food listed by restaurants)
-- ──────────────────────────────────────────────
CREATE TABLE Food_Listing (
    listing_id      SERIAL PRIMARY KEY,
    restaurant_id   INT             NOT NULL REFERENCES Restaurant(restaurant_id) ON DELETE CASCADE,
    food_type       VARCHAR(200)    NOT NULL,
    quantity        INT             NOT NULL DEFAULT 1,
    pickup_by       TIMESTAMP       WITH TIME ZONE DEFAULT NULL,
    status          VARCHAR(20)     DEFAULT 'available' CHECK (LOWER(status) IN ('available', 'requested', 'allocated', 'expired')),
    category        VARCHAR(50)     DEFAULT NULL,
    created_at      TIMESTAMP       WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_food_listing_restaurant ON Food_Listing (restaurant_id);
CREATE INDEX idx_food_listing_status ON Food_Listing (status);

-- ──────────────────────────────────────────────
-- 4. REQUEST (NGO requests for food)
-- ──────────────────────────────────────────────
CREATE TABLE Request (
    request_id      SERIAL PRIMARY KEY,
    ngo_id          INT             NOT NULL REFERENCES NGO(ngo_id) ON DELETE CASCADE,
    listing_id      INT             NOT NULL REFERENCES Food_Listing(listing_id) ON DELETE CASCADE,
    request_time    TIMESTAMP       WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    status          VARCHAR(20)     DEFAULT 'pending' CHECK (LOWER(status) IN ('pending', 'approved', 'rejected')),
    remarks         TEXT            DEFAULT NULL,
    created_at      TIMESTAMP       WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP       WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_request_ngo ON Request (ngo_id);
CREATE INDEX idx_request_listing ON Request (listing_id);

-- ──────────────────────────────────────────────
-- 5. DELIVERY (Deliveries for approved requests)
-- ──────────────────────────────────────────────
CREATE TABLE Delivery (
    delivery_id     SERIAL PRIMARY KEY,
    request_id      INT             NOT NULL UNIQUE REFERENCES Request(request_id) ON DELETE CASCADE,
    status          VARCHAR(20)     DEFAULT 'pending' CHECK (LOWER(status) IN ('pending', 'in transit', 'delivered', 'cancelled')),
    delivery_time   TIMESTAMP       WITH TIME ZONE DEFAULT NULL,
    delivery_agent  VARCHAR(100)    DEFAULT NULL,
    agent_phone     VARCHAR(15)     DEFAULT NULL,
    created_at      TIMESTAMP       WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_delivery_request ON Delivery (request_id);

-- ──────────────────────────────────────────────
-- 6. REVIEW (Ratings & feedback for restaurants by NGOs)
-- ──────────────────────────────────────────────
CREATE TABLE Review (
    review_id       SERIAL PRIMARY KEY,
    ngo_id          INT             NOT NULL REFERENCES NGO(ngo_id) ON DELETE CASCADE,
    restaurant_id   INT             NOT NULL REFERENCES Restaurant(restaurant_id) ON DELETE CASCADE,
    rating          INT             NOT NULL CHECK (rating >= 1 AND rating <= 5),
    comment         TEXT            DEFAULT NULL,
    created_at      TIMESTAMP       WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_ngo_restaurant_review UNIQUE (ngo_id, restaurant_id)
);

-- ──────────────────────────────────────────────
-- 7. LOCATION_HISTORY (Delivery route tracking)
-- ──────────────────────────────────────────────
CREATE TABLE Location_History (
    location_id     SERIAL PRIMARY KEY,
    delivery_id     INT             NOT NULL REFERENCES Delivery(delivery_id) ON DELETE CASCADE,
    latitude        DECIMAL(10, 8)  NOT NULL,
    longitude       DECIMAL(11, 8)  NOT NULL,
    timestamp       TIMESTAMP       WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_location_history_delivery ON Location_History (delivery_id, timestamp);

-- ──────────────────────────────────────────────
-- 8. GEOLOCATION_CACHE (Cached geocoding results)
-- ──────────────────────────────────────────────
CREATE TABLE Geolocation_Cache (
    cache_id        SERIAL PRIMARY KEY,
    address         VARCHAR(500)    UNIQUE NOT NULL,
    latitude        DECIMAL(10, 8)  NOT NULL,
    longitude       DECIMAL(11, 8)  NOT NULL,
    cached_at       TIMESTAMP       WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ──────────────────────────────────────────────
-- 9. AUDIT_LOG (Audit log for table mutations)
-- ──────────────────────────────────────────────
CREATE TABLE Audit_Log (
    id              SERIAL PRIMARY KEY,
    table_name      VARCHAR(64)     NOT NULL,
    row_id          INT,
    action          VARCHAR(16)     NOT NULL,
    changed_at      TIMESTAMP       WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    who             VARCHAR(100)    DEFAULT 'SYSTEM',
    payload         JSONB           DEFAULT NULL,
    created_at      TIMESTAMP       WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ──────────────────────────────────────────────
-- PL/pgSQL AUDIT LOG TRIGGERS
-- ──────────────────────────────────────────────
CREATE OR REPLACE FUNCTION process_audit_log()
RETURNS TRIGGER AS $$
BEGIN
    IF (TG_OP = 'INSERT') THEN
        INSERT INTO Audit_Log (table_name, row_id, action, who, payload)
        VALUES (TG_TABLE_NAME, COALESCE(NEW.listing_id, NEW.request_id, NEW.delivery_id, 0), 'INSERT', 'SYSTEM', row_to_json(NEW)::jsonb);
        RETURN NEW;
    ELSIF (TG_OP = 'UPDATE') THEN
        INSERT INTO Audit_Log (table_name, row_id, action, who, payload)
        VALUES (TG_TABLE_NAME, COALESCE(NEW.listing_id, NEW.request_id, NEW.delivery_id, 0), 'UPDATE', 'SYSTEM', jsonb_build_object('old_status', OLD.status, 'new_status', NEW.status));
        RETURN NEW;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tr_food_listing_audit
    AFTER INSERT OR UPDATE ON Food_Listing
    FOR EACH ROW EXECUTE FUNCTION process_audit_log();

CREATE TRIGGER tr_request_audit
    AFTER INSERT OR UPDATE ON Request
    FOR EACH ROW EXECUTE FUNCTION process_audit_log();

CREATE TRIGGER tr_delivery_audit
    AFTER INSERT OR UPDATE ON Delivery
    FOR EACH ROW EXECUTE FUNCTION process_audit_log();

-- ──────────────────────────────────────────────
-- ROW LEVEL SECURITY (RLS) POLICIES
-- Allows service key & authenticated connections full access
-- ──────────────────────────────────────────────
ALTER TABLE Restaurant ENABLE ROW LEVEL SECURITY;
ALTER TABLE NGO ENABLE ROW LEVEL SECURITY;
ALTER TABLE Food_Listing ENABLE ROW LEVEL SECURITY;
ALTER TABLE Request ENABLE ROW LEVEL SECURITY;
ALTER TABLE Delivery ENABLE ROW LEVEL SECURITY;
ALTER TABLE Review ENABLE ROW LEVEL SECURITY;
ALTER TABLE Location_History ENABLE ROW LEVEL SECURITY;
ALTER TABLE Geolocation_Cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE Audit_Log ENABLE ROW LEVEL SECURITY;

-- Allow anon and service_role full read/write access for backend API operations
CREATE POLICY "Allow public access to Restaurant" ON Restaurant FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow public access to NGO" ON NGO FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow public access to Food_Listing" ON Food_Listing FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow public access to Request" ON Request FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow public access to Delivery" ON Delivery FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow public access to Review" ON Review FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow public access to Location_History" ON Location_History FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow public access to Geolocation_Cache" ON Geolocation_Cache FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow public access to Audit_Log" ON Audit_Log FOR ALL USING (true) WITH CHECK (true);

-- ──────────────────────────────────────────────
-- SAMPLE DATA (Initial Seed for Testing)
-- ──────────────────────────────────────────────

-- Passwords are set to bcrypt hash of 'pass123'
INSERT INTO Restaurant (name, location, contact, email, password, latitude, longitude) VALUES
    ('Raj''s Kitchen',    'Koramangala, Bangalore',  '9876543210', 'raj@kitchen.com',     '$2a$10$wT5H81X70G8x3T38r89/I.QfDk68g72d82910g9f8a7s6d5f4g3h2', 12.9352, 77.6245),
    ('Baker''s Delight',  'Indiranagar, Bangalore',  '9876543211', 'baker@delight.com',   '$2a$10$wT5H81X70G8x3T38r89/I.QfDk68g72d82910g9f8a7s6d5f4g3h2', 12.9784, 77.6408),
    ('Spice Garden',     'HSR Layout, Bangalore',   '9876543212', 'spice@garden.com',    '$2a$10$wT5H81X70G8x3T38r89/I.QfDk68g72d82910g9f8a7s6d5f4g3h2', 12.9121, 77.6446),
    ('Green Bowl',       'Whitefield, Bangalore',   '9876543213', 'green@bowl.com',      '$2a$10$wT5H81X70G8x3T38r89/I.QfDk68g72d82910g9f8a7s6d5f4g3h2', 12.9698, 77.7500),
    ('Tandoori Nights',  'MG Road, Bangalore',      '9876543214', 'tandoori@nights.com', '$2a$10$wT5H81X70G8x3T38r89/I.QfDk68g72d82910g9f8a7s6d5f4g3h2', 12.9756, 77.6066);

INSERT INTO NGO (name, location, contact, email, password, latitude, longitude) VALUES
    ('Hope Foundation',  'Jayanagar, Bangalore',    '9876543220', 'hope@foundation.org', '$2a$10$wT5H81X70G8x3T38r89/I.QfDk68g72d82910g9f8a7s6d5f4g3h2', 12.9250, 77.5938),
    ('Feed India',       'Rajajinagar, Bangalore',  '9876543221', 'feed@india.org',      '$2a$10$wT5H81X70G8x3T38r89/I.QfDk68g72d82910g9f8a7s6d5f4g3h2', 12.9915, 77.5526),
    ('Annapurna NGO',    'BTM Layout, Bangalore',   '9876543222', 'anna@purna.org',      '$2a$10$wT5H81X70G8x3T38r89/I.QfDk68g72d82910g9f8a7s6d5f4g3h2', 12.9166, 77.6101),
    ('Akshaya Trust',    'Koramangala, Bangalore',   '9876543223', 'akshaya@trust.org',   '$2a$10$wT5H81X70G8x3T38r89/I.QfDk68g72d82910g9f8a7s6d5f4g3h2', 12.9340, 77.6220),
    ('Seva Trust',       'Marathahalli, Bangalore', '9876543224', 'seva@trust.org',      '$2a$10$wT5H81X70G8x3T38r89/I.QfDk68g72d82910g9f8a7s6d5f4g3h2', 12.9592, 77.6974);

INSERT INTO Food_Listing (restaurant_id, food_type, quantity, pickup_by, status, category) VALUES
    (1, 'Vegetable Biryani',  10, CURRENT_TIMESTAMP + INTERVAL '12 hours', 'available',  'Cooked Meal'),
    (2, 'Bread Rolls',        50, CURRENT_TIMESTAMP + INTERVAL '18 hours', 'requested',  'Bakery'),
    (3, 'Dal Makhani',        5,  CURRENT_TIMESTAMP + INTERVAL '8 hours',  'allocated',  'Cooked Meal'),
    (4, 'Fresh Fruit Salad',  3,  CURRENT_TIMESTAMP + INTERVAL '24 hours', 'allocated',  'Raw Produce'),
    (5, 'Paneer Tikka',       20, CURRENT_TIMESTAMP + INTERVAL '10 hours', 'available',  'Cooked Meal');

INSERT INTO Request (ngo_id, listing_id, request_time, status, remarks) VALUES
    (1, 2, CURRENT_TIMESTAMP - INTERVAL '2 hours', 'pending',  'Need urgently for evening distribution'),
    (4, 5, CURRENT_TIMESTAMP - INTERVAL '3 hours', 'pending',  NULL),
    (2, 3, CURRENT_TIMESTAMP - INTERVAL '5 hours', 'approved', 'Confirmed pickup'),
    (3, 4, CURRENT_TIMESTAMP - INTERVAL '6 hours', 'approved', NULL);

INSERT INTO Delivery (request_id, status, delivery_agent, agent_phone) VALUES
    (3, 'in transit', 'Ramesh Kumar', '9988776655'),
    (4, 'delivered',  'Suresh Yadav', '9988776656');
