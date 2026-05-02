const url = "https://script.google.com/macros/s/AKfycbzxW6ws7_0IXkqLIeXO6DVeJGnnKudpSJyZUYk4-Nt2yvR16gtCzpK__0gfCqWfxTke/exec";

let myChart;
let fetchInterval;
let isFetching = false;

const FETCH_INTERVAL_MS = 3000;

// ================= AUTO START =================
window.addEventListener("load", () => {

    setTimeout(() => {
        initChart();
        startAutoMonitoring();
    }, 300);

});

// ================= AUTO MONITORING =================
function startAutoMonitoring() {

    console.log("AUTO MONITORING STARTED");

    fetchData();

    fetchInterval = setInterval(fetchData, FETCH_INTERVAL_MS);
}

// ================= CHART =================
function initChart() {

    const canvas = document.getElementById("myChart");

    if (!canvas) {
        console.error("Canvas not found");
        return;
    }

    const ctx = canvas.getContext("2d");

    myChart = new Chart(ctx, {
        type: "line",
        data: {
            labels: [],
            datasets: [
                {
                    label: "Temperature",
                    data: [],
                    borderColor: "red",
                    tension: 0.3
                },
                {
                    label: "Vibration (x1000)",
                    data: [],
                    borderColor: "green",
                    tension: 0.3
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false
        }
    });

    console.log("CHART READY");
}

// ================= FETCH LOOP =================
async function fetchData() {

    if (isFetching) return;
    isFetching = true;

    try {

        const res = await fetch(url + "?t=" + Date.now());
        const text = await res.text();

        console.log("RESPONSE:", text);

        // We DON'T rely on response for data (Apps Script = OK only)

        const temp = parseFloat(document.getElementById("temp-val")?.innerText || 0);
        const vib = parseFloat(document.getElementById("vib-val")?.innerText || 0);

        updateChart(temp, vib);

        document.getElementById("sync-status").innerText = "Live";

    } catch (err) {

        console.error(err);

        document.getElementById("sync-status").innerText = "Offline";

    } finally {
        isFetching = false;
    }
}

// ================= UPDATE CHART =================
function updateChart(temp, vib) {

    if (!myChart) return;

    const vibScaled = vib * 1000;
    const time = new Date().toLocaleTimeString();

    myChart.data.labels.push(time);
    myChart.data.datasets[0].data.push(temp);
    myChart.data.datasets[1].data.push(vibScaled);

    if (myChart.data.labels.length > 20) {
        myChart.data.labels.shift();
        myChart.data.datasets.forEach(d => d.data.shift());
    }

    myChart.update("none");
}

// ================= OPTIONAL STOP =================
function stopMonitoring() {

    clearInterval(fetchInterval);

    console.log("MONITORING STOPPED");
}
