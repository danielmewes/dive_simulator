/**
 * Dive Simulation UI Controller
 * Handles all interactive controls, real-time updates, and visualizations
 */

class DiveSimulator {
    constructor() {
        // Simulation state
        this.models = {};
        this.enabledModels = {
            buhlmann: true,
            vpmb: true,
            bvm: true,
            vval18: true,
            rgbm: true,
            tbdm: true,
            nmri98: true,
            hills: true
        };
        this.isRunning = false;
        this.timeSpeed = 1; // Speed multiplier
        this.diveHistory = [];
        this.intervalId = null;
        this.lastHistoryTime = 0; // Track when we last recorded history
        
        // Chart instances
        this.tissueChart = null;
        this.detailedTissueChart = null;
        this.profileChart = null;
        this.riskChart = null;
        this.bubbleChart = null;
        
        // Current dive parameters
        this.currentDepth = 0;
        this.diveTime = 0;
        this.currentGasMix = { oxygen: 21, helium: 0 };
        this.vpmConservatism = 2; // Default VPM conservatism level
        
        // BVM settings
        this.bvmConservatism = 3; // Default BVM conservatism level
        this.bvmMaxDcsRisk = 5.0; // Default maximum DCS risk percentage
        
        // Gradient factor settings
        this.buhlmannGradientFactors = { low: 30, high: 85 };
        this.vval18GradientFactors = { low: 30, high: 85 };
        this.rgbmConservatism = 2;
        
        // TBDM settings
        this.tbdmConservatismFactor = 1.0; // Default TBDM conservatism
        
        // NMRI98 settings
        this.nmri98Conservatism = 3; // Default NMRI98 conservatism level
        this.nmri98MaxDcsRisk = 2.0; // Default maximum DCS risk percentage
        this.nmri98SafetyFactor = 1.2; // Default safety factor
        this.nmri98EnableOxygenTracking = true; // Default oxygen tracking enabled
        
        // Hills (Thermodynamic) settings
        this.hillsConservatismFactor = 1.0; // Default Hills conservatism factor
        this.hillsCoreTemperature = 37.0; // Default core temperature (°C)
        this.hillsMetabolicRate = 1.2; // Default metabolic rate (W/kg)
        this.hillsPerfusionMultiplier = 1.0; // Default perfusion multiplier
        
        // Zoom state
        this.zoomMode = 'full'; // 'full' or 'recent'
        
        this.initializeModels();
        this.initializeEventListeners();
        this.syncCheckboxStates(); // Sync checkbox states with enabledModels on page load
        this.initializeCharts();
        this.updateDisplay();
        
        // Initialize zoom controls (set default to full dive view)
        document.getElementById('zoom-full').classList.add('active');
        
        // Record initial data point
        this.recordDiveHistory();
        this.updateCharts();
        
        this.startSimulation();
    }
    
    initializeModels() {
        try {
            this.models = {
                buhlmann: window.DecompressionSimulator.createModel('buhlmann', { 
                    gradientFactorLow: this.buhlmannGradientFactors.low, 
                    gradientFactorHigh: this.buhlmannGradientFactors.high 
                }),
                vpmb: window.DecompressionSimulator.createModel('vpmb', { conservatism: this.vpmConservatism }),
                bvm: window.DecompressionSimulator.createModel('bvm', { 
                    conservatism: this.bvmConservatism, 
                    maxDcsRisk: this.bvmMaxDcsRisk 
                }),
                vval18: window.DecompressionSimulator.createModel('vval18', { 
                    gradientFactorLow: this.vval18GradientFactors.low, 
                    gradientFactorHigh: this.vval18GradientFactors.high 
                }),
                rgbm: window.DecompressionSimulator.createModel('rgbm', {
                    conservatism: this.rgbmConservatism
                }),
                tbdm: window.DecompressionSimulator.createModel('tbdm', { 
                    conservatismFactor: this.tbdmConservatismFactor 
                }),
                nmri98: window.DecompressionSimulator.createModel('nmri98', {
                    conservatism: this.nmri98Conservatism,
                    maxDcsRisk: this.nmri98MaxDcsRisk,
                    safetyFactor: this.nmri98SafetyFactor,
                    enableOxygenTracking: this.nmri98EnableOxygenTracking
                }),
                hills: window.DecompressionSimulator.createModel('hills', {
                    conservatismFactor: this.hillsConservatismFactor,
                    coreTemperature: this.hillsCoreTemperature,
                    metabolicRate: this.hillsMetabolicRate,
                    perfusionMultiplier: this.hillsPerfusionMultiplier
                })
            };
            console.log('✅ Decompression models initialized successfully');
        } catch (error) {
            console.error('❌ Failed to initialize models:', error);
            alert('Failed to initialize decompression models. Please refresh the page.');
        }
    }
    
    initializeEventListeners() {
        // Depth control
        const depthSlider = document.getElementById('depth-slider');
        const descendFastBtn = document.getElementById('descend-fast');
        const ascendSlowBtn = document.getElementById('ascend-slow');
        
        depthSlider.addEventListener('input', (e) => {
            this.setDepth(parseFloat(e.target.value));
        });
        
        descendFastBtn.addEventListener('click', () => {
            this.setDepth(Math.min(60, this.currentDepth + 5));
        });
        
        ascendSlowBtn.addEventListener('click', () => {
            this.setDepth(Math.max(0, this.currentDepth - 3));
        });
        
        // Time speed controls
        document.querySelectorAll('.time-speed').forEach(btn => {
            btn.addEventListener('click', (e) => {
                document.querySelectorAll('.time-speed').forEach(b => b.classList.remove('active'));
                e.target.classList.add('active');
                this.timeSpeed = parseInt(e.target.textContent.replace('x', ''));
                
                // Restart simulation with new timing if currently running
                if (this.isRunning) {
                    this.pauseSimulation();
                    this.startSimulation();
                }
            });
        });
        
        // Pause/Play control
        const pausePlayBtn = document.getElementById('pause-play');
        pausePlayBtn.addEventListener('click', () => {
            if (this.isRunning) {
                this.pauseSimulation();
                pausePlayBtn.textContent = '▶️ Play';
            } else {
                this.startSimulation();
                pausePlayBtn.textContent = '⏸️ Pause';
            }
        });
        
        // Gas mixture controls
        const oxygenInput = document.getElementById('oxygen');
        const heliumInput = document.getElementById('helium');
        const nitrogenInput = document.getElementById('nitrogen');
        const switchGasBtn = document.getElementById('switch-gas');
        
        const updateNitrogen = () => {
            const o2 = parseInt(oxygenInput.value) || 0;
            const he = parseInt(heliumInput.value) || 0;
            const n2 = 100 - o2 - he;
            nitrogenInput.value = Math.max(0, n2);
        };
        
        oxygenInput.addEventListener('input', updateNitrogen);
        heliumInput.addEventListener('input', updateNitrogen);
        
        switchGasBtn.addEventListener('click', () => {
            const o2 = parseInt(oxygenInput.value) || 21;
            const he = parseInt(heliumInput.value) || 0;
            this.switchGas(o2, he);
        });
        
        // Gas preset buttons
        document.querySelectorAll('.gas-preset').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const o2 = parseInt(e.target.dataset.o2);
                const he = parseInt(e.target.dataset.he);
                oxygenInput.value = o2;
                heliumInput.value = he;
                updateNitrogen();
                this.switchGas(o2, he);
            });
        });
        
        // Reset button
        document.getElementById('reset-dive').addEventListener('click', () => {
            this.resetDive();
        });
        
        // Unified model settings controls
        this.setupUnifiedModelSettings();
        
        // Chart tabs
        document.querySelectorAll('.chart-tab').forEach(tab => {
            tab.addEventListener('click', (e) => {
                document.querySelectorAll('.chart-tab').forEach(t => t.classList.remove('active'));
                document.querySelectorAll('.chart').forEach(c => c.classList.remove('active'));
                
                e.target.classList.add('active');
                const chartId = e.target.dataset.chart + '-chart';
                const activeChart = document.getElementById(chartId);
                activeChart.classList.add('active');
                
                // Show/hide model selector for detailed tissue view
                const modelSelector = document.getElementById('detailed-model-selector');
                if (chartId === 'detailed-tissue-chart') {
                    modelSelector.style.display = 'block';
                } else {
                    modelSelector.style.display = 'none';
                }
                
                // Resize the Chart.js instance when it becomes visible
                setTimeout(() => {
                    if (chartId === 'tissue-loading-chart' && this.tissueChart) {
                        this.tissueChart.resize();
                    } else if (chartId === 'detailed-tissue-chart' && this.detailedTissueChart) {
                        this.detailedTissueChart.resize();
                    } else if (chartId === 'dive-profile-chart' && this.profileChart) {
                        this.profileChart.resize();
                    } else if (chartId === 'dcs-risk-chart' && this.riskChart) {
                        this.riskChart.resize();
                    } else if (chartId === 'bubble-parameters-chart' && this.bubbleChart) {
                        this.bubbleChart.resize();
                    }
                }, 100); // Small delay to ensure the visibility transition completes
            });
        });
        
        // Detailed tissue model selector
        document.getElementById('detailed-model-select').addEventListener('change', (e) => {
            this.selectedDetailedModel = e.target.value;
            this.updateDetailedTissueChart();
        });
        
        // Zoom controls
        document.getElementById('zoom-full').addEventListener('click', () => {
            this.setZoomMode('full');
        });
        
        document.getElementById('zoom-recent').addEventListener('click', () => {
            this.setZoomMode('recent');
        });
        
        // Model selection checkboxes
        document.getElementById('model-buhlmann').addEventListener('change', (e) => {
            this.enabledModels.buhlmann = e.target.checked;
            this.updateModelVisibility();
        });
        
        document.getElementById('model-vpmb').addEventListener('change', (e) => {
            this.enabledModels.vpmb = e.target.checked;
            this.updateModelVisibility();
        });
        
        document.getElementById('model-bvm').addEventListener('change', (e) => {
            this.enabledModels.bvm = e.target.checked;
            this.updateModelVisibility();
        });
        
        document.getElementById('model-vval18').addEventListener('change', (e) => {
            this.enabledModels.vval18 = e.target.checked;
            this.updateModelVisibility();
        });
        
        document.getElementById('model-rgbm').addEventListener('change', (e) => {
            this.enabledModels.rgbm = e.target.checked;
            this.updateModelVisibility();
        });
        
        document.getElementById('model-tbdm').addEventListener('change', (e) => {
            this.enabledModels.tbdm = e.target.checked;
            this.updateModelVisibility();
        });
        
        document.getElementById('model-nmri98').addEventListener('change', (e) => {
            this.enabledModels.nmri98 = e.target.checked;
            this.updateModelVisibility();
        });
        
        document.getElementById('model-hills').addEventListener('change', (e) => {
            this.enabledModels.hills = e.target.checked;
            this.updateModelVisibility();
        });
    }
    
    setZoomMode(mode) {
        this.zoomMode = mode;
        
        // Update UI buttons
        document.querySelectorAll('.zoom-btn').forEach(btn => btn.classList.remove('active'));
        if (mode === 'full') {
            document.getElementById('zoom-full').classList.add('active');
        } else if (mode === 'recent') {
            document.getElementById('zoom-recent').classList.add('active');
        }
        
        // Update all charts with new zoom
        this.updateCharts();
        
        console.log(`Chart zoom mode set to: ${mode}`);
    }
    
    getZoomedData() {
        if (this.diveHistory.length === 0) {
            return { history: [], startIndex: 0 };
        }
        
        let targetHistory = [];
        let startIndex = 0;
        
        if (this.zoomMode === 'full') {
            // Show entire dive from t=0
            targetHistory = this.diveHistory;
            startIndex = 0;
        } else if (this.zoomMode === 'recent') {
            // Show last 60 minutes
            const currentTime = this.diveTime;
            const startTime = Math.max(0, currentTime - 60);
            
            // Find the index where we should start showing data
            for (let i = 0; i < this.diveHistory.length; i++) {
                if (this.diveHistory[i].time >= startTime) {
                    startIndex = i;
                    break;
                }
            }
            
            targetHistory = this.diveHistory.slice(startIndex);
        } else {
            targetHistory = this.diveHistory;
        }
        
        // Sub-sample data if there are too many points for performance
        // Keep all data for short dives, but sub-sample longer dives for chart rendering
        const maxDisplayPoints = 500; // Reasonable limit for chart performance
        
        if (targetHistory.length <= maxDisplayPoints) {
            return { history: targetHistory, startIndex: startIndex };
        }
        
        // Sub-sample by taking every nth point, but always include the most recent points
        const subsampleRatio = Math.ceil(targetHistory.length / maxDisplayPoints);
        const subsampledHistory = [];
        
        for (let i = 0; i < targetHistory.length; i += subsampleRatio) {
            subsampledHistory.push(targetHistory[i]);
        }
        
        // Always include the last point if it wasn't included by sub-sampling
        const lastPoint = targetHistory[targetHistory.length - 1];
        const lastSubsampledPoint = subsampledHistory[subsampledHistory.length - 1];
        if (lastSubsampledPoint.time !== lastPoint.time) {
            subsampledHistory.push(lastPoint);
        }
        
        console.log(`Sub-sampled dive history: ${targetHistory.length} points -> ${subsampledHistory.length} points (ratio: ${subsampleRatio})`);
        
        return { history: subsampledHistory, startIndex: startIndex };
    }
    
    updateModelVisibility() {
        // Update decompression status display visibility
        Object.keys(this.enabledModels).forEach(modelName => {
            const resultElement = document.getElementById(`${modelName}-result`);
            if (resultElement) {
                resultElement.style.display = this.enabledModels[modelName] ? 'block' : 'none';
            }
            
            // Update decompression schedule display visibility
            const scheduleElement = document.getElementById(`${modelName}-schedule`);
            if (scheduleElement && scheduleElement.parentElement && scheduleElement.parentElement.classList.contains('schedule-column')) {
                scheduleElement.parentElement.style.display = this.enabledModels[modelName] ? 'block' : 'none';
            }
        });
        
        // Update detailed tissue model selector
        this.updateDetailedModelSelector();
        
        // Update charts to reflect enabled models
        this.updateCharts();
    }
    
    updateDetailedModelSelector() {
        const select = document.getElementById('detailed-model-select');
        if (!select) return;
        
        // Get currently selected value
        const currentValue = select.value;
        
        // Clear existing options
        select.innerHTML = '';
        
        // Add options only for enabled models
        const modelNames = {
            buhlmann: 'Bühlmann ZH-L16C',
            vpmb: 'VPM-B',
            bvm: 'BVM(3)',
            vval18: 'VVal-18 Thalmann',
            rgbm: 'RGBM (folded)',
            tbdm: 'TBDM',
            nmri98: 'NMRI98 LEM',
            hills: 'Thermodynamic (Hills)'
        };
        
        let foundValidOption = false;
        Object.keys(this.enabledModels).forEach(modelName => {
            if (this.enabledModels[modelName]) {
                const option = document.createElement('option');
                option.value = modelName;
                option.textContent = modelNames[modelName];
                select.appendChild(option);
                
                if (modelName === currentValue) {
                    foundValidOption = true;
                    select.value = currentValue;
                }
            }
        });
        
        // If current selection is no longer valid, select the first enabled model
        if (!foundValidOption && select.options.length > 0) {
            select.value = select.options[0].value;
            this.selectedDetailedModel = select.value;
        }
        
        // If no models are enabled, disable the selector
        if (select.options.length === 0) {
            const option = document.createElement('option');
            option.value = '';
            option.textContent = 'No models enabled';
            option.disabled = true;
            select.appendChild(option);
            select.value = '';
            select.disabled = true;
        } else {
            select.disabled = false;
        }
    }
    
    syncCheckboxStates() {
        // Read actual checkbox states and sync with enabledModels object
        // This is important for page refreshes where browsers might remember checkbox states
        Object.keys(this.enabledModels).forEach(modelName => {
            const checkbox = document.getElementById(`model-${modelName}`);
            if (checkbox) {
                this.enabledModels[modelName] = checkbox.checked;
            }
        });
        
        // Apply the synced state to UI elements
        this.updateModelVisibility();
    }
    
    initializeCharts() {
        // Tissue Loading Chart
        const tissueCtx = document.getElementById('tissue-loading-chart').getContext('2d');
        this.tissueChart = new Chart(tissueCtx, {
            type: 'line',
            data: {
                labels: [],
                datasets: [
                    {
                        label: 'Bühlmann - Fast Tissues',
                        data: [],
                        borderColor: '#60a5fa',
                        backgroundColor: 'rgba(96, 165, 250, 0.1)',
                        tension: 0.4
                    },
                    {
                        label: 'Bühlmann - Slow Tissues',
                        data: [],
                        borderColor: '#3b82f6',
                        backgroundColor: 'rgba(59, 130, 246, 0.1)',
                        tension: 0.4
                    },
                    {
                        label: 'VPM-B - Fast Tissues',
                        data: [],
                        borderColor: '#34d399',
                        backgroundColor: 'rgba(52, 211, 153, 0.1)',
                        tension: 0.4
                    },
                    {
                        label: 'VPM-B - Slow Tissues',
                        data: [],
                        borderColor: '#16a34a',
                        backgroundColor: 'rgba(22, 163, 74, 0.1)',
                        tension: 0.4
                    },
                    {
                        label: 'BVM(3) - Fast Tissues',
                        data: [],
                        borderColor: '#f59e0b',
                        backgroundColor: 'rgba(245, 158, 11, 0.1)',
                        tension: 0.4
                    },
                    {
                        label: 'BVM(3) - Slow Tissues',
                        data: [],
                        borderColor: '#d97706',
                        backgroundColor: 'rgba(217, 119, 6, 0.1)',
                        tension: 0.4
                    },
                    {
                        label: 'VVal-18 - Fast Tissues',
                        data: [],
                        borderColor: '#ec4899',
                        backgroundColor: 'rgba(236, 72, 153, 0.1)',
                        tension: 0.4
                    },
                    {
                        label: 'VVal-18 - Slow Tissues',
                        data: [],
                        borderColor: '#be185d',
                        backgroundColor: 'rgba(190, 24, 93, 0.1)',
                        tension: 0.4
                    },
                    {
                        label: 'RGBM - Fast Tissues',
                        data: [],
                        borderColor: '#8b5cf6',
                        backgroundColor: 'rgba(139, 92, 246, 0.1)',
                        tension: 0.4
                    },
                    {
                        label: 'RGBM - Slow Tissues',
                        data: [],
                        borderColor: '#7c3aed',
                        backgroundColor: 'rgba(124, 58, 237, 0.1)',
                        tension: 0.4
                    },
                    {
                        label: 'TBDM - Fast Tissues',
                        data: [],
                        borderColor: '#06b6d4',
                        backgroundColor: 'rgba(6, 182, 212, 0.1)',
                        tension: 0.4
                    },
                    {
                        label: 'TBDM - Slow Tissues',
                        data: [],
                        borderColor: '#0891b2',
                        backgroundColor: 'rgba(8, 145, 178, 0.1)',
                        tension: 0.4
                    },
                    {
                        label: 'NMRI98 - Fast Tissues',
                        data: [],
                        borderColor: '#a855f7',
                        backgroundColor: 'rgba(168, 85, 247, 0.1)',
                        tension: 0.4
                    },
                    {
                        label: 'NMRI98 - Slow Tissues',
                        data: [],
                        borderColor: '#9333ea',
                        backgroundColor: 'rgba(147, 51, 234, 0.1)',
                        tension: 0.4
                    },
                    {
                        label: 'Hills - Fast Tissues',
                        data: [],
                        borderColor: '#06b6d4',
                        backgroundColor: 'rgba(6, 182, 212, 0.1)',
                        tension: 0.4
                    },
                    {
                        label: 'Hills - Slow Tissues',
                        data: [],
                        borderColor: '#0891b2',
                        backgroundColor: 'rgba(8, 145, 178, 0.1)',
                        tension: 0.4
                    },
                    {
                        label: 'Ambient Pressure',
                        data: [],
                        borderColor: '#ffffff',
                        backgroundColor: 'rgba(255, 255, 255, 0.1)',
                        borderDash: [5, 5],
                        tension: 0.1,
                        pointRadius: 0,
                        borderWidth: 2
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                animation: false,
                plugins: {
                    title: {
                        display: true,
                        text: 'Tissue Loading Comparison',
                        color: '#e2e8f0'
                    },
                    legend: {
                        labels: {
                            color: '#e2e8f0',
                            filter: (legendItem, chartData) => {
                                // Hide legend items for disabled datasets
                                const dataset = chartData.datasets[legendItem.datasetIndex];
                                return !dataset.hidden;
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        type: 'linear',
                        title: {
                            display: true,
                            text: 'Time (minutes)',
                            color: '#e2e8f0'
                        },
                        ticks: { color: '#e2e8f0' },
                        grid: { color: 'rgba(226, 232, 240, 0.1)' }
                    },
                    y: {
                        title: {
                            display: true,
                            text: 'Pressure (bar)',
                            color: '#e2e8f0'
                        },
                        ticks: { color: '#e2e8f0' },
                        grid: { color: 'rgba(226, 232, 240, 0.1)' }
                    }
                }
            }
        });
        
        // Dive Profile Chart
        const profileCtx = document.getElementById('dive-profile-chart').getContext('2d');
        this.profileChart = new Chart(profileCtx, {
            type: 'line',
            data: {
                labels: [],
                datasets: [
                    {
                        label: 'Depth',
                        data: [],
                        borderColor: '#60a5fa',
                        backgroundColor: 'rgba(96, 165, 250, 0.2)',
                        fill: true,
                        tension: 0.2,
                        yAxisID: 'depth'
                    },
                    {
                        label: 'Ceiling (Bühlmann)',
                        data: [],
                        borderColor: '#ef4444',
                        backgroundColor: 'rgba(239, 68, 68, 0.1)',
                        borderDash: [5, 5],
                        tension: 0.2,
                        yAxisID: 'depth'
                    },
                    {
                        label: 'Ceiling (VPM-B)',
                        data: [],
                        borderColor: '#f59e0b',
                        backgroundColor: 'rgba(245, 158, 11, 0.1)',
                        borderDash: [3, 3],
                        tension: 0.2,
                        yAxisID: 'depth'
                    },
                    {
                        label: 'Ceiling (BVM-3)',
                        data: [],
                        borderColor: '#8b5cf6',
                        backgroundColor: 'rgba(139, 92, 246, 0.1)',
                        borderDash: [8, 2],
                        tension: 0.2,
                        yAxisID: 'depth'
                    },
                    {
                        label: 'Ceiling (VVAL-18)',
                        data: [],
                        borderColor: '#06d6a0',
                        backgroundColor: 'rgba(6, 214, 160, 0.1)',
                        borderDash: [2, 6],
                        tension: 0.2,
                        yAxisID: 'depth'
                    },
                    {
                        label: 'Ceiling (RGBM)',
                        data: [],
                        borderColor: '#db2777',
                        backgroundColor: 'rgba(219, 39, 119, 0.1)',
                        borderDash: [4, 4],
                        tension: 0.2,
                        yAxisID: 'depth'
                    },
                    {
                        label: 'Ceiling (TBDM)',
                        data: [],
                        borderColor: '#06b6d4',
                        backgroundColor: 'rgba(6, 182, 212, 0.1)',
                        borderDash: [6, 3],
                        tension: 0.2,
                        yAxisID: 'depth'
                    },
                    {
                        label: 'Ceiling (NMRI98)',
                        data: [],
                        borderColor: '#a855f7',
                        backgroundColor: 'rgba(168, 85, 247, 0.1)',
                        borderDash: [10, 5],
                        tension: 0.2,
                        yAxisID: 'depth'
                    },
                    {
                        label: 'Ceiling (Hills)',
                        data: [],
                        borderColor: '#0d9488',
                        backgroundColor: 'rgba(13, 148, 136, 0.1)',
                        borderDash: [8, 4],
                        tension: 0.2,
                        yAxisID: 'depth'
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                animation: false,
                plugins: {
                    title: {
                        display: true,
                        text: 'Dive Profile & Ceilings',
                        color: '#e2e8f0'
                    },
                    legend: {
                        labels: {
                            color: '#e2e8f0',
                            filter: (legendItem, chartData) => {
                                // Hide legend items for disabled datasets
                                const dataset = chartData.datasets[legendItem.datasetIndex];
                                return !dataset.hidden;
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        type: 'linear',
                        title: {
                            display: true,
                            text: 'Time (minutes)',
                            color: '#e2e8f0'
                        },
                        ticks: { color: '#e2e8f0' },
                        grid: { color: 'rgba(226, 232, 240, 0.1)' }
                    },
                    depth: {
                        type: 'linear',
                        position: 'left',
                        reverse: true, // Depth increases downward
                        title: {
                            display: true,
                            text: 'Depth (m)',
                            color: '#e2e8f0'
                        },
                        ticks: { color: '#e2e8f0' },
                        grid: { color: 'rgba(226, 232, 240, 0.1)' }
                    }
                }
            }
        });
        
        // DCS Risk Chart (Timeseries with Dive Profile Overlay)
        const riskCtx = document.getElementById('dcs-risk-chart').getContext('2d');
        this.riskChart = new Chart(riskCtx, {
            type: 'line',
            data: {
                labels: [],
                datasets: [
                    {
                        label: 'Bühlmann Risk (%)',
                        data: [],
                        borderColor: '#60a5fa',
                        backgroundColor: 'rgba(96, 165, 250, 0.1)',
                        tension: 0.3,
                        yAxisID: 'risk'
                    },
                    {
                        label: 'VPM-B Risk (%)',
                        data: [],
                        borderColor: '#34d399',
                        backgroundColor: 'rgba(52, 211, 153, 0.1)',
                        tension: 0.3,
                        yAxisID: 'risk'
                    },
                    {
                        label: 'BVM(3) Risk (%)',
                        data: [],
                        borderColor: '#f59e0b',
                        backgroundColor: 'rgba(245, 158, 11, 0.1)',
                        tension: 0.3,
                        yAxisID: 'risk'
                    },
                    {
                        label: 'VVal-18 Risk (%)',
                        data: [],
                        borderColor: '#ef4444',
                        backgroundColor: 'rgba(239, 68, 68, 0.1)',
                        tension: 0.3,
                        yAxisID: 'risk'
                    },
                    {
                        label: 'RGBM Risk (%)',
                        data: [],
                        borderColor: '#db2777',
                        backgroundColor: 'rgba(219, 39, 119, 0.1)',
                        tension: 0.3,
                        yAxisID: 'risk'
                    },
                    {
                        label: 'TBDM Risk (%)',
                        data: [],
                        borderColor: '#06b6d4',
                        backgroundColor: 'rgba(6, 182, 212, 0.1)',
                        tension: 0.3,
                        yAxisID: 'risk'
                    },
                    {
                        label: 'NMRI98 Risk (%)',
                        data: [],
                        borderColor: '#8b5cf6',
                        backgroundColor: 'rgba(139, 92, 246, 0.1)',
                        tension: 0.3,
                        yAxisID: 'risk'
                    },
                    {
                        label: 'Hills Risk (%)',
                        data: [],
                        borderColor: '#0d9488',
                        backgroundColor: 'rgba(13, 148, 136, 0.1)',
                        tension: 0.3,
                        yAxisID: 'risk'
                    },
                    {
                        label: 'Dive Profile',
                        data: [],
                        borderColor: '#94a3b8',
                        backgroundColor: 'rgba(148, 163, 184, 0.2)',
                        fill: true,
                        tension: 0.2,
                        yAxisID: 'depth',
                        borderDash: [2, 2]
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                animation: false,
                plugins: {
                    title: {
                        display: true,
                        text: 'DCS Risk Over Time with Dive Profile',
                        color: '#e2e8f0'
                    },
                    legend: {
                        labels: {
                            color: '#e2e8f0',
                            filter: (legendItem, chartData) => {
                                // Hide legend items for disabled datasets
                                const dataset = chartData.datasets[legendItem.datasetIndex];
                                return !dataset.hidden;
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        type: 'linear',
                        title: {
                            display: true,
                            text: 'Time (minutes)',
                            color: '#e2e8f0'
                        },
                        ticks: { color: '#e2e8f0' },
                        grid: { color: 'rgba(226, 232, 240, 0.1)' }
                    },
                    risk: {
                        type: 'linear',
                        position: 'left',
                        beginAtZero: true,
                        title: {
                            display: true,
                            text: 'DCS Risk (%)',
                            color: '#e2e8f0'
                        },
                        ticks: { color: '#e2e8f0' },
                        grid: { color: 'rgba(226, 232, 240, 0.1)' }
                    },
                    depth: {
                        type: 'linear',
                        position: 'right',
                        reverse: true, // Depth increases downward
                        beginAtZero: true,
                        title: {
                            display: true,
                            text: 'Depth (m)',
                            color: '#e2e8f0'
                        },
                        ticks: { color: '#e2e8f0' },
                        grid: { display: false } // Hide grid for depth to avoid overlap
                    }
                }
            }
        });
        
        // Detailed Tissue Loading Chart
        const detailedTissueCtx = document.getElementById('detailed-tissue-chart').getContext('2d');
        
        // Generate colors for maximum possible compartments (16 for Bühlmann)
        this.compartmentColors = [
            '#ff4444', '#ff6644', '#ff8844', '#ffaa44',
            '#ffcc44', '#ffee44', '#ddff44', '#bbff44',
            '#99ff44', '#77ff44', '#55ff44', '#33ff44',
            '#44ff77', '#44ff99', '#44ffbb', '#44ffdd'
        ];
        
        // Initialize with empty datasets - will be populated dynamically based on selected model
        this.detailedTissueChart = new Chart(detailedTissueCtx, {
            type: 'line',
            data: {
                labels: [],
                datasets: []
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                animation: false,
                plugins: {
                    title: {
                        display: true,
                        text: 'Detailed Tissue Loading - All Compartments',
                        color: '#e2e8f0'
                    },
                    legend: {
                        display: false // Too many compartments, hide legend
                    }
                },
                scales: {
                    x: {
                        type: 'linear',
                        title: {
                            display: true,
                            text: 'Time (minutes)',
                            color: '#e2e8f0'
                        },
                        ticks: { color: '#e2e8f0' },
                        grid: { color: 'rgba(226, 232, 240, 0.1)' }
                    },
                    y: {
                        title: {
                            display: true,
                            text: 'Pressure (bar)',
                            color: '#e2e8f0'
                        },
                        ticks: { color: '#e2e8f0' },
                        grid: { color: 'rgba(226, 232, 240, 0.1)' }
                    }
                },
                interaction: {
                    mode: 'index',
                    intersect: false
                }
            }
        });
        // Bubble Parameters Chart
        const bubbleCtx = document.getElementById('bubble-parameters-chart').getContext('2d');
        this.bubbleChart = new Chart(bubbleCtx, {
            type: 'line',
            data: {
                labels: [],
                datasets: [
                    {
                        label: 'VPM-B Bubble Count (Comp 1)',
                        data: [],
                        borderColor: '#34d399',
                        backgroundColor: 'rgba(52, 211, 153, 0.1)',
                        tension: 0.4,
                        yAxisID: 'count'
                    },
                    {
                        label: 'VPM-B Critical Radius (nm)',
                        data: [],
                        borderColor: '#10b981',
                        backgroundColor: 'rgba(16, 185, 129, 0.1)',
                        tension: 0.4,
                        borderDash: [3, 3],
                        yAxisID: 'radius'
                    },
                    {
                        label: 'BVM(3) Bubble Volume (Comp 1)',
                        data: [],
                        borderColor: '#f59e0b',
                        backgroundColor: 'rgba(245, 158, 11, 0.1)',
                        tension: 0.4,
                        yAxisID: 'volume'
                    },
                    {
                        label: 'BVM(3) Formation Rate',
                        data: [],
                        borderColor: '#d97706',
                        backgroundColor: 'rgba(217, 119, 6, 0.1)',
                        tension: 0.4,
                        borderDash: [5, 2],
                        yAxisID: 'rate'
                    },
                    {
                        label: 'TBDM Bubble Volume Fraction (Comp 1)',
                        data: [],
                        borderColor: '#8b5cf6',
                        backgroundColor: 'rgba(139, 92, 246, 0.1)',
                        tension: 0.4,
                        yAxisID: 'tbdmVolumeFraction'
                    },
                    {
                        label: 'TBDM Bubble Risk Factor',
                        data: [],
                        borderColor: '#7c3aed',
                        backgroundColor: 'rgba(124, 58, 237, 0.1)',
                        tension: 0.4,
                        borderDash: [4, 2],
                        yAxisID: 'tbdmRisk'
                    },
                    {
                        label: 'Hills Tissue Temperature (°C)',
                        data: [],
                        borderColor: '#ef4444',
                        backgroundColor: 'rgba(239, 68, 68, 0.1)',
                        tension: 0.4,
                        yAxisID: 'hillsTemperature'
                    },
                    {
                        label: 'Hills Dissolution Enthalpy (J/mol)',
                        data: [],
                        borderColor: '#dc2626',
                        backgroundColor: 'rgba(220, 38, 38, 0.1)',
                        tension: 0.4,
                        borderDash: [3, 3],
                        yAxisID: 'hillsEnthalpy'
                    },
                    {
                        label: 'Dive Profile',
                        data: [],
                        borderColor: '#94a3b8',
                        backgroundColor: 'rgba(148, 163, 184, 0.2)',
                        fill: true,
                        tension: 0.2,
                        yAxisID: 'depth',
                        borderDash: [2, 2]
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                animation: false,
                interaction: {
                    mode: 'index',
                    intersect: false,
                },
                plugins: {
                    title: {
                        display: true,
                        text: 'Bubble Model Internal Parameters with Dive Profile',
                        color: '#e2e8f0'
                    },
                    legend: {
                        labels: {
                            color: '#e2e8f0',
                            filter: (legendItem, chartData) => {
                                // Hide legend items for disabled datasets
                                const dataset = chartData.datasets[legendItem.datasetIndex];
                                return !dataset.hidden;
                            }
                        }
                    },
                    tooltip: {
                        mode: 'index',
                        intersect: false,
                    }
                },
                scales: {
                    x: {
                        title: {
                            display: true,
                            text: 'Time (minutes)',
                            color: '#e2e8f0'
                        },
                        ticks: { color: '#e2e8f0' },
                        grid: { color: 'rgba(226, 232, 240, 0.1)' }
                    },
                    count: {
                        type: 'linear',
                        display: true,
                        position: 'left',
                        title: {
                            display: true,
                            text: 'Bubble Count',
                            color: '#e2e8f0'
                        },
                        ticks: { color: '#e2e8f0' },
                        grid: { 
                            color: 'rgba(52, 211, 153, 0.1)',
                            drawOnChartArea: false,
                        }
                    },
                    radius: {
                        type: 'linear',
                        display: false,
                        position: 'left',
                        grid: {
                            drawOnChartArea: false,
                        },
                    },
                    volume: {
                        type: 'linear',
                        display: true,
                        position: 'right',
                        title: {
                            display: true,
                            text: 'Bubble Volume / Formation Rate',
                            color: '#e2e8f0'
                        },
                        ticks: { color: '#e2e8f0' },
                        grid: { 
                            color: 'rgba(245, 158, 11, 0.1)',
                            drawOnChartArea: false,
                        }
                    },
                    rate: {
                        type: 'linear',
                        display: false,
                        position: 'right',
                        grid: {
                            drawOnChartArea: false,
                        },
                    },
                    tbdmVolumeFraction: {
                        type: 'linear',
                        display: true,
                        position: 'left',
                        title: {
                            display: true,
                            text: 'TBDM Bubble Volume Fraction',
                            color: '#e2e8f0'
                        },
                        ticks: { color: '#e2e8f0' },
                        grid: { 
                            color: 'rgba(139, 92, 246, 0.1)',
                            drawOnChartArea: false,
                        },
                        max: 0.05, // TBDM max bubble volume fraction
                        min: 0
                    },
                    tbdmRisk: {
                        type: 'linear',
                        display: false,
                        position: 'left',
                        grid: {
                            drawOnChartArea: false,
                        },
                        max: 1.0, // Risk factor 0-1
                        min: 0
                    },
                    hillsTemperature: {
                        type: 'linear',
                        display: true,
                        position: 'right',
                        title: {
                            display: true,
                            text: 'Hills Temperature (°C) / Enthalpy (J/mol)',
                            color: '#e2e8f0'
                        },
                        ticks: { color: '#e2e8f0' },
                        grid: { 
                            color: 'rgba(239, 68, 68, 0.1)',
                            drawOnChartArea: false,
                        },
                        max: 40, // Reasonable temperature range
                        min: 35
                    },
                    hillsEnthalpy: {
                        type: 'linear',
                        display: false,
                        position: 'right',
                        grid: {
                            drawOnChartArea: false,
                        }
                    },
                    depth: {
                        type: 'linear',
                        position: 'right',
                        reverse: true, // Depth increases downward
                        beginAtZero: true,
                        title: {
                            display: true,
                            text: 'Depth (m)',
                            color: '#e2e8f0'
                        },
                        ticks: { color: '#e2e8f0' },
                        grid: { display: false } // Hide grid for depth to avoid overlap
                    }
                }
            }
        });
        
        // Current selected model for detailed view
        this.selectedDetailedModel = 'buhlmann';
    }
    
    setDepth(newDepth) {
        this.currentDepth = Math.max(0, Math.min(60, newDepth));
        document.getElementById('depth-slider').value = this.currentDepth;
        
        // Update all models
        Object.values(this.models).forEach(model => {
            model.updateDiveState({
                depth: this.currentDepth,
                time: this.diveTime,
                gasMix: window.DecompressionSimulator.createGasMix(
                    this.currentGasMix.oxygen,
                    this.currentGasMix.helium
                )
            });
        });
        
        // Record history immediately when depth changes significantly
        const timeSinceLastHistory = this.diveTime - this.lastHistoryTime;
        if (timeSinceLastHistory >= 0.1) { // Record more frequently on depth changes
            this.recordDiveHistory();
            this.lastHistoryTime = this.diveTime;
        }
        
        this.updateDisplay();
        this.updateCharts();
    }
    
    switchGas(oxygen, helium) {
        this.currentGasMix = { oxygen, helium };
        
        // Update all models
        Object.values(this.models).forEach(model => {
            model.updateDiveState({
                gasMix: window.DecompressionSimulator.createGasMix(oxygen, helium)
            });
        });
        
        this.updateDisplay();
    }
    
    updateVpmConservatism(newConservatism) {
        this.vpmConservatism = newConservatism;
        
        this.updateModelWithNewParameters(
            'vpmb', 
            'vpmb', 
            { conservatism: newConservatism },
            '#vpmb-title',
            `VPM-B+${newConservatism}`
        );
        
        // Also update the schedule title
        document.getElementById('vpmb-schedule-title').textContent = `VPM-B+${newConservatism}`;
        
        console.log(`VPM-B conservatism updated to ${newConservatism}`);
    }
    
    // Helper function to update model with new parameters while preserving state
    updateModelWithNewParameters(modelKey, modelType, options, titleSelector, titleText) {
        const oldModel = this.models[modelKey];
        this.models[modelKey] = window.DecompressionSimulator.createModel(modelType, options);
        
        // Copy current state from old model to new model
        if (oldModel) {
            const currentState = oldModel.getDiveState();
            this.models[modelKey].updateDiveState(currentState);
            
            // Copy tissue loadings if possible
            const oldCompartments = oldModel.getTissueCompartments();
            const newCompartments = this.models[modelKey].getTissueCompartments();
            
            if (oldCompartments && newCompartments && oldCompartments.length === newCompartments.length) {
                for (let i = 0; i < oldCompartments.length; i++) {
                    newCompartments[i].nitrogenLoading = oldCompartments[i].nitrogenLoading;
                    newCompartments[i].heliumLoading = oldCompartments[i].heliumLoading;
                    // Copy any additional properties for specific models
                    if (oldCompartments[i].maxCrushingPressure !== undefined) {
                        newCompartments[i].maxCrushingPressure = oldCompartments[i].maxCrushingPressure;
                    }
                }
            }
        }
        
        // Update title if provided
        if (titleSelector && titleText) {
            const titleElement = document.querySelector(titleSelector);
            if (titleElement) {
                titleElement.textContent = titleText;
            } else {
                console.warn(`Title element not found: ${titleSelector}`);
            }
        }
        
        this.updateDisplay();
        this.updateCharts();
    }
    
    updateBuhlmannGradientFactors(newGfLow, newGfHigh) {
        this.buhlmannGradientFactors = { low: newGfLow, high: newGfHigh };
        
        this.updateModelWithNewParameters(
            'buhlmann', 
            'buhlmann', 
            { gradientFactorLow: newGfLow, gradientFactorHigh: newGfHigh },
            '#buhlmann-result h4',
            `Bühlmann (${newGfLow}/${newGfHigh})`
        );
        
        console.log(`Bühlmann gradient factors updated to ${newGfLow}/${newGfHigh}`);
    }
    
    updateVval18GradientFactors(newGfLow, newGfHigh) {
        this.vval18GradientFactors = { low: newGfLow, high: newGfHigh };
        
        this.updateModelWithNewParameters(
            'vval18', 
            'vval18', 
            { gradientFactorLow: newGfLow, gradientFactorHigh: newGfHigh },
            '#vval18-result h4',
            `VVal-18 (${newGfLow}/${newGfHigh})`
        );
        
        console.log(`VVal-18 gradient factors updated to ${newGfLow}/${newGfHigh}`);
    }
    
    updateBvmConservatism(newConservatism) {
        this.bvmConservatism = newConservatism;
        
        // Update BVM model with new conservatism level
        const currentMaxDcsRisk = this.bvmMaxDcsRisk || 5.0;
        this.updateModelWithNewParameters(
            'bvm', 
            'bvm', 
            { conservatism: newConservatism, maxDcsRisk: currentMaxDcsRisk },
            '#bvm-result h4',
            `BVM(${newConservatism})`
        );
        
        console.log(`BVM conservatism updated to ${newConservatism}`);
    }
    
    updateBvmMaxDcsRisk(newMaxDcsRisk) {
        this.bvmMaxDcsRisk = newMaxDcsRisk;
        
        // Update BVM model with new maximum DCS risk
        const currentConservatism = this.bvmConservatism || 3;
        this.updateModelWithNewParameters(
            'bvm', 
            'bvm', 
            { conservatism: currentConservatism, maxDcsRisk: newMaxDcsRisk },
            '#bvm-result h4',
            `BVM(${currentConservatism})`
        );
        
        console.log(`BVM maximum DCS risk updated to ${newMaxDcsRisk}%`);
    }
    
    updateRgbmConservatism(newConservatism) {
        this.rgbmConservatism = newConservatism;
        
        this.updateModelWithNewParameters(
            'rgbm', 
            'rgbm', 
            { 
                conservatism: newConservatism
            },
            '#rgbm-title',
            `RGBM (folded) - C${newConservatism}`
        );
        
        // Also update the schedule title
        document.getElementById('rgbm-schedule-title').textContent = `RGBM (folded) - C${newConservatism}`;
        
        console.log(`RGBM conservatism updated to ${newConservatism}`);
    }
    
    updateTbdmConservatism(newConservatism) {
        this.tbdmConservatismFactor = newConservatism;
        
        this.updateModelWithNewParameters(
            'tbdm', 
            'tbdm', 
            { conservatismFactor: newConservatism },
            '#tbdm-title',
            `TBDM CF:${newConservatism.toFixed(1)}`
        );
        
        // Also update the schedule title
        document.getElementById('tbdm-schedule-title').textContent = `TBDM CF:${newConservatism.toFixed(1)}`;
        
        console.log(`TBDM conservatism updated to ${newConservatism}`);
    }
    
    updateTbdmBodyTemperature(newTemp) {
        // For now, just log the change - TBDM model would need to be extended for real-time temperature updates
        console.log(`TBDM body temperature updated to ${newTemp}°C (Note: requires model reinitialization)`);
    }
    
    updateNmri98Conservatism(newConservatism) {
        this.nmri98Conservatism = newConservatism;
        
        // Update NMRI98 model with new conservatism level
        this.updateModelWithNewParameters(
            'nmri98', 
            'nmri98', 
            { 
                conservatism: newConservatism, 
                maxDcsRisk: this.nmri98MaxDcsRisk, 
                safetyFactor: this.nmri98SafetyFactor,
                enableOxygenTracking: this.nmri98EnableOxygenTracking
            },
            '#nmri98-result h4',
            `NMRI98 LEM (C:${newConservatism})`
        );
        
        console.log(`NMRI98 conservatism updated to ${newConservatism}`);
    }
    
    updateNmri98MaxDcsRisk(newMaxDcsRisk) {
        this.nmri98MaxDcsRisk = newMaxDcsRisk;
        
        // Update NMRI98 model with new maximum DCS risk
        this.updateModelWithNewParameters(
            'nmri98', 
            'nmri98', 
            { 
                conservatism: this.nmri98Conservatism, 
                maxDcsRisk: newMaxDcsRisk, 
                safetyFactor: this.nmri98SafetyFactor,
                enableOxygenTracking: this.nmri98EnableOxygenTracking
            },
            '#nmri98-result h4',
            `NMRI98 LEM (R:${newMaxDcsRisk}%)`
        );
        
        console.log(`NMRI98 maximum DCS risk updated to ${newMaxDcsRisk}%`);
    }
    
    updateNmri98SafetyFactor(newSafetyFactor) {
        this.nmri98SafetyFactor = newSafetyFactor;
        
        // Update NMRI98 model with new safety factor
        this.updateModelWithNewParameters(
            'nmri98', 
            'nmri98', 
            { 
                conservatism: this.nmri98Conservatism, 
                maxDcsRisk: this.nmri98MaxDcsRisk, 
                safetyFactor: newSafetyFactor,
                enableOxygenTracking: this.nmri98EnableOxygenTracking
            },
            '#nmri98-result h4',
            `NMRI98 LEM (SF:${newSafetyFactor})`
        );
        
        console.log(`NMRI98 safety factor updated to ${newSafetyFactor}`);
    }
    
    updateNmri98OxygenTracking(enableOxygenTracking) {
        this.nmri98EnableOxygenTracking = enableOxygenTracking;
        
        // Update NMRI98 model with new oxygen tracking setting
        this.updateModelWithNewParameters(
            'nmri98', 
            'nmri98', 
            { 
                conservatism: this.nmri98Conservatism, 
                maxDcsRisk: this.nmri98MaxDcsRisk, 
                safetyFactor: this.nmri98SafetyFactor,
                enableOxygenTracking: enableOxygenTracking
            },
            '#nmri98-result h4',
            `NMRI98 LEM (O2:${enableOxygenTracking ? 'ON' : 'OFF'})`
        );
        
        console.log(`NMRI98 oxygen tracking ${enableOxygenTracking ? 'enabled' : 'disabled'}`);
    }
    
    updateHillsConservatismFactor(newConservatismFactor) {
        this.hillsConservatismFactor = newConservatismFactor;
        
        // Update Hills model with new conservatism factor
        this.updateModelWithNewParameters(
            'hills', 
            'hills', 
            { 
                conservatismFactor: newConservatismFactor,
                coreTemperature: this.hillsCoreTemperature,
                metabolicRate: this.hillsMetabolicRate,
                perfusionMultiplier: this.hillsPerfusionMultiplier
            },
            '#hills-result h4',
            `Thermodynamic (Hills) - CF: ${newConservatismFactor.toFixed(1)}`
        );
        
        console.log(`Hills conservatism factor updated to ${newConservatismFactor}`);
    }
    
    updateHillsCoreTemperature(newCoreTemp) {
        this.hillsCoreTemperature = newCoreTemp;
        
        // Update Hills model with new core temperature
        this.updateModelWithNewParameters(
            'hills', 
            'hills', 
            { 
                conservatismFactor: this.hillsConservatismFactor,
                coreTemperature: newCoreTemp,
                metabolicRate: this.hillsMetabolicRate,
                perfusionMultiplier: this.hillsPerfusionMultiplier
            },
            '#hills-result h4',
            `Thermodynamic (Hills) - Temp: ${newCoreTemp.toFixed(1)}°C`
        );
        
        console.log(`Hills core temperature updated to ${newCoreTemp}°C`);
    }
    
    updateHillsMetabolicRate(newMetabolicRate) {
        this.hillsMetabolicRate = newMetabolicRate;
        
        // Update Hills model with new metabolic rate
        this.updateModelWithNewParameters(
            'hills', 
            'hills', 
            { 
                conservatismFactor: this.hillsConservatismFactor,
                coreTemperature: this.hillsCoreTemperature,
                metabolicRate: newMetabolicRate,
                perfusionMultiplier: this.hillsPerfusionMultiplier
            },
            '#hills-result h4',
            `Thermodynamic (Hills) - MR: ${newMetabolicRate.toFixed(1)} W/kg`
        );
        
        console.log(`Hills metabolic rate updated to ${newMetabolicRate} W/kg`);
    }
    
    updateHillsPerfusionMultiplier(newPerfusion) {
        this.hillsPerfusionMultiplier = newPerfusion;
        
        // Update Hills model with new perfusion multiplier
        this.updateModelWithNewParameters(
            'hills', 
            'hills', 
            { 
                conservatismFactor: this.hillsConservatismFactor,
                coreTemperature: this.hillsCoreTemperature,
                metabolicRate: this.hillsMetabolicRate,
                perfusionMultiplier: newPerfusion
            },
            '#hills-result h4',
            `Thermodynamic (Hills) - PF: ${newPerfusion.toFixed(1)}`
        );
        
        console.log(`Hills perfusion multiplier updated to ${newPerfusion}`);
    }
    
    setupUnifiedModelSettings() {
        // Model selector dropdown
        const modelSelector = document.getElementById('model-settings-selector');
        
        // Model settings panels
        const vpmBPanel = document.getElementById('vpmb-settings');
        const buhlmannPanel = document.getElementById('buhlmann-settings');
        const vval18Panel = document.getElementById('vval18-settings');
        const bvmPanel = document.getElementById('bvm-settings');
        const rgbmPanel = document.getElementById('rgbm-settings');
        const tbdmPanel = document.getElementById('tbdm-settings');
        const nmri98Panel = document.getElementById('nmri98-settings');
        const hillsPanel = document.getElementById('hills-settings');
        
        // Function to show/hide model settings panels based on selection
        const showModelSettings = (selectedModel) => {
            // Hide all panels first
            vpmBPanel.style.display = 'none';
            buhlmannPanel.style.display = 'none';
            vval18Panel.style.display = 'none';
            bvmPanel.style.display = 'none';
            rgbmPanel.style.display = 'none';
            tbdmPanel.style.display = 'none';
            nmri98Panel.style.display = 'none';
            hillsPanel.style.display = 'none';
            
            // Show the selected panel
            switch(selectedModel) {
                case 'vpmb':
                    vpmBPanel.style.display = 'block';
                    break;
                case 'buhlmann':
                    buhlmannPanel.style.display = 'block';
                    break;
                case 'bvm':
                    bvmPanel.style.display = 'block';
                    break;
                case 'vval18':
                    vval18Panel.style.display = 'block';
                    break;
                case 'rgbm':
                    rgbmPanel.style.display = 'block';
                    break;
                case 'tbdm':
                    tbdmPanel.style.display = 'block';
                    break;
                case 'nmri98':
                    nmri98Panel.style.display = 'block';
                    break;
                case 'hills':
                    hillsPanel.style.display = 'block';
                    break;
            }
        };
        
        // Model selector change event
        modelSelector.addEventListener('change', (e) => {
            showModelSettings(e.target.value);
        });
        
        // Initialize with first option (VPM-B)
        showModelSettings('vpmb');
        
        // VPM-B controls
        const vpmConservatismSlider = document.getElementById('unified-vpm-conservatism');
        const vpmConservatismDisplay = document.getElementById('unified-vpm-conservatism-display');
        
        vpmConservatismSlider.addEventListener('input', (e) => {
            const newConservatism = parseInt(e.target.value);
            vpmConservatismDisplay.textContent = newConservatism;
            this.updateVpmConservatism(newConservatism);
        });
        
        // Bühlmann gradient factor controls
        const buhlmannGfLowSlider = document.getElementById('unified-buhlmann-gf-low');
        const buhlmannGfLowDisplay = document.getElementById('unified-buhlmann-gf-low-display');
        const buhlmannGfHighSlider = document.getElementById('unified-buhlmann-gf-high');
        const buhlmannGfHighDisplay = document.getElementById('unified-buhlmann-gf-high-display');
        
        buhlmannGfLowSlider.addEventListener('input', (e) => {
            const newGfLow = parseInt(e.target.value);
            buhlmannGfLowDisplay.textContent = newGfLow;
            this.updateBuhlmannGradientFactors(newGfLow, this.buhlmannGradientFactors.high);
        });
        
        buhlmannGfHighSlider.addEventListener('input', (e) => {
            const newGfHigh = parseInt(e.target.value);
            buhlmannGfHighDisplay.textContent = newGfHigh;
            this.updateBuhlmannGradientFactors(this.buhlmannGradientFactors.low, newGfHigh);
        });
        
        // VVal-18 gradient factor controls
        const vval18GfLowSlider = document.getElementById('unified-vval18-gf-low');
        const vval18GfLowDisplay = document.getElementById('unified-vval18-gf-low-display');
        const vval18GfHighSlider = document.getElementById('unified-vval18-gf-high');
        const vval18GfHighDisplay = document.getElementById('unified-vval18-gf-high-display');
        
        vval18GfLowSlider.addEventListener('input', (e) => {
            const newGfLow = parseInt(e.target.value);
            vval18GfLowDisplay.textContent = newGfLow;
            this.updateVval18GradientFactors(newGfLow, this.vval18GradientFactors.high);
        });
        
        vval18GfHighSlider.addEventListener('input', (e) => {
            const newGfHigh = parseInt(e.target.value);
            vval18GfHighDisplay.textContent = newGfHigh;
            this.updateVval18GradientFactors(this.vval18GradientFactors.low, newGfHigh);
        });
        
        // TBDM controls
        const tbdmConservatismSlider = document.getElementById('unified-tbdm-conservatism');
        const tbdmConservatismDisplay = document.getElementById('unified-tbdm-conservatism-display');
        const tbdmBodyTempSlider = document.getElementById('unified-tbdm-body-temp');
        const tbdmBodyTempDisplay = document.getElementById('unified-tbdm-body-temp-display');
        
        tbdmConservatismSlider.addEventListener('input', (e) => {
            const newConservatism = parseFloat(e.target.value);
            tbdmConservatismDisplay.textContent = newConservatism.toFixed(1);
            this.updateTbdmConservatism(newConservatism);
        });
        
        tbdmBodyTempSlider.addEventListener('input', (e) => {
            const newTemp = parseFloat(e.target.value);
            tbdmBodyTempDisplay.textContent = newTemp.toFixed(1);
            this.updateTbdmBodyTemperature(newTemp);
        });
        
        // NMRI98 controls
        const nmri98ConservatismSlider = document.getElementById('unified-nmri98-conservatism');
        const nmri98ConservatismDisplay = document.getElementById('unified-nmri98-conservatism-display');
        const nmri98MaxDcsRiskSlider = document.getElementById('unified-nmri98-max-dcs-risk');
        const nmri98MaxDcsRiskDisplay = document.getElementById('unified-nmri98-max-dcs-risk-display');
        const nmri98SafetyFactorSlider = document.getElementById('unified-nmri98-safety-factor');
        const nmri98SafetyFactorDisplay = document.getElementById('unified-nmri98-safety-factor-display');
        const nmri98OxygenTrackingCheckbox = document.getElementById('unified-nmri98-oxygen-tracking');
        
        nmri98ConservatismSlider.addEventListener('input', (e) => {
            const newConservatism = parseInt(e.target.value);
            nmri98ConservatismDisplay.textContent = newConservatism;
            this.updateNmri98Conservatism(newConservatism);
        });
        
        nmri98MaxDcsRiskSlider.addEventListener('input', (e) => {
            const newMaxDcsRisk = parseFloat(e.target.value);
            nmri98MaxDcsRiskDisplay.textContent = newMaxDcsRisk.toFixed(1);
            this.updateNmri98MaxDcsRisk(newMaxDcsRisk);
        });
        
        nmri98SafetyFactorSlider.addEventListener('input', (e) => {
            const newSafetyFactor = parseFloat(e.target.value);
            nmri98SafetyFactorDisplay.textContent = newSafetyFactor.toFixed(1);
            this.updateNmri98SafetyFactor(newSafetyFactor);
        });
        
        nmri98OxygenTrackingCheckbox.addEventListener('change', (e) => {
            this.updateNmri98OxygenTracking(e.target.checked);
        });
        
        // Hills (Thermodynamic) controls
        const hillsConservatismSlider = document.getElementById('unified-hills-conservatism');
        const hillsConservatismDisplay = document.getElementById('unified-hills-conservatism-display');
        const hillsCoreTempSlider = document.getElementById('unified-hills-core-temp');
        const hillsCoreTempDisplay = document.getElementById('unified-hills-core-temp-display');
        const hillsMetabolicRateSlider = document.getElementById('unified-hills-metabolic-rate');
        const hillsMetabolicRateDisplay = document.getElementById('unified-hills-metabolic-rate-display');
        const hillsPerfusionSlider = document.getElementById('unified-hills-perfusion');
        const hillsPerfusionDisplay = document.getElementById('unified-hills-perfusion-display');

        hillsConservatismSlider.addEventListener('input', (e) => {
            const newConservatismFactor = parseFloat(e.target.value);
            hillsConservatismDisplay.textContent = newConservatismFactor.toFixed(1);
            this.updateHillsConservatismFactor(newConservatismFactor);
        });

        hillsCoreTempSlider.addEventListener('input', (e) => {
            const newCoreTemp = parseFloat(e.target.value);
            hillsCoreTempDisplay.textContent = newCoreTemp.toFixed(1);
            this.updateHillsCoreTemperature(newCoreTemp);
        });

        hillsMetabolicRateSlider.addEventListener('input', (e) => {
            const newMetabolicRate = parseFloat(e.target.value);
            hillsMetabolicRateDisplay.textContent = newMetabolicRate.toFixed(1);
            this.updateHillsMetabolicRate(newMetabolicRate);
        });

        hillsPerfusionSlider.addEventListener('input', (e) => {
            const newPerfusion = parseFloat(e.target.value);
            hillsPerfusionDisplay.textContent = newPerfusion.toFixed(1);
            this.updateHillsPerfusionMultiplier(newPerfusion);
        });
    }
    
    startSimulation() {
        this.isRunning = true;
        // Calculate interval to update every 10 seconds of dive time
        // At 1x: 10000ms (10s wallclock = 10s dive time)
        // At 10x: 1000ms (1s wallclock = 10s dive time)  
        // At 60x: 167ms (0.167s wallclock = 10s dive time)
        // At 600x: 17ms (0.017s wallclock = 10s dive time)
        const intervalMs = Math.max(10000 / this.timeSpeed, 16); // Minimum 16ms for performance
        this.intervalId = setInterval(() => {
            this.updateSimulation();
        }, intervalMs);
    }
    
    pauseSimulation() {
        this.isRunning = false;
        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
        }
    }
    
    resetDive() {
        // Remember if the simulation was running before reset
        const wasRunning = this.isRunning;
        
        this.pauseSimulation();
        this.currentDepth = 0;
        this.diveTime = 0;
        this.diveHistory = [];
        this.lastHistoryTime = 0;
        
        // Reinitialize all models with default parameters
        this.initializeModels();
        
        // Reset controls
        document.getElementById('depth-slider').value = 0;
        document.getElementById('oxygen').value = 21;
        document.getElementById('helium').value = 0;
        document.getElementById('nitrogen').value = 79;
        this.currentGasMix = { oxygen: 21, helium: 0 };
        this.vpmConservatism = 2;
        this.bvmConservatism = 3;
        this.bvmMaxDcsRisk = 5.0;
        this.nmri98Conservatism = 3;
        this.nmri98MaxDcsRisk = 2.0;
        this.nmri98SafetyFactor = 1.2;
        this.nmri98EnableOxygenTracking = true;
        this.hillsConservatismFactor = 1.0;
        this.hillsCoreTemperature = 37.0;
        this.hillsMetabolicRate = 1.2;
        this.hillsPerfusionMultiplier = 1.0;
        
        // Reset unified model settings controls
        document.getElementById('unified-vpm-conservatism').value = 2;
        document.getElementById('unified-vpm-conservatism-display').textContent = '2';
        document.getElementById('unified-buhlmann-gf-low').value = 30;
        document.getElementById('unified-buhlmann-gf-low-display').textContent = '30';
        document.getElementById('unified-buhlmann-gf-high').value = 85;
        document.getElementById('unified-buhlmann-gf-high-display').textContent = '85';
        document.getElementById('unified-vval18-gf-low').value = 30;
        document.getElementById('unified-vval18-gf-low-display').textContent = '30';
        document.getElementById('unified-vval18-gf-high').value = 85;
        document.getElementById('unified-vval18-gf-high-display').textContent = '85';
        document.getElementById('unified-bvm-conservatism').value = 3;
        document.getElementById('unified-bvm-conservatism-display').textContent = '3';
        document.getElementById('unified-bvm-max-dcs-risk').value = 5.0;
        document.getElementById('unified-bvm-max-dcs-risk-display').textContent = '5.0';
        document.getElementById('unified-nmri98-conservatism').value = 3;
        document.getElementById('unified-nmri98-conservatism-display').textContent = '3';
        document.getElementById('unified-nmri98-max-dcs-risk').value = 2.0;
        document.getElementById('unified-nmri98-max-dcs-risk-display').textContent = '2.0';
        document.getElementById('unified-nmri98-safety-factor').value = 1.2;
        document.getElementById('unified-nmri98-safety-factor-display').textContent = '1.2';
        document.getElementById('unified-nmri98-oxygen-tracking').checked = true;
        this.buhlmannGradientFactors = { low: 30, high: 85 };
        this.vval18GradientFactors = { low: 30, high: 85 };
        this.rgbmConservatism = 2;
        
        // Reset RGBM controls
        document.getElementById('unified-rgbm-conservatism').value = 2;
        document.getElementById('unified-rgbm-conservatism-display').textContent = '2';
        
        // Reset TBDM controls
        document.getElementById('unified-tbdm-conservatism').value = 1.0;
        document.getElementById('unified-tbdm-conservatism-display').textContent = '1.0';
        document.getElementById('unified-tbdm-body-temp').value = 37.0;
        document.getElementById('unified-tbdm-body-temp-display').textContent = '37.0';
        
        // Reset Hills controls
        document.getElementById('unified-hills-conservatism').value = 1.0;
        document.getElementById('unified-hills-conservatism-display').textContent = '1.0';
        document.getElementById('unified-hills-core-temp').value = 37.0;
        document.getElementById('unified-hills-core-temp-display').textContent = '37.0';
        document.getElementById('unified-hills-metabolic-rate').value = 1.2;
        document.getElementById('unified-hills-metabolic-rate-display').textContent = '1.2';
        document.getElementById('unified-hills-perfusion').value = 1.0;
        document.getElementById('unified-hills-perfusion-display').textContent = '1.0';
        
        // Reset model titles to default
        document.getElementById('buhlmann-result').querySelector('h4').textContent = 'Bühlmann ZH-L16C';
        document.getElementById('vval18-result').querySelector('h4').textContent = 'VVal-18 Thalmann';
        document.getElementById('vpmb-title').textContent = 'VPM-B+2';
        document.getElementById('vpmb-schedule-title').textContent = 'VPM-B+2';
        document.getElementById('bvm-result').querySelector('h4').textContent = 'BVM(3)';
        document.getElementById('rgbm-title').textContent = 'RGBM (folded)';
        document.getElementById('rgbm-schedule-title').textContent = 'RGBM (folded)';
        document.getElementById('tbdm-title').textContent = 'TBDM CF:1.0';
        document.getElementById('tbdm-schedule-title').textContent = 'TBDM CF:1.0';
        document.getElementById('nmri98-result').querySelector('h4').textContent = 'NMRI98 LEM';
        document.getElementById('hills-title').textContent = 'Thermodynamic (Hills)';
        document.getElementById('hills-schedule-title').textContent = 'Thermodynamic (Hills)';
        
        // Reset zoom to full view
        this.zoomMode = 'full';
        document.querySelectorAll('.zoom-btn').forEach(btn => btn.classList.remove('active'));
        document.getElementById('zoom-full').classList.add('active');
        
        // Clear charts
        this.tissueChart.data.labels = [];
        this.tissueChart.data.datasets.forEach(dataset => dataset.data = []);
        this.tissueChart.update();
        
        this.profileChart.data.labels = [];
        this.profileChart.data.datasets.forEach(dataset => dataset.data = []);
        this.profileChart.update();
        
        this.riskChart.data.labels = [];
        this.riskChart.data.datasets.forEach(dataset => dataset.data = []);
        this.riskChart.update();
        
        // Clear detailed tissue chart
        this.detailedTissueChart.data.labels = [];
        this.detailedTissueChart.data.datasets = []; // Clear all datasets since they will be rebuilt
        this.detailedTissueChart.update();
        
        this.bubbleChart.data.labels = [];
        this.bubbleChart.data.datasets.forEach(dataset => dataset.data = []);
        this.bubbleChart.update();
        
        this.updateDisplay();
        
        // Record initial data point after reset
        setTimeout(() => {
            this.recordDiveHistory();
            this.updateCharts();
        }, 100);
        
        // Only restart simulation if it was running before reset
        if (wasRunning) {
            this.startSimulation();
        } else {
            // Make sure the pause/play button shows the correct state
            const pausePlayBtn = document.getElementById('pause-play');
            pausePlayBtn.textContent = '▶️ Play';
        }
    }
    
    updateSimulation() {
        if (!this.isRunning) return;
        
        // Advance time by exactly 10 seconds (1/6 minute) of dive time per update
        const timeStep = 1/6; // 10 seconds in minutes
        this.diveTime += timeStep;
        
        // Update all models
        Object.values(this.models).forEach(model => {
            model.updateTissueLoadings(timeStep);
            model.updateDiveState({ time: this.diveTime });
        });
        
        // Record history for charts at regular intervals
        // Sample every 30 seconds of dive time (0.5 minutes)
        const timeSinceLastHistory = this.diveTime - this.lastHistoryTime;
        if (timeSinceLastHistory >= 0.5) {
            this.recordDiveHistory();
            this.lastHistoryTime = this.diveTime;
        }
        
        this.updateDisplay();
        this.updateCharts();
    }
    
    recordDiveHistory() {
        const ambientPressure = window.DecompressionSimulator.depthToPressure(this.currentDepth);
        const historyPoint = {
            time: this.diveTime,
            depth: this.currentDepth,
            ambientPressure: ambientPressure,
            gasMix: { ...this.currentGasMix },
            models: {}
        };
        
        Object.entries(this.models).forEach(([name, model]) => {
            try {
                const compartments = model.getTissueCompartments();
                historyPoint.models[name] = {
                    ceiling: model.calculateCeiling(),
                    tissueLoadings: compartments.map(t => 
                        (t.nitrogenLoading || 0) + (t.heliumLoading || 0)
                    ),
                    canAscend: model.canAscendDirectly(),
                    risk: model.calculateDCSRisk ? model.calculateDCSRisk() : 0
                };

                // Add bubble model specific parameters
                if (name === 'vpmb' && typeof model.calculateBubbleCount === 'function') {
                    try {
                        historyPoint.models[name].bubbleCount = model.calculateBubbleCount(1); // First compartment
                        const vpmData = model.getVpmBCompartmentData(1);
                        historyPoint.models[name].criticalRadius = vpmData.adjustedCriticalRadius;
                        historyPoint.models[name].maxCrushingPressure = vpmData.maxCrushingPressure;
                    } catch (vpmError) {
                        console.warn('Error getting VPM-B bubble parameters:', vpmError);
                        historyPoint.models[name].bubbleCount = 0;
                        historyPoint.models[name].criticalRadius = 1000; // Default 1000 nm
                        historyPoint.models[name].maxCrushingPressure = 1.013;
                    }
                }

                if (name === 'bvm' && typeof model.calculateBubbleVolume === 'function') {
                    try {
                        historyPoint.models[name].bubbleVolume = model.calculateBubbleVolume(1); // First compartment
                        const bvmData = model.getBvmCompartmentData(1);
                        historyPoint.models[name].bubbleFormationRate = bvmData.bubbleFormationRate;
                        historyPoint.models[name].bubbleResolutionRate = bvmData.bubbleResolutionRate;
                    } catch (bvmError) {
                        console.warn('Error getting BVM(3) bubble parameters:', bvmError);
                        historyPoint.models[name].bubbleVolume = 0;
                        historyPoint.models[name].bubbleFormationRate = 0;
                        historyPoint.models[name].bubbleResolutionRate = 0;
                    }
                }

                if (name === 'tbdm' && typeof model.getTbdmCompartmentData === 'function') {
                    try {
                        const tbdmData = model.getTbdmCompartmentData(1); // First compartment
                        historyPoint.models[name].bubbleVolumeFraction = tbdmData.bubbleVolumeFraction;
                        historyPoint.models[name].bubbleRisk = model.calculateBubbleRisk();
                        historyPoint.models[name].bubbleNucleationThreshold = tbdmData.bubbleNucleationThreshold;
                        historyPoint.models[name].bubbleEliminationRate = tbdmData.bubbleEliminationRate;
                    } catch (tbdmError) {
                        console.warn('Error getting TBDM bubble parameters:', tbdmError);
                        historyPoint.models[name].bubbleVolumeFraction = 0;
                        historyPoint.models[name].bubbleRisk = 0;
                        historyPoint.models[name].bubbleNucleationThreshold = 2.0;
                        historyPoint.models[name].bubbleEliminationRate = 0.1;
                    }
                }

                if (name === 'hills' && typeof model.getHillsCompartmentData === 'function') {
                    try {
                        const hillsData = model.getHillsCompartmentData(1); // First compartment
                        historyPoint.models[name].tissueTemperature = hillsData.tissueTemperature;
                        historyPoint.models[name].dissolutionEnthalpy = hillsData.dissolutionEnthalpy;
                        historyPoint.models[name].thermalDiffusivity = hillsData.thermalDiffusivity;
                        historyPoint.models[name].heatCapacity = hillsData.heatCapacity;
                    } catch (hillsError) {
                        console.warn('Error getting Hills thermodynamic parameters:', hillsError);
                        historyPoint.models[name].tissueTemperature = 37.0;
                        historyPoint.models[name].dissolutionEnthalpy = 0;
                        historyPoint.models[name].thermalDiffusivity = 0.14e-6;
                        historyPoint.models[name].heatCapacity = 3500;
                    }
                }
            } catch (error) {
                console.warn(`Error recording history for model ${name}:`, error);
                // Provide default values
                historyPoint.models[name] = {
                    ceiling: 0,
                    tissueLoadings: new Array(16).fill(1.013), // Default surface pressure
                    canAscend: true,
                    risk: 0
                };
            }
        });
        
        this.diveHistory.push(historyPoint);
        
        console.log(`Recorded dive history point at ${this.diveTime.toFixed(1)} min, depth ${this.currentDepth}m, total points: ${this.diveHistory.length}`);
    }
    
    updateDisplay() {
        // Update status panel
        document.getElementById('current-depth').textContent = `${this.currentDepth} m`;
        document.getElementById('current-time').textContent = window.DecompressionSimulator.formatTimeHHMM(this.diveTime);
        document.getElementById('current-gas').textContent = `${this.currentGasMix.oxygen}/${this.currentGasMix.helium}`;
        document.getElementById('ambient-pressure').textContent = `${window.DecompressionSimulator.depthToPressure(this.currentDepth).toFixed(1)} bar`;
        document.getElementById('depth-display').textContent = this.currentDepth;
        document.getElementById('time-display').textContent = window.DecompressionSimulator.formatTimeHHMM(this.diveTime);
        
        // Update model results (only for enabled models)
        Object.entries(this.models).forEach(([name, model]) => {
            if (!this.enabledModels[name]) return; // Skip disabled models
            const ceiling = model.calculateCeiling();
            const stops = model.calculateDecompressionStops();
            const canAscend = model.canAscendDirectly();
            
            // Calculate total decompression time
            const totalTime = stops.reduce((sum, stop) => sum + stop.time, 0);
            
            // Update ceiling and TTS
            document.getElementById(`${name}-ceiling`).textContent = `${Math.round(ceiling)}m`;
            document.getElementById(`${name}-tts`).textContent = totalTime > 0 ? `${Math.round(totalTime)} min` : '0 min';
            
            // Update status
            const statusElement = document.getElementById(`${name}-status`);
            if (canAscend) {
                statusElement.textContent = '✅ No Deco';
                statusElement.style.color = '#34d399';
            } else {
                statusElement.textContent = '⚠️ Deco Required';
                statusElement.style.color = '#f59e0b';
            }
            
            // Update decompression schedule
            const scheduleElement = document.getElementById(`${name}-schedule`);
            if (stops.length === 0) {
                scheduleElement.innerHTML = '<div class="no-deco">No decompression required</div>';
            } else {
                scheduleElement.innerHTML = stops.map(stop => 
                    `<div class="deco-stop">
                        <span class="depth">${stop.depth}m</span>
                        <span class="time">${Math.round(stop.time)} min</span>
                    </div>`
                ).join('');
            }
        });
    }
    
    updateCharts() {
        if (this.diveHistory.length === 0) {
            console.log('No dive history available for charts');
            return;
        }
        
        // Get zoomed data based on current zoom mode
        const { history: zoomedHistory } = this.getZoomedData();
        
        if (zoomedHistory.length === 0) {
            console.log('No zoomed history available for charts');
            return;
        }
        
        // Update tissue loading chart
        const timeLabels = zoomedHistory.map(h => Math.round(h.time * 10) / 10); // Round to 1 decimal
        this.tissueChart.data.labels = timeLabels;
        
        // Update dataset visibility and data based on enabled models
        
        // Bühlmann fast tissues (average of first 4 compartments) - Dataset 0
        this.tissueChart.data.datasets[0].hidden = !this.enabledModels.buhlmann;
        this.tissueChart.data.datasets[0].data = zoomedHistory.map(h => {
            if (!h.models.buhlmann || !h.models.buhlmann.tissueLoadings) return 1.013;
            const loadings = h.models.buhlmann.tissueLoadings;
            const fastAvg = loadings.slice(0, 4)
                .reduce((sum, load) => sum + (load || 1.013), 0) / 4;
            return fastAvg;
        });
        
        // Bühlmann slow tissues (average of last 4 compartments) - Dataset 1
        this.tissueChart.data.datasets[1].hidden = !this.enabledModels.buhlmann;
        this.tissueChart.data.datasets[1].data = zoomedHistory.map(h => {
            if (!h.models.buhlmann || !h.models.buhlmann.tissueLoadings) return 1.013;
            const loadings = h.models.buhlmann.tissueLoadings;
            const slowAvg = loadings.slice(-4)
                .reduce((sum, load) => sum + (load || 1.013), 0) / 4;
            return slowAvg;
        });
        
        // VPM-B fast tissues (average of first 4 compartments) - Dataset 2
        this.tissueChart.data.datasets[2].hidden = !this.enabledModels.vpmb;
        this.tissueChart.data.datasets[2].data = zoomedHistory.map(h => {
            if (!h.models.vpmb || !h.models.vpmb.tissueLoadings) return 1.013;
            const loadings = h.models.vpmb.tissueLoadings;
            const fastAvg = loadings.slice(0, 4)
                .reduce((sum, load) => sum + (load || 1.013), 0) / 4;
            return fastAvg;
        });
        
        // VPM-B slow tissues (average of last 4 compartments) - Dataset 3
        this.tissueChart.data.datasets[3].hidden = !this.enabledModels.vpmb;
        this.tissueChart.data.datasets[3].data = zoomedHistory.map(h => {
            if (!h.models.vpmb || !h.models.vpmb.tissueLoadings) return 1.013;
            const loadings = h.models.vpmb.tissueLoadings;
            const slowAvg = loadings.slice(-4)
                .reduce((sum, load) => sum + (load || 1.013), 0) / 4;
            return slowAvg;
        });
        
        // BVM fast tissues (compartment 1 - Fast: 12.5 min) - Dataset 4
        this.tissueChart.data.datasets[4].hidden = !this.enabledModels.bvm;
        this.tissueChart.data.datasets[4].data = zoomedHistory.map(h => {
            if (!h.models.bvm || !h.models.bvm.tissueLoadings || !h.models.bvm.tissueLoadings[0]) {
                return 1.013;
            }
            return h.models.bvm.tissueLoadings[0];
        });
        
        // BVM slow tissues (compartment 3 - Slow: 423 min) - Dataset 5
        this.tissueChart.data.datasets[5].hidden = !this.enabledModels.bvm;
        this.tissueChart.data.datasets[5].data = zoomedHistory.map(h => {
            if (!h.models.bvm || !h.models.bvm.tissueLoadings || !h.models.bvm.tissueLoadings[2]) {
                return 1.013;
            }
            return h.models.bvm.tissueLoadings[2];
        });
        
        // VVal-18 fast tissues (compartment 1 - Fast: 5 min) - Dataset 6
        this.tissueChart.data.datasets[6].hidden = !this.enabledModels.vval18;
        this.tissueChart.data.datasets[6].data = zoomedHistory.map(h => {
            if (!h.models.vval18 || !h.models.vval18.tissueLoadings || !h.models.vval18.tissueLoadings[0]) {
                return 1.013;
            }
            return h.models.vval18.tissueLoadings[0];
        });
        
        // VVal-18 slow tissues (compartment 3 - Slow: 240 min) - Dataset 7
        this.tissueChart.data.datasets[7].hidden = !this.enabledModels.vval18;
        this.tissueChart.data.datasets[7].data = zoomedHistory.map(h => {
            if (!h.models.vval18 || !h.models.vval18.tissueLoadings || !h.models.vval18.tissueLoadings[2]) {
                return 1.013;
            }
            return h.models.vval18.tissueLoadings[2];
        });
        
        // RGBM fast tissues (average of first 4 compartments) - Dataset 8
        this.tissueChart.data.datasets[8].hidden = !this.enabledModels.rgbm;
        this.tissueChart.data.datasets[8].data = zoomedHistory.map(h => {
            if (!h.models.rgbm || !h.models.rgbm.tissueLoadings) return 1.013;
            const loadings = h.models.rgbm.tissueLoadings;
            const fastAvg = loadings.slice(0, 4)
                .reduce((sum, load) => sum + (load || 1.013), 0) / 4;
            return fastAvg;
        });
        
        // RGBM slow tissues (average of last 4 compartments) - Dataset 9
        this.tissueChart.data.datasets[9].hidden = !this.enabledModels.rgbm;
        this.tissueChart.data.datasets[9].data = zoomedHistory.map(h => {
            if (!h.models.rgbm || !h.models.rgbm.tissueLoadings) return 1.013;
            const loadings = h.models.rgbm.tissueLoadings;
            const slowAvg = loadings.slice(-4)
                .reduce((sum, load) => sum + (load || 1.013), 0) / 4;
            return slowAvg;
        });
        
        // TBDM fast tissues (compartment 1 - Fast: 4 min) - Dataset 10
        this.tissueChart.data.datasets[10].hidden = !this.enabledModels.tbdm;
        this.tissueChart.data.datasets[10].data = zoomedHistory.map(h => {
            if (!h.models.tbdm || !h.models.tbdm.tissueLoadings || !h.models.tbdm.tissueLoadings[0]) {
                return 1.013;
            }
            return h.models.tbdm.tissueLoadings[0];
        });
        
        // TBDM slow tissues (compartment 3 - Slow: 240 min) - Dataset 11
        this.tissueChart.data.datasets[11].hidden = !this.enabledModels.tbdm;
        this.tissueChart.data.datasets[11].data = zoomedHistory.map(h => {
            if (!h.models.tbdm || !h.models.tbdm.tissueLoadings || !h.models.tbdm.tissueLoadings[2]) {
                return 1.013;
            }
            return h.models.tbdm.tissueLoadings[2];
        });
        
        // NMRI98 fast tissues (compartment 1 - Fast: 8 min) - Dataset 12
        this.tissueChart.data.datasets[12].hidden = !this.enabledModels.nmri98;
        this.tissueChart.data.datasets[12].data = zoomedHistory.map(h => {
            if (!h.models.nmri98 || !h.models.nmri98.tissueLoadings || !h.models.nmri98.tissueLoadings[0]) {
                return 1.013;
            }
            return h.models.nmri98.tissueLoadings[0];
        });
        
        // NMRI98 slow tissues (compartment 3 - Slow: 120 min) - Dataset 13
        this.tissueChart.data.datasets[13].hidden = !this.enabledModels.nmri98;
        this.tissueChart.data.datasets[13].data = zoomedHistory.map(h => {
            if (!h.models.nmri98 || !h.models.nmri98.tissueLoadings || !h.models.nmri98.tissueLoadings[2]) {
                return 1.013;
            }
            return h.models.nmri98.tissueLoadings[2];
        });
        
        // Hills fast tissues (compartment 1 - Fast: 2.5 min) - Dataset 14
        this.tissueChart.data.datasets[14].hidden = !this.enabledModels.hills;
        this.tissueChart.data.datasets[14].data = zoomedHistory.map(h => {
            if (!h.models.hills || !h.models.hills.tissueLoadings || !h.models.hills.tissueLoadings[0]) {
                return 1.013;
            }
            return h.models.hills.tissueLoadings[0];
        });
        
        // Hills slow tissues (compartment 16 - Slow: 498 min) - Dataset 15
        this.tissueChart.data.datasets[15].hidden = !this.enabledModels.hills;
        this.tissueChart.data.datasets[15].data = zoomedHistory.map(h => {
            if (!h.models.hills || !h.models.hills.tissueLoadings || !h.models.hills.tissueLoadings[15]) {
                return 1.013;
            }
            return h.models.hills.tissueLoadings[15];
        });
        
        // Ambient pressure overlay - Dataset 16
        this.tissueChart.data.datasets[16].data = this.diveHistory.map(h => h.ambientPressure || 1.013);
        
        this.tissueChart.update('default');
        
        // Update dive profile chart
        this.profileChart.data.labels = timeLabels;
        this.profileChart.data.datasets[0].data = zoomedHistory.map(h => h.depth); // Depth profile always visible
        
        // Bühlmann ceiling - Dataset 1
        this.profileChart.data.datasets[1].hidden = !this.enabledModels.buhlmann;
        this.profileChart.data.datasets[1].data = zoomedHistory.map(h => 
            h.models.buhlmann ? h.models.buhlmann.ceiling : 0
        );
        
        // VPM-B ceiling - Dataset 2
        this.profileChart.data.datasets[2].hidden = !this.enabledModels.vpmb;
        this.profileChart.data.datasets[2].data = zoomedHistory.map(h => 
            h.models.vpmb ? h.models.vpmb.ceiling : 0
        );
        
        // BVM ceiling - Dataset 3
        this.profileChart.data.datasets[3].hidden = !this.enabledModels.bvm;
        this.profileChart.data.datasets[3].data = zoomedHistory.map(h => 
            h.models.bvm ? h.models.bvm.ceiling : 0
        );
        
        // VVal-18 ceiling - Dataset 4
        this.profileChart.data.datasets[4].hidden = !this.enabledModels.vval18;
        this.profileChart.data.datasets[4].data = zoomedHistory.map(h => 
            h.models.vval18 ? h.models.vval18.ceiling : 0
        );
        
        // RGBM ceiling - Dataset 5
        this.profileChart.data.datasets[5].hidden = !this.enabledModels.rgbm;
        this.profileChart.data.datasets[5].data = zoomedHistory.map(h => 
            h.models.rgbm ? h.models.rgbm.ceiling : 0
        );
        
        // TBDM ceiling - Dataset 6
        this.profileChart.data.datasets[6].hidden = !this.enabledModels.tbdm;
        this.profileChart.data.datasets[6].data = zoomedHistory.map(h => 
            h.models.tbdm ? h.models.tbdm.ceiling : 0
        );
        
        // NMRI98 ceiling - Dataset 7
        this.profileChart.data.datasets[7].hidden = !this.enabledModels.nmri98;
        this.profileChart.data.datasets[7].data = zoomedHistory.map(h => 
            h.models.nmri98 ? h.models.nmri98.ceiling : 0
        );
        
        // Hills ceiling - Dataset 8
        this.profileChart.data.datasets[8].hidden = !this.enabledModels.hills;
        this.profileChart.data.datasets[8].data = zoomedHistory.map(h => 
            h.models.hills ? h.models.hills.ceiling : 0
        );
        this.profileChart.update('default');
        
        // Update DCS risk chart using model-specific calculations
        this.riskChart.data.labels = timeLabels;
        
        // Bühlmann risk over time - Dataset 0
        this.riskChart.data.datasets[0].hidden = !this.enabledModels.buhlmann;
        this.riskChart.data.datasets[0].data = zoomedHistory.map(h => 
            h.models.buhlmann ? h.models.buhlmann.risk : 0
        );
        
        // VPM-B risk over time - Dataset 1
        this.riskChart.data.datasets[1].hidden = !this.enabledModels.vpmb;
        this.riskChart.data.datasets[1].data = zoomedHistory.map(h => 
            h.models.vpmb ? h.models.vpmb.risk : 0
        );
        
        // BVM(3) risk over time - Dataset 2
        this.riskChart.data.datasets[2].hidden = !this.enabledModels.bvm;
        this.riskChart.data.datasets[2].data = zoomedHistory.map(h => 
            h.models.bvm ? h.models.bvm.risk : 0
        );
        
        // VVal-18 risk over time - Dataset 3
        this.riskChart.data.datasets[3].hidden = !this.enabledModels.vval18;
        this.riskChart.data.datasets[3].data = zoomedHistory.map(h => 
            h.models.vval18 ? h.models.vval18.risk : 0
        );
        
        // RGBM risk over time - Dataset 4
        this.riskChart.data.datasets[4].hidden = !this.enabledModels.rgbm;
        this.riskChart.data.datasets[4].data = zoomedHistory.map(h => 
            h.models.rgbm ? h.models.rgbm.risk : 0
        );
        
        // TBDM risk over time - Dataset 5
        this.riskChart.data.datasets[5].hidden = !this.enabledModels.tbdm;
        this.riskChart.data.datasets[5].data = zoomedHistory.map(h => 
            h.models.tbdm ? h.models.tbdm.risk : 0
        );
        
        // NMRI98 risk over time - Dataset 6
        this.riskChart.data.datasets[6].hidden = !this.enabledModels.nmri98;
        this.riskChart.data.datasets[6].data = zoomedHistory.map(h => 
            h.models.nmri98 ? h.models.nmri98.risk : 0
        );
        
        // Hills risk over time - Dataset 7
        this.riskChart.data.datasets[7].hidden = !this.enabledModels.hills;
        this.riskChart.data.datasets[7].data = zoomedHistory.map(h => 
            h.models.hills ? h.models.hills.risk : 0
        );
        
        // Dive profile overlay - Dataset 8 (always visible)
        this.riskChart.data.datasets[8].data = zoomedHistory.map(h => h.depth);
        
        // Calculate maximum risk value from all enabled models to dynamically adjust y-axis
        let maxRisk = 10; // Default minimum of 10%
        
        // Check each enabled model's risk data
        const riskDatasets = this.riskChart.data.datasets.slice(0, 8); // First 8 datasets are risk data
        for (let i = 0; i < riskDatasets.length; i++) {
            const dataset = riskDatasets[i];
            if (!dataset.hidden && dataset.data.length > 0) {
                const datasetMax = Math.max(...dataset.data);
                if (datasetMax > maxRisk) {
                    maxRisk = datasetMax;
                }
            }
        }
        
        // Add a 10% buffer to the maximum risk for better visualization
        maxRisk = Math.ceil(maxRisk * 1.1);
        
        // Update the chart's y-axis maximum
        this.riskChart.options.scales.risk.max = maxRisk;
        
        this.riskChart.update('default');
        
        // Update detailed tissue chart
        this.updateDetailedTissueChart();
        
        // Update bubble parameters chart (VPM-B, BVM, TBDM, and Hills models have bubble/thermodynamic parameters)
        this.bubbleChart.data.labels = timeLabels;
        
        // VPM-B Bubble Count (Compartment 1) - Dataset 0
        this.bubbleChart.data.datasets[0].hidden = !this.enabledModels.vpmb;
        this.bubbleChart.data.datasets[0].data = zoomedHistory.map(h => 
            h.models.vpmb && h.models.vpmb.bubbleCount !== undefined ? h.models.vpmb.bubbleCount : 0
        );
        
        // VPM-B Critical Radius (nanometers) - Dataset 1
        this.bubbleChart.data.datasets[1].hidden = !this.enabledModels.vpmb;
        this.bubbleChart.data.datasets[1].data = zoomedHistory.map(h => 
            h.models.vpmb && h.models.vpmb.criticalRadius !== undefined ? h.models.vpmb.criticalRadius : 1000
        );
        
        // BVM(3) Bubble Volume (Compartment 1) - Dataset 2
        this.bubbleChart.data.datasets[2].hidden = !this.enabledModels.bvm;
        this.bubbleChart.data.datasets[2].data = zoomedHistory.map(h => 
            h.models.bvm && h.models.bvm.bubbleVolume !== undefined ? h.models.bvm.bubbleVolume : 0
        );
        
        // BVM(3) Formation Rate - Dataset 3
        this.bubbleChart.data.datasets[3].hidden = !this.enabledModels.bvm;
        this.bubbleChart.data.datasets[3].data = zoomedHistory.map(h => 
            h.models.bvm && h.models.bvm.bubbleFormationRate !== undefined ? h.models.bvm.bubbleFormationRate : 0
        );
        
        // TBDM Bubble Volume Fraction (Compartment 1) - Dataset 4
        this.bubbleChart.data.datasets[4].hidden = !this.enabledModels.tbdm;
        this.bubbleChart.data.datasets[4].data = zoomedHistory.map(h => 
            h.models.tbdm && h.models.tbdm.bubbleVolumeFraction !== undefined ? h.models.tbdm.bubbleVolumeFraction : 0
        );
        
        // TBDM Bubble Risk Factor - Dataset 5
        this.bubbleChart.data.datasets[5].hidden = !this.enabledModels.tbdm;
        this.bubbleChart.data.datasets[5].data = zoomedHistory.map(h => 
            h.models.tbdm && h.models.tbdm.bubbleRisk !== undefined ? h.models.tbdm.bubbleRisk : 0
        );
        
        // Hills Tissue Temperature (Compartment 1) - Dataset 6
        this.bubbleChart.data.datasets[6].hidden = !this.enabledModels.hills;
        this.bubbleChart.data.datasets[6].data = zoomedHistory.map(h => 
            h.models.hills && h.models.hills.tissueTemperature !== undefined ? h.models.hills.tissueTemperature : 37
        );
        
        // Hills Dissolution Enthalpy (Compartment 1) - Dataset 7
        this.bubbleChart.data.datasets[7].hidden = !this.enabledModels.hills;
        this.bubbleChart.data.datasets[7].data = zoomedHistory.map(h => 
            h.models.hills && h.models.hills.dissolutionEnthalpy !== undefined ? h.models.hills.dissolutionEnthalpy : 0
        );
        
        // Dive profile overlay - Dataset 8 (always visible)
        this.bubbleChart.data.datasets[8].data = this.diveHistory.map(h => h.depth);
        
        this.bubbleChart.update('default');
        
        console.log(`Updated charts with ${zoomedHistory.length} data points (zoom mode: ${this.zoomMode})`);
    }
    
    updateDetailedTissueChart() {
        if (this.diveHistory.length === 0 || !this.detailedTissueChart) {
            return;
        }
        
        // Get zoomed data for detailed tissue chart
        const { history: zoomedHistory } = this.getZoomedData();
        
        if (zoomedHistory.length === 0) {
            return;
        }
        
        const timeLabels = zoomedHistory.map(h => Math.round(h.time * 10) / 10);
        this.detailedTissueChart.data.labels = timeLabels;
        
        const selectedModel = this.selectedDetailedModel;
        
        // Check if the selected model is enabled
        if (!this.enabledModels[selectedModel]) {
            // Clear the chart if the selected model is disabled
            this.detailedTissueChart.data.datasets = [];
            this.detailedTissueChart.options.plugins.title.text = `Detailed Tissue Loading - Model Disabled`;
            this.detailedTissueChart.update('default');
            return;
        }
        
        // Determine the number of compartments for the selected model
        let compartmentCount = 0;
        if (zoomedHistory.length > 0 && zoomedHistory[0].models[selectedModel]) {
            compartmentCount = zoomedHistory[0].models[selectedModel].tissueLoadings.length;
        }
        
        // If we couldn't determine compartment count from history, use model defaults
        if (compartmentCount === 0) {
            const modelDefaults = {
                buhlmann: 16,
                vpmb: 16,
                bvm: 3,
                vval18: 3,
                rgbm: 16,
                tbdm: 16,
                nmri98: 3,
                hills: 16
            };
            compartmentCount = modelDefaults[selectedModel] || 16;
        }
        
        // Rebuild datasets for the current model's compartment count
        const newDatasets = [];
        
        // Create datasets for each tissue compartment
        for (let i = 0; i < compartmentCount; i++) {
            newDatasets.push({
                label: `Compartment ${i + 1}`,
                data: zoomedHistory.map(h => {
                    if (!h.models[selectedModel] || !h.models[selectedModel].tissueLoadings) {
                        return 1.013;
                    }
                    return h.models[selectedModel].tissueLoadings[i] || 1.013;
                }),
                borderColor: this.compartmentColors[i],
                backgroundColor: this.compartmentColors[i] + '20',
                tension: 0.4,
                pointRadius: 0,
                borderWidth: 1.5
            });
        }
        
        // Add ambient pressure line
        newDatasets.push({
            label: 'Ambient Pressure',
            data: zoomedHistory.map(h => h.ambientPressure || 1.013),
            borderColor: '#ffffff',
            backgroundColor: 'rgba(255, 255, 255, 0.1)',
            borderDash: [5, 5],
            tension: 0.1,
            pointRadius: 0,
            borderWidth: 2
        });
        
        // Replace all datasets
        this.detailedTissueChart.data.datasets = newDatasets;
        
        // Update chart title to show selected model
        const modelNames = {
            buhlmann: 'Bühlmann ZH-L16C',
            vpmb: 'VPM-B',
            bvm: 'BVM(3)',
            vval18: 'VVal-18 Thalmann',
            rgbm: 'RGBM (folded)',
            tbdm: 'TBDM',
            nmri98: 'NMRI98 LEM',
            hills: 'Thermodynamic (Hills)'
        };
        this.detailedTissueChart.options.plugins.title.text = `Detailed Tissue Loading - ${modelNames[selectedModel]} (${compartmentCount} compartments)`;
        
        // Color compartments showing supersaturation differently
        this.updateCompartmentSupersaturationColors(compartmentCount);
        
        this.detailedTissueChart.update('default');
    }
    
    updateCompartmentSupersaturationColors(compartmentCount) {
        if (this.diveHistory.length === 0 || !compartmentCount) return;
        
        const latestHistory = this.diveHistory[this.diveHistory.length - 1];
        const selectedModel = this.selectedDetailedModel;
        const ambientPressure = latestHistory.ambientPressure || 1.013;
        
        // Supersaturated colors (brighter)
        const supersaturatedColors = [
            '#ff0000', '#ff3300', '#ff6600', '#ff9900',
            '#ffcc00', '#ffff00', '#ccff00', '#99ff00',
            '#66ff00', '#33ff00', '#00ff33', '#00ff66',
            '#00ff99', '#00ffcc', '#00ffff', '#00ccff'
        ];
        
        // Check each compartment for supersaturation (only for existing compartments)
        for (let i = 0; i < compartmentCount; i++) {
            if (!this.detailedTissueChart.data.datasets[i]) continue; // Safety check
            
            const compartmentPressure = latestHistory.models[selectedModel]?.tissueLoadings[i] || 1.013;
            const isSupersaturated = compartmentPressure > ambientPressure;
            
            if (isSupersaturated) {
                // Use brighter, more saturated colors for supersaturated compartments
                this.detailedTissueChart.data.datasets[i].borderColor = supersaturatedColors[i];
                this.detailedTissueChart.data.datasets[i].borderWidth = 2.5;
            } else {
                // Use original muted colors for normal compartments
                this.detailedTissueChart.data.datasets[i].borderColor = this.compartmentColors[i];
                this.detailedTissueChart.data.datasets[i].borderWidth = 1.5;
            }
        }
    }
}

// Initialize the simulation when the DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    // Check if DecompressionSimulator is available
    if (typeof window.DecompressionSimulator === 'undefined') {
        console.error('❌ DecompressionSimulator not found. Make sure bundle.js is loaded.');
        alert('Failed to load decompression models. Please refresh the page.');
        return;
    }
    
    console.log('🚀 Starting Dive Simulation...');
    
    try {
        window.diveSimulator = new DiveSimulator();
        console.log('✅ Dive Simulation initialized successfully');
    } catch (error) {
        console.error('❌ Failed to initialize dive simulator:', error);
        alert('Failed to initialize dive simulator: ' + error.message);
    }
});