const express = require('express');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 3000;

// Serve static files from root
app.use(express.static(__dirname));

// Serve static files from specific directories
app.use('/css', express.static(path.join(__dirname, 'css')));
app.use('/js', express.static(path.join(__dirname, 'js')));
app.use('/assets', express.static(path.join(__dirname, 'assets')));
app.use('/node_modules', express.static(path.join(__dirname, 'node_modules')));

// Main route
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Health check
app.get('/health', (req, res) => {
    res.json({
        status: 'ok',
        message: 'SAGE ChatApp server is running',
        timestamp: new Date().toISOString()
    });
});

// Error handling
app.use((err, req, res, next) => {
    console.error('Server error:', err);
    res.status(500).json({
        error: 'Internal server error',
        message: err.message
    });
});

// // Start server
// app.listen(PORT, () => {
//     console.log(`✅ SAGE ChatApp server running on http://localhost:${PORT}`);
//     console.log(`🔗 Open http://localhost:${PORT} in your browser`);
//     console.log(`📊 Health check: http://localhost:${PORT}/health`);
// });


module.exports = app;