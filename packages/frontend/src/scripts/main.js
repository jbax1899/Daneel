// scripts/main.js
const Header = require('../components/Header');

// Initialize the app
document.addEventListener('DOMContentLoaded', () => {
    // Any JavaScript functionality can go here
    console.log('Daneel frontend initialized');
    
    // Inject the header
    const app = document.getElementById('app');
    if (app) {
        app.insertAdjacentHTML('afterbegin', Header());
    }
});