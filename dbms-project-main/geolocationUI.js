/**
 * Geolocation UI Module for FoodBridge
 * Handles all geolocation-related UI interactions
 */

/**
 * Geocode an address and update location fields
 * @param {string} address - Address to geocode
 * @returns {Promise<{latitude: number, longitude: number}>}
 */
async function geocodeAddress(address) {
    try {
        const response = await fetch('/api/geolocation/geocode', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('foodbridge_token')}`
            },
            body: JSON.stringify({ address })
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Geocoding failed');
        }

        const result = await response.json();
        return {
            latitude: result.latitude,
            longitude: result.longitude,
            displayName: result.display_name
        };
    } catch (error) {
        console.error('Geocoding error:', error);
        throw error;
    }
}

/**
 * Update user location (restaurant or NGO)
 * @param {string} userType - 'restaurant' or 'ngo'
 * @param {number} userId - User ID
 * @param {number} latitude - Latitude
 * @param {number} longitude - Longitude
 * @param {string} address - Full address
 * @returns {Promise<boolean>}
 */
async function updateUserLocation(userType, userId, latitude, longitude, address) {
    try {
        const endpoint = userType === 'restaurant' 
            ? `/api/restaurant/${userId}/location`
            : `/api/ngo/${userId}/location`;

        const response = await fetch(endpoint, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('foodbridge_token')}`
            },
            body: JSON.stringify({ latitude, longitude, address })
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Failed to update location');
        }

        return true;
    } catch (error) {
        console.error('Location update error:', error);
        throw error;
    }
}

/**
 * Find nearby restaurants for an NGO
 * @param {number} latitude - Center latitude
 * @param {number} longitude - Center longitude
 * @param {number} radius - Search radius in km
 * @returns {Promise<Array>}
 */
async function findNearbyRestaurants(latitude, longitude, radius = 5) {
    try {
        const params = new URLSearchParams({
            latitude,
            longitude,
            radius
        });

        const response = await fetch(`/api/nearby/restaurants?${params}`, {
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('foodbridge_token')}`
            }
        });

        if (!response.ok) {
            throw new Error('Failed to find nearby restaurants');
        }

        return await response.json();
    } catch (error) {
        console.error('Error finding nearby restaurants:', error);
        throw error;
    }
}

/**
 * Find nearby NGOs for a restaurant
 * @param {number} latitude - Center latitude
 * @param {number} longitude - Center longitude
 * @param {number} radius - Search radius in km
 * @returns {Promise<Array>}
 */
async function findNearbyNGOs(latitude, longitude, radius = 5) {
    try {
        const params = new URLSearchParams({
            latitude,
            longitude,
            radius
        });

        const response = await fetch(`/api/nearby/ngos?${params}`, {
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('foodbridge_token')}`
            }
        });

        if (!response.ok) {
            throw new Error('Failed to find nearby NGOs');
        }

        return await response.json();
    } catch (error) {
        console.error('Error finding nearby NGOs:', error);
        throw error;
    }
}

/**
 * Calculate distance between two points
 * @param {number} lat1 - Latitude of point 1
 * @param {number} lon1 - Longitude of point 1
 * @param {number} lat2 - Latitude of point 2
 * @param {number} lon2 - Longitude of point 2
 * @returns {Promise<{distance_km: number, estimated_delivery_time_minutes: number}>}
 */
async function calculateDistance(lat1, lon1, lat2, lon2) {
    try {
        const params = new URLSearchParams({
            lat1, lon1, lat2, lon2
        });

        const response = await fetch(`/api/geolocation/distance?${params}`);

        if (!response.ok) {
            throw new Error('Failed to calculate distance');
        }

        return await response.json();
    } catch (error) {
        console.error('Error calculating distance:', error);
        throw error;
    }
}

/**
 * Record delivery location
 * @param {number} deliveryId - Delivery ID
 * @param {number} latitude - Latitude
 * @param {number} longitude - Longitude
 * @returns {Promise<boolean>}
 */
async function recordDeliveryLocation(deliveryId, latitude, longitude) {
    try {
        const response = await fetch(`/api/delivery/${deliveryId}/location`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('foodbridge_token')}`
            },
            body: JSON.stringify({ latitude, longitude })
        });

        if (!response.ok) {
            throw new Error('Failed to record delivery location');
        }

        return true;
    } catch (error) {
        console.error('Error recording delivery location:', error);
        throw error;
    }
}

/**
 * Get delivery route history
 * @param {number} deliveryId - Delivery ID
 * @returns {Promise<{locations: Array, total_distance_km: number}>}
 */
async function getDeliveryRoute(deliveryId) {
    try {
        const response = await fetch(`/api/delivery/${deliveryId}/route`, {
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('foodbridge_token')}`
            }
        });

        if (!response.ok) {
            throw new Error('Failed to fetch delivery route');
        }

        return await response.json();
    } catch (error) {
        console.error('Error fetching delivery route:', error);
        throw error;
    }
}

/**
 * Initialize Leaflet map
 * @param {string} elementId - HTML element ID
 * @param {number} latitude - Center latitude
 * @param {number} longitude - Center longitude
 * @param {number} zoom - Zoom level
 * @returns {object} Leaflet map instance
 */
function initializeMap(elementId, latitude = 40.7128, longitude = -74.0060, zoom = 13) {
    // Check if Leaflet is available
    if (typeof L === 'undefined') {
        console.error('Leaflet not loaded. Add: <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css" />');
        console.error('And: <script src="https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js"></script>');
        return null;
    }

    const mapElement = document.getElementById(elementId);
    if (!mapElement) {
        console.error(`Map element ${elementId} not found`);
        return null;
    }

    const map = L.map(elementId).setView([latitude, longitude], zoom);

    // Add OpenStreetMap tiles
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors',
        maxZoom: 19
    }).addTo(map);

    return map;
}

/**
 * Add marker to map
 * @param {object} map - Leaflet map instance
 * @param {number} latitude - Latitude
 * @param {number} longitude - Longitude
 * @param {string} title - Marker title
 * @param {string} type - 'restaurant', 'ngo', 'current', 'delivery'
 * @returns {object} Leaflet marker instance
 */
function addMapMarker(map, latitude, longitude, title, type = 'default') {
    if (!map) return null;

    const iconColors = {
        restaurant: '#ef4444', // red
        ngo: '#3b82f6',        // blue
        current: '#10b981',     // green
        delivery: '#f59e0b'    // amber
    };

    const color = iconColors[type] || '#6b7280';

    const marker = L.circleMarker([latitude, longitude], {
        radius: 8,
        fillColor: color,
        color: '#fff',
        weight: 2,
        opacity: 1,
        fillOpacity: 0.8
    }).addTo(map);

    marker.bindPopup(`<strong>${title}</strong><br/>Lat: ${latitude.toFixed(4)}, Lon: ${longitude.toFixed(4)}`);

    return marker;
}

/**
 * Draw route on map
 * @param {object} map - Leaflet map instance
 * @param {Array} locations - Array of {latitude, longitude}
 * @returns {object} Leaflet polyline instance
 */
function drawRoute(map, locations) {
    if (!map || !locations || locations.length < 2) return null;

    const latlngs = locations.map(loc => [loc.latitude, loc.longitude]);

    const polyline = L.polyline(latlngs, {
        color: '#3b82f6',
        weight: 3,
        opacity: 0.7,
        smoothFactor: 1
    }).addTo(map);

    // Fit map to route
    const group = L.featureGroup([polyline]);
    map.fitBounds(group.getBounds());

    return polyline;
}

/**
 * Create nearby locations HTML card
 * @param {object} location - Location object
 * @param {string} type - 'restaurant' or 'ngo'
 * @returns {string} HTML
 */
function createNearbyCard(location, type) {
    const typeLabel = type === 'restaurant' ? 'Restaurant' : 'NGO';
    const color = type === 'restaurant' ? 'text-red-600' : 'text-blue-600';
    
    return `
        <div class="border rounded-lg p-4 hover:shadow-lg transition">
            <div class="flex justify-between items-start">
                <div>
                    <h4 class="font-bold text-gray-900">${location.name}</h4>
                    <p class="text-sm text-gray-600">${location.location}</p>
                </div>
                <span class="text-xs font-bold px-2 py-1 rounded-full bg-gray-100 ${color}">
                    ${location.distance?.toFixed(2)}km
                </span>
            </div>
            <div class="mt-3 flex justify-between text-xs text-gray-500">
                <span>📞 ${location.contact}</span>
                <span>🚗 ${location.estimated_delivery_time_minutes || '?'} min</span>
            </div>
        </div>
    `;
}

// Export functions
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        geocodeAddress,
        updateUserLocation,
        findNearbyRestaurants,
        findNearbyNGOs,
        calculateDistance,
        recordDeliveryLocation,
        getDeliveryRoute,
        initializeMap,
        addMapMarker,
        drawRoute,
        createNearbyCard
    };
}
