let ws;
const maxDataPoints = 30;
const timeLabels = [];
const cpuData = [];
const ramData = [];
const tempData = [];
let systemChart;

document.addEventListener('DOMContentLoaded', function() {
  const ctx = document.getElementById('systemChart').getContext('2d');
  systemChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: timeLabels,
      datasets: [
        {
          label: 'CPU %',
          data: cpuData,
          borderColor: 'rgb(42, 82, 152)',
          backgroundColor: 'rgba(42, 82, 152, 0.1)',
          tension: 0.4,
          fill: true
        },
        {
          label: 'RAM %',
          data: ramData,
          borderColor: 'rgb(40, 167, 69)',
          backgroundColor: 'rgba(40, 167, 69, 0.1)',
          tension: 0.4,
          fill: true
        },
        {
          label: 'Temp °C',
          data: tempData,
          borderColor: 'rgb(220, 53, 69)',
          backgroundColor: 'rgba(220, 53, 69, 0.1)',
          tension: 0.4,
          fill: true,
          yAxisID: 'y1'
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: { position: 'top' },
        title: { display: true, text: 'System Performance Over Time' }
      },
      scales: {
        y: {
          type: 'linear',
          display: true,
          position: 'left',
          title: { display: true, text: 'CPU & RAM (%)' },
          min: 0,
          max: 100
        },
        y1: {
          type: 'linear',
          display: true,
          position: 'right',
          title: { display: true, text: 'Temperature (°C)' },
          grid: { drawOnChartArea: false },
          min: 0,
          max: 100
        }
      }
    }
  });

  connectWebSocket();
});

function connectWebSocket() {
  const wsStatus = document.getElementById('wsStatus');
  const wsText = document.getElementById('wsText');

  ws = new WebSocket(WS_URL);

  ws.onopen = () => {
    console.log('WebSocket connected');
    wsStatus.className = 'status-badge bg-success bg-opacity-10';
    wsText.innerHTML = '<span class="status-dot bg-success"></span>Connected';
  };

  ws.onmessage = (event) => {
    const data = JSON.parse(event.data);

    if (data.cpu !== undefined) {
      const temp = parseFloat(data.temperature);
      const cpu = parseFloat(data.cpu);
      const ram = parseFloat(data.ram);

      document.getElementById('temp').textContent = (isFinite(temp) ? temp : 0) + '°C';
      document.getElementById('cpu').textContent  = (isFinite(cpu)  ? cpu  : 0) + '%';
      document.getElementById('ram').textContent  = (isFinite(ram)  ? ram  : 0) + '%';
      document.getElementById('processes').textContent = data.processes ?? '--';

      const time = new Date().toLocaleTimeString();
      timeLabels.push(time);
      cpuData.push(isFinite(cpu) ? cpu : 0);
      ramData.push(isFinite(ram) ? ram : 0);
      tempData.push(isFinite(temp) ? temp : 0);

      if (timeLabels.length > maxDataPoints) {
        timeLabels.shift();
        cpuData.shift();
        ramData.shift();
        tempData.shift();
      }
      systemChart.update();
    }

    if (data.type === 'user_count') {
      document.getElementById('userCount').textContent = data.count;
    }

    if (data.type === 'connection') {
      console.log('Connected as user:', data.userId);
      document.getElementById('userCount').textContent = data.userCount;
    }
  };

  setInterval(() => {
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'ping', timestamp: Date.now() }));
    }
  }, 20000);

  ws.onerror = (error) => {
    console.error('WebSocket error:', error);
    wsStatus.className = 'status-badge bg-danger bg-opacity-10';
    wsText.innerHTML   = '<span class="status-dot bg-danger"></span>Connection error';
  };

  ws.onclose = () => {
    console.log('WebSocket closed, reconnecting in 5s...');
    wsStatus.className = 'status-badge bg-warning bg-opacity-10';
    wsText.innerHTML   = '<span class="status-dot bg-warning"></span>Reconnecting...';
    setTimeout(connectWebSocket, 5000);
  };
}
