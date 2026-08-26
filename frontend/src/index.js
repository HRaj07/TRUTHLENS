import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';

// Pre-warm the Render backend as soon as the page loads.
// Render free tier spins down after inactivity and takes ~50s to wake up.
// This silent ping fires immediately so the server is ready by the time
// the user fills out their name and clicks Sign Up.
const BACKEND = process.env.REACT_APP_FASTAPI_URL || 'https://truthlens-1-ypjm.onrender.com';
fetch(`${BACKEND}/api/ready`, { method: 'GET' })
  .then(() => console.log('✅ Backend is awake'))
  .catch(() => console.log('⏳ Backend waking up...'));

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
