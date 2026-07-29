-- ============================================================
-- Migration: Add Geolocation Features to FoodBridge
-- Date: May 2026
-- Description: Adds latitude/longitude to Restaurant and NGO tables
--              for location-based features and distance calculations
-- ============================================================

-- Step 1: Add geolocation columns to Restaurant table
ALTER TABLE Restaurant 
ADD COLUMN latitude DECIMAL(10, 8) DEFAULT NULL AFTER location,
ADD COLUMN longitude DECIMAL(11, 8) DEFAULT NULL AFTER latitude,
ADD COLUMN address_geocoded VARCHAR(255) DEFAULT NULL AFTER longitude,
ADD INDEX idx_restaurant_location (latitude, longitude);

-- Step 2: Add geolocation columns to NGO table
ALTER TABLE NGO 
ADD COLUMN latitude DECIMAL(10, 8) DEFAULT NULL AFTER location,
ADD COLUMN longitude DECIMAL(11, 8) DEFAULT NULL AFTER latitude,
ADD COLUMN address_geocoded VARCHAR(255) DEFAULT NULL AFTER longitude,
ADD INDEX idx_ngo_location (latitude, longitude);

-- Step 3: Create Location_History table for tracking delivery routes
CREATE TABLE IF NOT EXISTS Location_History (
    location_id INT AUTO_INCREMENT PRIMARY KEY,
    delivery_id INT NOT NULL,
    latitude DECIMAL(10, 8) NOT NULL,
    longitude DECIMAL(11, 8) NOT NULL,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (delivery_id) REFERENCES Delivery(delivery_id) ON DELETE CASCADE,
    INDEX idx_delivery_timestamp (delivery_id, timestamp)
);

-- Step 4: Create Geolocation_Cache table for caching geocoding results
CREATE TABLE IF NOT EXISTS Geolocation_Cache (
    cache_id INT AUTO_INCREMENT PRIMARY KEY,
    address VARCHAR(500) UNIQUE NOT NULL,
    latitude DECIMAL(10, 8) NOT NULL,
    longitude DECIMAL(11, 8) NOT NULL,
    cached_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_address (address)
);

-- ============================================================
-- VERIFICATION QUERIES (Run after migration)
-- ============================================================
-- SELECT * FROM Restaurant LIMIT 1; -- Should show new latitude/longitude columns
-- SELECT * FROM NGO LIMIT 1; -- Should show new latitude/longitude columns
-- SELECT * FROM Location_History; -- Should be empty table
-- SELECT * FROM Geolocation_Cache; -- Should be empty cache table
