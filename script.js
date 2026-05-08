const url =
    "https://script.google.com/macros/s/AKfycbzxW6ws7_0IXkqLIeXO6DVeJGnnKudpSJyZUYk4-Nt2yvR16gtCzpK__0gfCqWfxTke/exec";

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

    const ctx =
        document.getElementById("myChart").getContext("2d");

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

    if (fetchInterval)
        clearInterval(fetchInterval);

    fetchLatestData();

    fetchInterval =
        setInterval(fetchLatestData, FETCH_INTERVAL_MS);
}

// ================= FPGA-BASED RULE ENGINE =================
function interpretFPGAStatus(statusText) {

    const faults =
        (statusText || "")
            .toLowerCase()
            .split("|")
            .map(s => s.trim());

    const hasOverheat =
        faults.includes("overheating");

    const hasBearing =
        faults.includes("blocked_bearing");

    // ================= NORMAL =================
    if (!hasOverheat && !hasBearing) {

        return {
            status: "NORMAL OPERATION",
            action:
                "System operating within safe FPGA-predicted limits."
        };
    }

    // ================= CRITICAL COMBINATION =================
    if (hasOverheat && hasBearing) {

        return {
            status: "CRITICAL SYSTEM DEGRADATION (FPGA CONFIRMED)",
            action:
                "Immediate shutdown recommended. FPGA detected simultaneous overheating and bearing blockage indicating possible mechanical seizure."
        };
    }

    // ================= BLOCKED BEARING ONLY =================
    if (hasBearing) {

        return {
            status: "BLOCKED BEARING DETECTED (FPGA)",
            action:
                "FPGA indicates mechanical resistance in rotor. Inspect bearings, lubrication, and shaft alignment. Replace bearing if abnormal torque persists."
        };
    }

    // ================= OVERHEATING ONLY =================
    if (hasOverheat) {

        return {
            status: "OVERHEATING DETECTED (FPGA)",
            action:
                "FPGA detected thermal anomaly. Check cooling system, airflow restriction, and motor load. Prevent sustained operation."
        };
    }

    // ================= FALLBACK =================
    return {
        status: "UNKNOWN FPGA STATE",
        action: "Verify FPGA communication and sensor integrity."
    };
}

// ================= FETCH DATA =================
async function fetchLatestData() {

    if (isFetching) return;
    isFetching = true;

    try {

        const response =
            await fetch(url + "?read=true&t=" + Date.now());

        const text = await response.text();

        if (!text || text.includes("ERROR")) {

            updateStatus("ERROR", "#ef4444");
            isFetching = false;
            return;
        }

        const data = JSON.parse(text);

        const temp =
            parseFloat(data.temp) || 0;

        const vib =
            parseFloat(data.vibration) || 0;

        document.getElementById("temp-display").innerText =
            temp.toFixed(1);

        document.getElementById("vib-display").innerText =
            vib.toFixed(3);

        updateStatus("LIVE", "#22c55e");

        // ================= CHART =================
        const time =
            new Date().toLocaleTimeString();

        myChart.data.labels.push(time);
        myChart.data.datasets[0].data.push(temp);
        myChart.data.datasets[1].data.push(vib);

        if (myChart.data.labels.length > 20) {

            myChart.data.labels.shift();

            myChart.data.datasets.forEach(d =>
                d.data.shift()
            );
        }

        myChart.update();

        // ================= FPGA STATUS =================
        const result =
            interpretFPGAStatus(data.status);

        document.getElementById("status-label").innerText =
            result.status;

        document.getElementById("ai-action-step").innerText =
            result.action;

    } catch (err) {

        console.error(err);
        updateStatus("OFFLINE", "#ef4444");
    }

    isFetching = false;
}

// ================= STATUS UI =================
function updateStatus(text, color) {

    const el =
        document.getElementById("sync-status");

    if (!el) return;

    el.innerText = text;
    el.style.color = color;
}
