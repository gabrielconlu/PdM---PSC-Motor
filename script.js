const url = "https://script.google.com/macros/s/AKfycbzxW6ws7_0IXkqLIeXO6DVeJGnnKudpSJyZUYk4-Nt2yvR16gtCzpK__0gfCqWfxTke/exec";

let myChart;
let fetchInterval;
let isMonitoring = false;

let isFetching = false;
const FETCH_INTERVAL_MS = 3000; // stable sync interval

// ================= INIT =================
window.addEventListener('load', () => {
    initChart();
    loadLogsFromStorage();
    logEvent("SYSTEM READY: Dashboard initialized.");
});

// ================= CHART =================
function initChart() {
    const canvas = document.getElementById('myChart');
    if (!canvas) return;

    const ctx = canvas.getContext('2d');

    myChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: [],
            datasets: [
                {
                    label: 'Temperature (°C)',
                    data: [],
                    borderColor: '#ef4444',
                    backgroundColor: 'rgba(239, 68, 68, 0.1)',
                    borderWidth: 2,
                    tension: 0.3,
                    yAxisID: 'y'
                },
                {
                    label: 'Vibration (G)',
                    data: [],
                    borderColor: '#22c55e',
                    borderWidth: 2,
                    tension: 0.3,
                    yAxisID: 'y1'
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            animation: false, // 🔥 prevents lag + sync issues
            scales: {
                y: {
                    type: 'linear',
                    position: 'left',
                    title: { display: true, text: 'Temp (°C)' },
                    min: 0
                },
                y1: {
                    type: 'linear',
                    position: 'right',
                    title: { display: true, text: 'Vibration (G)' },
                    min: 0
                }
            }
        }
    });
}

// ================= LOG SYSTEM =================
function logEvent(msg, type = "") {
    const entry = {
        time: new Date().toLocaleTimeString(),
        message: msg,
        type: type
    };

    renderLogEntry(entry);
    saveLogToStorage(entry);
}

function renderLogEntry(log) {
    const list = document.getElementById('event-list') || document.getElementById('system-logs');
    if (!list) return;

    const div = document.createElement('div');
    div.className = "log-entry";

    if (log.type === "error") div.style.color = "#ef4444";

    div.innerHTML = `[${log.time}] ${log.message}`;
    list.prepend(div);
}

function saveLogToStorage(log) {
    let logs = JSON.parse(localStorage.getItem('motor_logs')) || [];
    logs.push(log);

    if (logs.length > 50) logs.shift();

    localStorage.setItem('motor_logs', JSON.stringify(logs));
}

function loadLogsFromStorage() {
    let logs = JSON.parse(localStorage.getItem('motor_logs')) || [];
    logs.forEach(renderLogEntry);
}

// ================= START =================
async function startMonitoring() {

    if (fetchInterval) clearInterval(fetchInterval);

    isMonitoring = true;
    toggleButtons(true);

    logEvent("MONITORING STARTED");

    await fetchData(); // immediate fetch

    fetchInterval = setInterval(() => {
        fetchData();
    }, FETCH_INTERVAL_MS);
}

// ================= FETCH (SYNC SAFE) =================
async function fetchData() {

    if (!isMonitoring || isFetching) return;
    isFetching = true;

    try {

        const syncLabel = document.getElementById('sync-status');

        const response = await fetch(`${url}?read=true&t=${Date.now()}`);
        const data = await response.json();

        if (!data || !data.timestamp) {
            throw new Error("Invalid response");
        }

        const temp = parseFloat(data.temp) || 0;
        const vib = parseFloat(data.vibration) || 0;

        const timeDiff = Date.now() - new Date(data.timestamp).getTime();

        // ================= OFFLINE =================
        if (timeDiff > 30000) {

            if (syncLabel) {
                syncLabel.innerText = "Offline";
                syncLabel.style.color = "#fbbf24";
            }

            updateDashboard(0, 0, "OFFLINE", "No Signal");
            return;
        }

        // ================= LIVE =================
        if (syncLabel) {
            syncLabel.innerText = "Live";
            syncLabel.style.color = "#22c55e";
        }

        updateDashboard(
            temp,
            vib,
            "LIVE",
            data.fpga_action || "NORMAL"
        );

    } catch (err) {

        console.log(err);
        logEvent("SYNC ERROR", "error");

        const syncLabel = document.getElementById('sync-status');
        if (syncLabel) {
            syncLabel.innerText = "Error";
            syncLabel.style.color = "#ef4444";
        }

    } finally {
        isFetching = false;
    }
}

// ================= DASHBOARD =================
function updateDashboard(t, v, status, action) {

    const temp = Number(t) || 0;
    const vib = Number(v) || 0;

    document.getElementById('temp-val').innerText =
        status === "OFFLINE" ? "0.0" : temp.toFixed(1);

    document.getElementById('vib-val').innerText =
        status === "OFFLINE" ? "0.00" : vib.toFixed(2);

    // ================= CHART =================
    if (isMonitoring && status !== "OFFLINE") {

        const now = new Date().toLocaleTimeString();

        myChart.data.labels.push(now);
        myChart.data.datasets[0].data.push(temp);
        myChart.data.datasets[1].data.push(vib);

        if (myChart.data.labels.length > 20) {
            myChart.data.labels.shift();
            myChart.data.datasets.forEach(d => d.data.shift());
        }

        myChart.update('none');
    }

    // ================= STATUS =================
    const statusLabel = document.getElementById('status-label');
    const actionBox = document.getElementById('ai-action-step');

    if (statusLabel) {
        statusLabel.innerText = action;
        statusLabel.className = "status-text";
    }

    if (actionBox) {
        actionBox.innerHTML = action;
    }
}

// ================= STOP =================
function stopMonitoring() {

    isMonitoring = false;

    if (fetchInterval) clearInterval(fetchInterval);

    isFetching = false;

    updateDashboard(0, 0, "OFFLINE", "STOPPED");
    logEvent("MONITORING STOPPED");

    toggleButtons(false);
}

// ================= UI =================
function toggleButtons(state) {
    const startBtn = document.getElementById('connect-btn');
    const stopBtn = document.getElementById('disconnect-btn');

    if (startBtn) startBtn.style.display = state ? "none" : "inline-block";
    if (stopBtn) stopBtn.style.display = state ? "inline-block" : "none";
}
