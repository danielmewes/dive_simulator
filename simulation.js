/**
 * Dive Simulation UI Controller
 * Handles all interactive controls, real-time updates, and visualizations
 */

class DiveSimulator {
    constructor() {
        // Simulation state
        this.models = {};
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
        
        // Gradient factor settings
        this.buhlmannGradientFactors = { low: 30, high: 85 };
        this.vval18GradientFactors = { low: 30, high: 85 };
        
        this.initializeModels();
        this.initializeEventListeners();
        this.initializeCharts();
        this.updateDisplay();
        
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
                bvm: window.DecompressionSimulator.createModel('bvm'),
                vval18: window.DecompressionSimulator.createModel('vval18', { 
                    gradientFactorLow: this.vval18GradientFactors.low, 
                    gradientFactorHigh: this.vval18GradientFactors.high 
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
        
        // VPM conservatism control
        const vpmConservatismSlider = document.getElementById('vpm-conservatism');
        const vpmConservatismDisplay = document.getElementById('vpm-conservatism-display');
        
        vpmConservatismSlider.addEventListener('input', (e) => {
            const newConservatism = parseInt(e.target.value);
            vpmConservatismDisplay.textContent = newConservatism;
            this.updateVpmConservatism(newConservatism);
        });
        
        // Bühlmann gradient factor controls
        const buhlmannGfLowSlider = document.getElementById('buhlmann-gf-low');
        const buhlmannGfLowDisplay = document.getElementById('buhlmann-gf-low-display');
        const buhlmannGfHighSlider = document.getElementById('buhlmann-gf-high');
        const buhlmannGfHighDisplay = document.getElementById('buhlmann-gf-high-display');
        
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
        const vval18GfLowSlider = document.getElementById('vval18-gf-low');
        const vval18GfLowDisplay = document.getElementById('vval18-gf-low-display');
        const vval18GfHighSlider = document.getElementById('vval18-gf-high');
        const vval18GfHighDisplay = document.getElementById('vval18-gf-high-display');
        
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
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    title: {
                        display: true,
                        text: 'Tissue Loading Comparison',
                        color: '#e2e8f0'
                    },
                    legend: {
                        labels: {
                            color: '#e2e8f0'
                        }
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
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    title: {
                        display: true,
                        text: 'Dive Profile & Ceilings',
                        color: '#e2e8f0'
                    },
                    legend: {
                        labels: {
                            color: '#e2e8f0'
                        }
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
                plugins: {
                    title: {
                        display: true,
                        text: 'DCS Risk Over Time with Dive Profile',
                        color: '#e2e8f0'
                    },
                    legend: {
                        labels: {
                            color: '#e2e8f0'
                        }
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
                    risk: {
                        type: 'linear',
                        position: 'left',
                        beginAtZero: true,
                        max: 10,
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
                            color: '#e2e8f0'
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
    
    startSimulation() {
        this.isRunning = true;
        this.intervalId = setInterval(() => {
            this.updateSimulation();
        }, 1000); // Update every second
    }
    
    pauseSimulation() {
        this.isRunning = false;
        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
        }
    }
    
    resetDive() {
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
        document.getElementById('vpm-conservatism').value = 2;
        document.getElementById('vpm-conservatism-display').textContent = '2';
        this.currentGasMix = { oxygen: 21, helium: 0 };
        this.vpmConservatism = 2;
        
        // Reset gradient factor controls
        document.getElementById('buhlmann-gf-low').value = 30;
        document.getElementById('buhlmann-gf-low-display').textContent = '30';
        document.getElementById('buhlmann-gf-high').value = 85;
        document.getElementById('buhlmann-gf-high-display').textContent = '85';
        document.getElementById('vval18-gf-low').value = 30;
        document.getElementById('vval18-gf-low-display').textContent = '30';
        document.getElementById('vval18-gf-high').value = 85;
        document.getElementById('vval18-gf-high-display').textContent = '85';
        this.buhlmannGradientFactors = { low: 30, high: 85 };
        this.vval18GradientFactors = { low: 30, high: 85 };
        
        // Reset model titles to default
        document.getElementById('buhlmann-result').querySelector('h4').textContent = 'Bühlmann ZH-L16C';
        document.getElementById('vval18-result').querySelector('h4').textContent = 'VVal-18 Thalmann';
        document.getElementById('vpmb-title').textContent = 'VPM-B+2';
        document.getElementById('vpmb-schedule-title').textContent = 'VPM-B+2';
        
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
        
        this.startSimulation();
    }
    
    updateSimulation() {
        if (!this.isRunning) return;
        
        // Advance time based on speed multiplier
        const timeStep = this.timeSpeed / 60; // Convert to minutes
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
        
        // Keep only last 100 points for performance
        if (this.diveHistory.length > 100) {
            this.diveHistory.shift();
        }
        
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
        
        // Update model results
        Object.entries(this.models).forEach(([name, model]) => {
            const ceiling = model.calculateCeiling();
            const stops = model.calculateDecompressionStops();
            const canAscend = model.canAscendDirectly();
            
            // Calculate total decompression time
            const totalTime = stops.reduce((sum, stop) => sum + stop.time, 0);
            
            // Update ceiling and TTS
            document.getElementById(`${name}-ceiling`).textContent = `${ceiling}m`;
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
        
        // Update tissue loading chart
        const timeLabels = this.diveHistory.map(h => Math.round(h.time * 10) / 10); // Round to 1 decimal
        this.tissueChart.data.labels = timeLabels;
        
        // Bühlmann fast tissues (average of first 4 compartments)
        this.tissueChart.data.datasets[0].data = this.diveHistory.map(h => {
            if (!h.models.buhlmann || !h.models.buhlmann.tissueLoadings) return 1.013;
            const loadings = h.models.buhlmann.tissueLoadings;
            const fastAvg = loadings.slice(0, 4)
                .reduce((sum, load) => sum + (load || 1.013), 0) / 4;
            return fastAvg;
        });
        
        // Bühlmann slow tissues (average of last 4 compartments)
        this.tissueChart.data.datasets[1].data = this.diveHistory.map(h => {
            if (!h.models.buhlmann || !h.models.buhlmann.tissueLoadings) return 1.013;
            const loadings = h.models.buhlmann.tissueLoadings;
            const slowAvg = loadings.slice(-4)
                .reduce((sum, load) => sum + (load || 1.013), 0) / 4;
            return slowAvg;
        });
        
        // VPM-B fast tissues (average of first 4 compartments)
        this.tissueChart.data.datasets[2].data = this.diveHistory.map(h => {
            if (!h.models.vpmb || !h.models.vpmb.tissueLoadings) return 1.013;
            const loadings = h.models.vpmb.tissueLoadings;
            const fastAvg = loadings.slice(0, 4)
                .reduce((sum, load) => sum + (load || 1.013), 0) / 4;
            return fastAvg;
        });
        
        // VPM-B slow tissues (average of last 4 compartments)
        this.tissueChart.data.datasets[3].data = this.diveHistory.map(h => {
            if (!h.models.vpmb || !h.models.vpmb.tissueLoadings) return 1.013;
            const loadings = h.models.vpmb.tissueLoadings;
            const slowAvg = loadings.slice(-4)
                .reduce((sum, load) => sum + (load || 1.013), 0) / 4;
            return slowAvg;
        });
        
        // BVM fast tissues (compartment 1 - Fast: 12.5 min)
        this.tissueChart.data.datasets[4].data = this.diveHistory.map(h => {
            if (!h.models.bvm || !h.models.bvm.tissueLoadings || !h.models.bvm.tissueLoadings[0]) {
                return 1.013;
            }
            return h.models.bvm.tissueLoadings[0];
        });
        
        // BVM slow tissues (compartment 3 - Slow: 423 min)
        this.tissueChart.data.datasets[5].data = this.diveHistory.map(h => {
            if (!h.models.bvm || !h.models.bvm.tissueLoadings || !h.models.bvm.tissueLoadings[2]) {
                return 1.013;
            }
            return h.models.bvm.tissueLoadings[2];
        });
        
        // VVal-18 fast tissues (compartment 1 - Fast: 5 min)
        this.tissueChart.data.datasets[6].data = this.diveHistory.map(h => {
            if (!h.models.vval18 || !h.models.vval18.tissueLoadings || !h.models.vval18.tissueLoadings[0]) {
                return 1.013;
            }
            return h.models.vval18.tissueLoadings[0];
        });
        
        // VVal-18 slow tissues (compartment 3 - Slow: 240 min)
        this.tissueChart.data.datasets[7].data = this.diveHistory.map(h => {
            if (!h.models.vval18 || !h.models.vval18.tissueLoadings || !h.models.vval18.tissueLoadings[2]) {
                return 1.013;
            }
            return h.models.vval18.tissueLoadings[2];
        });
        
        this.tissueChart.update('none');
        
        // Update dive profile chart
        this.profileChart.data.labels = timeLabels;
        this.profileChart.data.datasets[0].data = this.diveHistory.map(h => h.depth);
        this.profileChart.data.datasets[1].data = this.diveHistory.map(h => 
            h.models.buhlmann ? h.models.buhlmann.ceiling : 0
        );
        this.profileChart.data.datasets[2].data = this.diveHistory.map(h => 
            h.models.vpmb ? h.models.vpmb.ceiling : 0
        );
        this.profileChart.data.datasets[3].data = this.diveHistory.map(h => 
            h.models.bvm ? h.models.bvm.ceiling : 0
        );
        this.profileChart.data.datasets[4].data = this.diveHistory.map(h => 
            h.models.vval18 ? h.models.vval18.ceiling : 0
        );
        this.profileChart.update('none');
        
        // Update DCS risk chart using model-specific calculations
        this.riskChart.data.labels = timeLabels;
        
        // Bühlmann risk over time
        this.riskChart.data.datasets[0].data = this.diveHistory.map(h => 
            h.models.buhlmann ? h.models.buhlmann.risk : 0
        );
        
        // VPM-B risk over time
        this.riskChart.data.datasets[1].data = this.diveHistory.map(h => 
            h.models.vpmb ? h.models.vpmb.risk : 0
        );
        
        // BVM(3) risk over time
        this.riskChart.data.datasets[2].data = this.diveHistory.map(h => 
            h.models.bvm ? h.models.bvm.risk : 0
        );
        
        // VVal-18 risk over time
        this.riskChart.data.datasets[3].data = this.diveHistory.map(h => 
            h.models.vval18 ? h.models.vval18.risk : 0
        );
        
        // Dive profile overlay
        this.riskChart.data.datasets[4].data = this.diveHistory.map(h => h.depth);
        
        this.riskChart.update('none');
        
        // Update detailed tissue chart
        this.updateDetailedTissueChart();
        
        // Update bubble parameters chart
        this.bubbleChart.data.labels = timeLabels;
        
        // VPM-B Bubble Count (Compartment 1)
        this.bubbleChart.data.datasets[0].data = this.diveHistory.map(h => 
            h.models.vpmb && h.models.vpmb.bubbleCount !== undefined ? h.models.vpmb.bubbleCount : 0
        );
        
        // VPM-B Critical Radius (nanometers)
        this.bubbleChart.data.datasets[1].data = this.diveHistory.map(h => 
            h.models.vpmb && h.models.vpmb.criticalRadius !== undefined ? h.models.vpmb.criticalRadius : 1000
        );
        
        // BVM(3) Bubble Volume (Compartment 1)
        this.bubbleChart.data.datasets[2].data = this.diveHistory.map(h => 
            h.models.bvm && h.models.bvm.bubbleVolume !== undefined ? h.models.bvm.bubbleVolume : 0
        );
        
        // BVM(3) Formation Rate
        this.bubbleChart.data.datasets[3].data = this.diveHistory.map(h => 
            h.models.bvm && h.models.bvm.bubbleFormationRate !== undefined ? h.models.bvm.bubbleFormationRate : 0
        );
        
        // Dive profile overlay
        this.bubbleChart.data.datasets[4].data = this.diveHistory.map(h => h.depth);
        
        this.bubbleChart.update('none');
        
        console.log(`Updated charts with ${this.diveHistory.length} data points`);
    }
    
    updateDetailedTissueChart() {
        if (this.diveHistory.length === 0 || !this.detailedTissueChart) {
            return;
        }
        
        const timeLabels = this.diveHistory.map(h => Math.round(h.time * 10) / 10);
        this.detailedTissueChart.data.labels = timeLabels;
        
        const selectedModel = this.selectedDetailedModel;
        
        // Determine the number of compartments for the selected model
        let compartmentCount = 0;
        if (this.diveHistory.length > 0 && this.diveHistory[0].models[selectedModel]) {
            compartmentCount = this.diveHistory[0].models[selectedModel].tissueLoadings.length;
        }
        
        // If we couldn't determine compartment count from history, use model defaults
        if (compartmentCount === 0) {
            const modelDefaults = {
                buhlmann: 16,
                vpmb: 16,
                bvm: 3,
                vval18: 3
            };
            compartmentCount = modelDefaults[selectedModel] || 16;
        }
        
        // Rebuild datasets for the current model's compartment count
        const newDatasets = [];
        
        // Create datasets for each tissue compartment
        for (let i = 0; i < compartmentCount; i++) {
            newDatasets.push({
                label: `Compartment ${i + 1}`,
                data: this.diveHistory.map(h => {
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
            data: this.diveHistory.map(h => h.ambientPressure || 1.013),
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
            vval18: 'VVal-18 Thalmann'
        };
        this.detailedTissueChart.options.plugins.title.text = `Detailed Tissue Loading - ${modelNames[selectedModel]} (${compartmentCount} compartments)`;
        
        // Color compartments showing supersaturation differently
        this.updateCompartmentSupersaturationColors(compartmentCount);
        
        this.detailedTissueChart.update('none');
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