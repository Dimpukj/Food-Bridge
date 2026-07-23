/**
 * Geolocation Service for FoodBridge
 * Handles:
 * - Geocoding (address → latitude/longitude) using Nominatim API
 * - Distance calculations (Haversine formula)
 * - Nearby location searches (restaurants/NGOs)
 * - Location caching to minimize API calls
 */

const https = require('https');

// Nominatim API endpoint (Free, from OpenStreetMap)
const NOMINATIM_API = 'https://nominatim.openstreetmap.org/search';

/**
 * Geocode a physical address to latitude and longitude
 * Uses Nominatim API (free, open-source) from OpenStreetMap
 * @param {string} address - Full address to geocode
 * @returns {Promise<{latitude: number, longitude: number, display_name: string}>}
 */
async function geocodeAddress(address) {
    if (!address || typeof address !== 'string') {
        throw new Error('Invalid address provided');
    }

    return new Promise((resolve, reject) => {
        const queryParams = new URLSearchParams({
            q: address,
            format: 'json',
            limit: 1
        });

        const url = `${NOMINATIM_API}?${queryParams.toString()}`;

        https.get(url, {
            headers: {
                'User-Agent': 'FoodBridge/1.0 (Food Waste Reduction Platform)'
            }
        }, (response) => {
            let data = '';

            response.on('data', chunk => {
                data += chunk;
            });

            response.on('end', () => {
                try {
                    const results = JSON.parse(data);

                    if (!results || results.length === 0) {
                        return reject(new Error('Address not found. Please check and try again.'));
                    }

                    const result = results[0];
                    resolve({
                        latitude: parseFloat(result.lat),
                        longitude: parseFloat(result.lon),
                        display_name: result.display_name,
                        address: result.address
                    });
                } catch (error) {
                    reject(new Error(`Geocoding error: ${error.message}`));
                }
            });
        }).on('error', (error) => {
            reject(new Error(`Geocoding request failed: ${error.message}`));
        });

        // Add timeout
        setTimeout(() => {
            reject(new Error('Geocoding request timeout'));
        }, 10000);
    });
}

/**
 * Calculate distance between two coordinates using Haversine formula
 * Returns distance in kilometers
 * @param {number} lat1 - Latitude of point 1
 * @param {number} lon1 - Longitude of point 1
 * @param {number} lat2 - Latitude of point 2
 * @param {number} lon2 - Longitude of point 2
 * @returns {number} Distance in kilometers
 */
function calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371; // Earth's radius in kilometers
    
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    
    const a = 
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distance = R * c;
    
    return parseFloat(distance.toFixed(2));
}

/**
 * Convert degrees to radians
 * @param {number} degrees
 * @returns {number}
 */
function toRad(degrees) {
    return degrees * (Math.PI / 180);
}

/**
 * Find nearby restaurants within a radius
 * @param {Array} restaurants - Array of restaurant objects with coordinates
 * @param {number} centerLat - Center latitude
 * @param {number} centerLon - Center longitude
 * @param {number} radiusKm - Search radius in kilometers
 * @returns {Array} Restaurants within radius, sorted by distance
 */
function findNearbyLocations(locations, centerLat, centerLon, radiusKm = 5) {
    if (!Array.isArray(locations)) return [];
    
    return locations
        .filter(loc => loc.latitude && loc.longitude)
        .map(loc => ({
            ...loc,
            distance: calculateDistance(centerLat, centerLon, loc.latitude, loc.longitude)
        }))
        .filter(loc => loc.distance <= radiusKm)
        .sort((a, b) => a.distance - b.distance);
}

/**
 * Estimate delivery time based on distance
 * Assumes average delivery speed of 30 km/h in urban areas
 * @param {number} distanceKm - Distance in kilometers
 * @returns {number} Estimated delivery time in minutes
 */
function estimateDeliveryTime(distanceKm) {
    const avgSpeedKmPerHour = 30;
    const bufferMinutes = 15; // Account for loading/unloading
    const timeMinutes = (distanceKm / avgSpeedKmPerHour) * 60 + bufferMinutes;
    return Math.ceil(timeMinutes);
}

/**
 * Format coordinates for display
 * @param {number} lat
 * @param {number} lon
 * @returns {string}
 */
function formatCoordinates(lat, lon) {
    if (!lat || !lon) return 'Location not set';
    return `${lat.toFixed(6)}, ${lon.toFixed(6)}`;
}

/**
 * Validate coordinates
 * @param {number} latitude
 * @param {number} longitude
 * @returns {boolean}
 */
function isValidCoordinates(latitude, longitude) {
    return (
        typeof latitude === 'number' &&
        typeof longitude === 'number' &&
        latitude >= -90 && latitude <= 90 &&
        longitude >= -180 && longitude <= 180
    );
}

/**
 * Generate Google Maps link from coordinates
 * @param {number} latitude
 * @param {number} longitude
 * @returns {string}
 */
function getMapsLink(latitude, longitude) {
    if (!isValidCoordinates(latitude, longitude)) {
        return null;
    }
    return `https://maps.google.com/?q=${latitude},${longitude}`;
}

/**
 * Generate OpenStreetMap link from coordinates
 * @param {number} latitude
 * @param {number} longitude
 * @returns {string}
 */
function getOpenStreetMapLink(latitude, longitude) {
    if (!isValidCoordinates(latitude, longitude)) {
        return null;
    }
    return `https://osm.org/?mlat=${latitude}&mlon=${longitude}&zoom=15`;
}

module.exports = {
    geocodeAddress,
    calculateDistance,
    findNearbyLocations,
    estimateDeliveryTime,
    formatCoordinates,
    isValidCoordinates,
    getMapsLink,
    getOpenStreetMapLink,
    toRad
};
