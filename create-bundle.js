/**
 * Creates a browser-compatible bundle from the compiled CommonJS modules
 */

const fs = require('fs');
const path = require('path');

// Read all the compiled JS files
const distDir = path.join(__dirname, 'dist');
const bundlePath = path.join(distDir, 'bundle.js');

// Helper function to read a module file and extract its content
function readModuleContent(filePath) {
    const content = fs.readFileSync(filePath, 'utf8');
    // Remove CommonJS exports/requires and return the core content
    return content
        .replace(/^"use strict";\s*$/gm, '')
        .replace(/Object\.defineProperty\(exports, "__esModule", \{ value: true \}\);\s*/g, '')
        .replace(/exports\./g, 'window.DecompressionSimulator.')
        .replace(/require\(".*?"\)/g, 'null') // Remove requires - we'll define everything in global scope
        .trim();
}

// Start building the bundle
let bundle = `
/**
 * Decompression Simulator Browser Bundle
 * Educational purposes only - not for actual dive planning
 */

(function(window) {
    'use strict';
    
    // Create global namespace
    window.DecompressionSimulator = window.DecompressionSimulator || {};
    
`;

try {
    // Read and process each model file
    const modelFiles = [
        'models/DecompressionModel.js',
        'models/VpmBModel.js', 
        'models/BuhlmannModel.js',
        'models/BvmModel.js',
        'models/VVal18ThalmannModel.js'
    ];

    for (const file of modelFiles) {
        const filePath = path.join(distDir, file);
        if (fs.existsSync(filePath)) {
            console.log(`Processing ${file}...`);
            const content = fs.readFileSync(filePath, 'utf8');
            
            // Convert CommonJS to browser-compatible code
            let processedContent = content
                .replace(/^"use strict";\s*$/gm, '')
                .replace(/Object\.defineProperty\(exports, "__esModule", \{ value: true \}\);\s*/g, '')
                .replace(/const.*?= require\(".*?"\);?\s*/g, '') // Remove requires
                .replace(/exports\.(\w+)/g, 'window.DecompressionSimulator.$1')
                .replace(/\bexports\b/g, 'window.DecompressionSimulator');
            
            bundle += `\n    // === ${file} ===\n`;
            bundle += `    ${processedContent}\n`;
        }
    }

    bundle += `
    
    // Helper functions for the UI
    window.DecompressionSimulator.createModel = function(type, options) {
        options = options || {};
        
        switch(type.toLowerCase()) {
            case 'buhlmann':
                return new window.DecompressionSimulator.BuhlmannModel(
                    options.gradientFactorLow || 0.3,
                    options.gradientFactorHigh || 0.8
                );
            case 'vpmb':
                return new window.DecompressionSimulator.VpmBModel(
                    options.conservatism || 2
                );
            case 'bvm':
                return new window.DecompressionSimulator.BvmModel(
                    options.conservatism || 2
                );
            case 'vval18':
                return new window.DecompressionSimulator.VVal18ThalmannModel(
                    options.dcsRiskPercent || 2.3
                );
            default:
                throw new Error('Unknown model type: ' + type);
        }
    };
    
    // Utility functions
    window.DecompressionSimulator.createGasMix = function(oxygen, helium) {
        return {
            oxygen: oxygen / 100,
            helium: helium / 100,
            nitrogen: (100 - oxygen - helium) / 100
        };
    };
    
    window.DecompressionSimulator.depthToPressure = function(depth) {
        return 1 + (depth / 10); // 1 bar surface + 1 bar per 10m
    };
    
    window.DecompressionSimulator.formatTime = function(minutes) {
        const hrs = Math.floor(minutes / 60);
        const mins = Math.round(minutes % 60);
        return hrs > 0 ? hrs + ':' + mins.toString().padStart(2, '0') : mins + ' min';
    };

})(window);
`;

    // Write the bundle
    fs.writeFileSync(bundlePath, bundle);
    console.log(`✅ Browser bundle created at: ${bundlePath}`);
    console.log(`Bundle size: ${(fs.statSync(bundlePath).size / 1024).toFixed(1)} KB`);

} catch (error) {
    console.error('❌ Error creating bundle:', error);
    process.exit(1);
}