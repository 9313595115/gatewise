// API Configuration
const config = {
    API_URL: window.location.hostname === 'localhost' 
        ? 'http://localhost:5001'
        : 'https://your-render-service-url'
};

// Export the config
window.APP_CONFIG = config; 