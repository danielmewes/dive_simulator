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
        
        // Chart instances
        this.tissueChart = null;
        this.profileChart = null;
        this.riskChart = null;
        
        // Current dive parameters
        this.currentDepth = 0;
        this.diveTime = 0;
        this.currentGasMix = { oxygen: 21, helium: 0 };
        
        this.initializeModels();
        this.initializeEventListeners();
        this.initializeCharts();
        this.updateDisplay();
        this.startSimulation();
    }
    
    initializeModels() {
        try {
            this.models = {
                buhlmann: window.DecompressionSimulator.createModel('buhlmann'),
                vpmb: window.DecompressionSimulator.createModel('vpmb'),
                bvm: window.DecompressionSimulator.createModel('bvm'),
                vval18: window.DecompressionSimulator.createModel('vval18')
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
        
        // Chart tabs
        document.querySelectorAll('.chart-tab').forEach(tab => {
            tab.addEventListener('click', (e) => {
                document.querySelectorAll('.chart-tab').forEach(t => t.classList.remove('active'));
                document.querySelectorAll('.chart').forEach(c => c.classList.remove('active'));
                
                e.target.classList.add('active');
                const chartId = e.target.dataset.chart + '-chart';
                document.getElementById(chartId).classList.add('active');
            });
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
                        label: 'VPM-B - Average',
                        data: [],
                        borderColor: '#34d399',
                        backgroundColor: 'rgba(52, 211, 153, 0.1)',
                        tension: 0.4
                    },
                    {
                        label: 'BVM(3) - Fast',
                        data: [],
                        borderColor: '#f59e0b',
                        backgroundColor: 'rgba(245, 158, 11, 0.1)',
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
        
        // DCS Risk Chart
        const riskCtx = document.getElementById('dcs-risk-chart').getContext('2d');
        this.riskChart = new Chart(riskCtx, {
            type: 'bar',
            data: {
                labels: ['Bühlmann', 'VPM-B', 'BVM(3)', 'VVal-18'],
                datasets: [
                    {
                        label: 'DCS Risk (%)',
                        data: [0, 0, 0, 0],
                        backgroundColor: [
                            'rgba(96, 165, 250, 0.8)',
                            'rgba(52, 211, 153, 0.8)',
                            'rgba(245, 158, 11, 0.8)',
                            'rgba(239, 68, 68, 0.8)'
                        ],
                        borderColor: [
                            '#60a5fa',
                            '#34d399',
                            '#f59e0b',
                            '#ef4444'
                        ],
                        borderWidth: 2
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    title: {
                        display: true,
                        text: 'DCS Risk Comparison',
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
                        ticks: { color: '#e2e8f0' },
                        grid: { color: 'rgba(226, 232, 240, 0.1)' }
                    },
                    y: {
                        beginAtZero: true,
                        max: 10,
                        title: {
                            display: true,
                            text: 'Risk (%)',
                            color: '#e2e8f0'
                        },
                        ticks: { color: '#e2e8f0' },
                        grid: { color: 'rgba(226, 232, 240, 0.1)' }
                    }
                }
            }
        });
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
        
        this.updateDisplay();
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
        
        // Reset all models
        Object.values(this.models).forEach(model => {
            model.resetToSurface();
        });
        
        // Reset controls
        document.getElementById('depth-slider').value = 0;
        document.getElementById('oxygen').value = 21;
        document.getElementById('helium').value = 0;
        document.getElementById('nitrogen').value = 79;
        this.currentGasMix = { oxygen: 21, helium: 0 };
        
        // Clear charts
        this.tissueChart.data.labels = [];
        this.tissueChart.data.datasets.forEach(dataset => dataset.data = []);
        this.tissueChart.update();
        
        this.profileChart.data.labels = [];
        this.profileChart.data.datasets.forEach(dataset => dataset.data = []);
        this.profileChart.update();
        
        this.updateDisplay();
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
        
        // Record history for charts (sample every 30 seconds at 1x speed)
        if (Math.floor(this.diveTime * 60) % 30 === 0) {
            this.recordDiveHistory();
        }
        
        this.updateDisplay();
        this.updateCharts();
    }
    
    recordDiveHistory() {
        const historyPoint = {
            time: this.diveTime,
            depth: this.currentDepth,
            gasMix: { ...this.currentGasMix },
            models: {}
        };
        
        Object.entries(this.models).forEach(([name, model]) => {
            historyPoint.models[name] = {
                ceiling: model.calculateCeiling(),
                tissueLoadings: model.getTissueCompartments().map(t => 
                    t.nitrogenLoading + (t.heliumLoading || 0)
                ),
                canAscend: model.canAscendDirectly()
            };
        });
        
        this.diveHistory.push(historyPoint);
        
        // Keep only last 100 points for performance
        if (this.diveHistory.length > 100) {
            this.diveHistory.shift();
        }
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
        if (this.diveHistory.length < 2) return;
        
        // Update tissue loading chart
        const timeLabels = this.diveHistory.map(h => Math.round(h.time));
        this.tissueChart.data.labels = timeLabels;
        
        // Bühlmann fast tissues (average of first 4 compartments)
        this.tissueChart.data.datasets[0].data = this.diveHistory.map(h => {
            const fastAvg = h.models.buhlmann.tissueLoadings.slice(0, 4)
                .reduce((sum, load) => sum + load, 0) / 4;
            return fastAvg;
        });
        
        // Bühlmann slow tissues (average of last 4 compartments)
        this.tissueChart.data.datasets[1].data = this.diveHistory.map(h => {
            const slowAvg = h.models.buhlmann.tissueLoadings.slice(-4)
                .reduce((sum, load) => sum + load, 0) / 4;
            return slowAvg;
        });
        
        // VPM-B average (all compartments)
        this.tissueChart.data.datasets[2].data = this.diveHistory.map(h => {
            const avg = h.models.vpmb.tissueLoadings
                .reduce((sum, load) => sum + load, 0) / h.models.vpmb.tissueLoadings.length;
            return avg;
        });
        
        // BVM fast compartment
        this.tissueChart.data.datasets[3].data = this.diveHistory.map(h => {
            return h.models.bvm.tissueLoadings[0] || 0;
        });
        
        this.tissueChart.update('none');
        
        // Update dive profile chart
        this.profileChart.data.labels = timeLabels;
        this.profileChart.data.datasets[0].data = this.diveHistory.map(h => h.depth);
        this.profileChart.data.datasets[1].data = this.diveHistory.map(h => h.models.buhlmann.ceiling);
        this.profileChart.data.datasets[2].data = this.diveHistory.map(h => h.models.vpmb.ceiling);
        this.profileChart.update('none');
        
        // Update DCS risk chart
        const currentRisks = [
            this.calculateDCSRisk('buhlmann'),
            this.calculateDCSRisk('vpmb'),
            this.calculateDCSRisk('bvm'),
            this.calculateDCSRisk('vval18')
        ];
        
        this.riskChart.data.datasets[0].data = currentRisks;
        this.riskChart.update('none');
    }
    
    calculateDCSRisk(modelName) {
        const model = this.models[modelName];
        if (!model) return 0;
        
        // Simplified DCS risk calculation based on tissue supersaturation
        const compartments = model.getTissueCompartments();
        let totalSupersaturation = 0;
        
        compartments.forEach(compartment => {
            const totalInert = compartment.nitrogenLoading + (compartment.heliumLoading || 0);
            const ambientPressure = window.DecompressionSimulator.depthToPressure(this.currentDepth);
            const supersaturation = Math.max(0, totalInert - ambientPressure);
            totalSupersaturation += supersaturation;
        });
        
        // Convert to percentage (simplified formula)
        const risk = Math.min(10, totalSupersaturation * 2);
        return Math.round(risk * 10) / 10; // Round to 1 decimal place
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