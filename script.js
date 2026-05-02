const url = "https://script.google.com/macros/s/AKfycbzxW6ws7_0IXkqLIeXO6DVeJGnnKudpSJyZUYk4-Nt2yvR16gtCzpK__0gfCqWfxTke/exec";

let myChart;
let fetchInterval;
let isMonitoring = false;
let isFetching = false;

const FETCH_INTERVAL_MS = 3000;

// ================= INIT =================
window.addEventListener('load', () => {
    initChart();
    loadLogsFromStorage();
    logEvent("SYSTEM READY");
});

// ================= CHART =================
function initChart() {
    const ctx = document.getElementById('myChart').getContext('2d');

    myChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: [],
            datasets: [
                {
                    label: 'Temp',
                    data: [],
                    borderColor: '#ef4444',
                    tension: 0.3
                },
                {
                    label: 'Vib',
                    data: [],
                    borderColor: '#22c55e',
                    tension: 0.3
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false
        }
    });
}

// ================= START =================
function startMonitoring() {
    isMonitoring = true;

    logEvent("MONITORING STARTED");

    fetchDataFromSheets();

    fetchInterval = setInterval(fetchDataFromSheets, FETCH_INTERVAL_MS);
}

// ================= FETCH (FIXED CORE) =================
async function fetchDataFromSheets() {

    if (!isMonitoring || isFetching) return;
    isFetching = true;

    try {

        const res = await fetch(url + "?read=1&t=" + Date.now());
        const text = await res.text();

        console.log("RAW:", text);

        // 🔴 MUST BE JSON NOW
        let data;
        try {
            data = JSON.parse(text);
        } catch (e) {
            logEvent("INVALID JSON: " + text, "error");
            return;
        }

        if (!data.temp && !data.vibration) {
            logEvent("EMPTY DATA", "error");
            return;
        }

        updateDashboard(
            data.temp,
            data.vibration,
            data.status || "OK"
        );

        const sync = document.getElementById("sync-status");
        if (sync) sync.innerText = "Live";

    } catch (err) {

        logEvent("NETWORK ERROR", "error");

        const sync = document.getElementById("sync-status");
        if (sync) sync.innerText = "Offline";

    } finally {
        isFetching = false;
    }
}

// ================= DASHBOARD =================
function updateDashboard(temp, vib, status) {

    const t = parseFloat(temp) || 0;
    const v = parseFloat(vib) || 0;

    document.getElementById("temp-val").innerText = t.toFixed(1);
    document.getElementById("vib-val").innerText = v.toFixed(3);

    const now = new Date().toLocaleTimeString();

    myChart.data.labels.push(now);
    myChart.data.datasets[0].data.push(t);
    myChart.data.datasets[1].data.push(v);

    if (myChart.data.labels.length > 20) {
        myChart.data.labels.shift();
        myChart.data.datasets.forEach(d => d.data.shift());
    }

    myChart.update('none');

    document.getElementById("status-label").innerText = status;
}

// ================= LOGGING =================
function logEvent(msg, type = "") {
    console.log(msg);
}

// ================= STOP =================
function stopMonitoring() {
    isMonitoring = false;
    clearInterval(fetchInterval);

    document.getElementById("status-label").innerText = "STOPPED";
}
