const fs = require('fs');

// Create a simple test runner
const bundleCode = fs.readFileSync('bundle.js', 'utf8');

// Create a minimal DOM-like environment
global.window = {
  DecompressionSimulator: {}
};

// Execute the bundle
eval(bundleCode);

try {
  console.log('Testing RGBM model creation...');
  
  // Test RGBM model creation
  const rgbmModel = global.window.DecompressionSimulator.createModel('rgbm', {
    conservatism: 3
  });
  
  console.log('✅ RGBM model created successfully');
  console.log('Model name:', rgbmModel.getModelName());
  
  // Test RGBM settings
  const settings = rgbmModel.getRgbmSettings();
  console.log('RGBM settings:', settings);
  
  // Verify no gradient factors in settings
  if (settings.gradientFactorLow !== undefined || settings.gradientFactorHigh !== undefined) {
    throw new Error('❌ RGBM model incorrectly has gradient factors!');
  }
  
  console.log('✅ RGBM model correctly has no gradient factors');
  
  // Test dive simulation
  rgbmModel.updateDiveState(30, 600, { oxygen: 21, helium: 0 }); // 30m for 10 minutes
  
  const ceiling = rgbmModel.calculateCeiling();
  console.log('Ceiling at 30m for 10min:', Math.round(ceiling), 'm');
  
  const risk = rgbmModel.calculateDCSRisk();
  console.log('DCS Risk:', risk, '%');
  
  const bubble = rgbmModel.getTotalBubbleVolume();
  console.log('Bubble volume:', bubble);
  
  console.log('\n🎉 All RGBM tests passed!');
  
} catch (error) {
  console.error('❌ RGBM test failed:', error.message);
  process.exit(1);
}