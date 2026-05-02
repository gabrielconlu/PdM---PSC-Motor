const url = "https://script.google.com/macros/s/AKfycbzxW6ws7_0IXkqLIeXO6DVeJGnnKudpSJyZUYk4-Nt2yvR16gtCzpK__0gfCqWfxTke/exec";

let myChart;
let fetchInterval;
let isFetching = false;

const FETCH_INTERVAL_MS = 3000;

// ================= AUTO START =================
window.addEventListener("load", () => {
    initChart();
    startAutoFetch();
});

// ================= CHART =================
function initChart() {
    const ctx = document.getElementById("myChart").getContext("2d");

    myChart = new Chart(ctx, {
        type: "line",
        data: {
            labels: [],
            datasets: [
                {
                    label: "Temperature (°C)",
                    data: [],
                    borderColor: "#ef4444",
                    borderWidth: 2,
                    tension: 0.3
                },
                {
                    label: "Vibration (G)",
                    data: [],
                    borderColor: "#22c55e",
                    borderWidth: 2,
                    tension: 0.3
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            animation: false,
            scales: {
                y: { beginAtZero: true },
                x: { display: true }
            }
        }
    });
}

// ================= AUTO FETCH =================
function startAutoFetch() {

    if (fetchInterval) clearInterval(fetchInterval);

    fetchLatestData(); // immediate first fetch

    fetchInterval = setInterval(fetchLatestData, FETCH_INTERVAL_MS);
}

// ================= FETCH DATA =================
async function fetchLatestData() {

    if (isFetching) return;
    isFetching = true;

    try {
        const response = await fetch(url + "?read=true&t=" + Date.now());
        const text = await response.text();

        console.log("RAW:", text);

        // ❌ ignore non-data responses
        if (!text || text.includes("ERROR") || text.includes("MISSING")) {
            updateStatus("ERROR", "#ef4444");
            return;
        }

        // ================= TRY PARSE JSON =================
        let data;

        try {
            data = JSON.parse(text);
        } catch {
            // fallback if Apps Script returns row text
            console.warn("Not JSON, skipping parse");
            return;
        }

        if (!data) return;

        // ================= PARSE VALUES =================
        const temp = parseFloat(data.temp) || 0;
        const vib = parseFloat(data.vibration) || 0;

        // ================= FIX FLOAT DISPLAY =================
        document.getElementById("temp-display").innerText = temp.toFixed(1);
        document.getElementById("vib-display").innerText = vib.toFixed(3);

        updateStatus("LIVE", "#22c55e");

        // ================= UPDATE CHART =================
        const time = new Date().toLocaleTimeString();

        myChart.data.labels.push(time);
        myChart.data.datasets[0].data.push(temp);
        myChart.data.datasets[1].data.push(vib);

        if (myChart.data.labels.length > 20) {
            myChart.data.labels.shift();
            myChart.data.datasets.forEach(d => d.data.shift());
        }

        myChart.update();

        // ================= STATUS =================
        document.getElementById("status-label").innerText =
            data.fpga_action || "NORMAL OPERATION";

        document.getElementById("ai-action-step").innerText =
            "System running with real-time sensor feed.";

    } catch (err) {
        console.error(err);
        updateStatus("OFFLINE", "#ef4444");
    }

    isFetching = false;
}

// ================= STATUS UI =================
function updateStatus(text, color) {
    const el = document.getElementById("sync-status");
    if (!el) return;

    el.innerText = text;
    el.style.color = color;
}
