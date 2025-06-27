/**
 * Scuba Diving Decompression Simulator
 * Main exports for the decompression model library
 */

// Export base classes and interfaces
export { 
  DecompressionModel, 
  type GasMix, 
  type TissueCompartment, 
  type DiveState, 
  type DecompressionStop 
} from './models/DecompressionModel';

// Export VPM-B implementation
export { VpmBModel } from './models/VpmBModel';

// Export Buhlmann implementation
export { BuhlmannModel } from './models/BuhlmannModel';

// Export example/demo functions
export { runVpmBDemo } from './examples/vpmb-demo';
export { runBuhlmannDemo } from './examples/buhlmann-demo';