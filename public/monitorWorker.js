self.monitors = [];

self.onmessage = function (event) {
  const { type, monitor } = event.data;

  if (type === "START_MONITOR") {
    // Prevent duplicate intervals
    if (self.monitors.some(m => m.id === monitor.id)) return;

    const intervalId = setInterval(async () => {
      try {
        const response = await fetch(monitor.apiUrl);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);

        const data = await response.json();
        
        self.postMessage({
          type: "UPDATE_DATA",
          monitorId: monitor.id,
          data
        });
      } catch (error) {
        self.postMessage({
          type: "ERROR",
          monitorId: monitor.id,
          error: error.message
        });
      }
    }, monitor.interval * 1000);

    self.monitors.push({ id: monitor.id, intervalId });
  }

  if (type === "STOP_MONITOR") {
    const index = self.monitors.findIndex(m => m.id === monitor.id);
    if (index !== -1) {
      clearInterval(self.monitors[index].intervalId);
      self.monitors.splice(index, 1);
    }
  }
};
