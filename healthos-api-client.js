/**
 * HealthOS API Client
 * Frontend integration for demo requests, visitor tracking, and form submissions
 * 
 * Add this to your HTML:
 * <script src="healthos-api-client.js"></script>
 * <script>
 *   HealthOSAPI.init({
 *     apiUrl: 'https://your-api-url.com', // or http://localhost:5000 for dev
 *   });
 * </script>
 */

const HealthOSAPI = {
  apiUrl: '',
  initialized: false,

  /**
   * Initialize the API client
   * @param {Object} config - Configuration object
   * @param {string} config.apiUrl - Base URL of the backend API
   */
  init: function(config) {
    if (!config.apiUrl) {
      console.error('HealthOS API: apiUrl is required');
      return;
    }
    this.apiUrl = config.apiUrl.replace(/\/$/, ''); // Remove trailing slash
    this.initialized = true;
    console.log('HealthOS API initialized:', this.apiUrl);
    
    // Track initial page visit
    this.trackVisitor();
  },

  /**
   * Make API requests
   * @private
   */
  request: async function(method, endpoint, data = null) {
    if (!this.initialized) {
      console.error('HealthOS API: Must call init() first');
      return null;
    }

    const url = `${this.apiUrl}${endpoint}`;
    const options = {
      method,
      headers: {
        'Content-Type': 'application/json',
      },
    };

    if (data) {
      options.body = JSON.stringify(data);
    }

    try {
      const response = await fetch(url, options);
      const result = await response.json();

      if (!response.ok) {
        console.error(`API Error (${response.status}):`, result.message);
        return result;
      }

      return result;
    } catch (error) {
      console.error('API Request Error:', error);
      return { success: false, message: error.message };
    }
  },

  /**
   * Track visitor
   * Automatically called on init, but can be called manually
   */
  trackVisitor: async function() {
    if (!this.initialized) return;

    const visitorData = {
      page: window.location.pathname,
      referrer: document.referrer || '',
      userAgent: navigator.userAgent,
      timestamp: new Date().toISOString(),
    };

    const result = await this.request('POST', '/api/track-visitor', visitorData);
    return result;
  },

  /**
   * Submit demo request
   * @param {Object} data - Demo request data
   * @param {string} data.name - Customer name
   * @param {string} data.email - Customer email
   * @param {string} data.phone - Customer phone
   * @param {string} data.company - Company name (optional)
   * @param {string} data.message - Additional message (optional)
   * @param {string} data.requestedDate - Preferred demo date (optional)
   * @returns {Object} Response from API
   */
  submitDemoRequest: async function(data) {
    if (!this.initialized) {
      console.error('HealthOS API: Must call init() first');
      return null;
    }

    if (!data.name || !data.email || !data.phone) {
      return {
        success: false,
        message: 'Name, email, and phone are required',
      };
    }

    return await this.request('POST', '/api/demo-request', data);
  },

  /**
   * Submit contact form
   * @param {Object} data - Contact form data
   * @param {string} data.name - Sender name
   * @param {string} data.email - Sender email
   * @param {string} data.subject - Message subject (optional)
   * @param {string} data.message - Message text
   * @returns {Object} Response from API
   */
  submitContact: async function(data) {
    if (!this.initialized) {
      console.error('HealthOS API: Must call init() first');
      return null;
    }

    if (!data.name || !data.email || !data.message) {
      return {
        success: false,
        message: 'Name, email, and message are required',
      };
    }

    return await this.request('POST', '/api/contact', data);
  },

  /**
   * Get visitor analytics
   * @returns {Object} Analytics data
   */
  getAnalytics: async function() {
    if (!this.initialized) {
      console.error('HealthOS API: Must call init() first');
      return null;
    }

    return await this.request('GET', '/api/analytics/visitors');
  },

  /**
   * Get all demo requests (admin)
   * @returns {Object} Array of demo requests
   */
  getDemoRequests: async function() {
    if (!this.initialized) {
      console.error('HealthOS API: Must call init() first');
      return null;
    }

    return await this.request('GET', '/api/demo-requests');
  },

  /**
   * Health check
   * @returns {Object} Server status
   */
  healthCheck: async function() {
    if (!this.initialized) {
      console.error('HealthOS API: Must call init() first');
      return null;
    }

    return await this.request('GET', '/api/health');
  },
};

// Auto-init if config is provided in data attributes
if (document.currentScript?.dataset.apiUrl) {
  HealthOSAPI.init({
    apiUrl: document.currentScript.dataset.apiUrl,
  });
}

// Export for use in modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = HealthOSAPI;
}
