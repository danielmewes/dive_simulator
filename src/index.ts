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

// Export example/demo function
export { runVpmBDemo } from './examples/vpmb-demo';