/**
 * Maps Service - Generates OpenStreetMap embed URLs from addresses
 * Uses Nominatim (OpenStreetMap's geocoding API) - no API key required
 */

const NOMINATIM_BASE = 'https://nominatim.openstreetmap.org';
const USER_AGENT = 'StornoMatch/1.0';

/**
 * Generate OpenStreetMap embed URL from an address string
 * @param {string} address - Hotel address
 * @returns {Promise<string|null>} - Embed URL or null if not found
 */
export async function generateMapEmbed(address) {
  if (!address || typeof address !== 'string') return null;
  
  try {
    // First: geocode the address to get lat/lon
    const searchUrl = `${NOMINATIM_BASE}/search?q=${encodeURIComponent(address)}&format=json&limit=1`;
    
    const response = await fetch(searchUrl, {
      headers: { 'User-Agent': USER_AGENT }
    });
    
    if (!response.ok) return null;
    
    const results = await response.json();
    if (!results || results.length === 0) return null;
    
    const { lat, lon, display_name } = results[0];
    
    // Generate an OpenStreetMap iframe embed URL
    // Using the embed format
    const embedUrl = `https://www.openstreetmap.org/export/embed.html?bbox=${parseFloat(lon)-0.01},${parseFloat(lat)-0.005},${parseFloat(lon)+0.01},${parseFloat(lat)+0.005}&layer=mapnik&marker=${lat},${lon}`;
    
    return embedUrl;
  } catch (err) {
    console.error('Map geocoding error:', err);
    return null;
  }
}

/**
 * Generate a Google Maps deep link from address
 * @param {string} address - Hotel address
 * @returns {string|null} - Google Maps URL
 */
export function generateGoogleMapsLink(address) {
  if (!address) return null;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
}

/**
 * Get a static map image URL (fallback)
 * @param {string} address - Hotel address
 * @returns {Promise<string|null>} - Static map URL
 */
export async function generateStaticMapUrl(address) {
  if (!address) return null;
  
  try {
    const searchUrl = `${NOMINATIM_BASE}/search?q=${encodeURIComponent(address)}&format=json&limit=1`;
    
    const response = await fetch(searchUrl, {
      headers: { 'User-Agent': USER_AGENT }
    });
    
    if (!response.ok) return null;
    
    const results = await response.json();
    if (!results || results.length === 0) return null;
    
    const { lat, lon } = results[0];
    
    // Static map URL (OpenStreetMap tiles)
    return `https://staticmap.openstreetmap.de/staticmap.php?center=${lat},${lon}&zoom=15&size=400x200&markers=${lat},${lon},red-pushpin`;
  } catch (err) {
    return null;
  }
}
