import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { toast, Toaster } from "react-hot-toast";
import { FaPlay, FaStop, FaPlus, FaTrash, FaClock, FaLink } from "react-icons/fa";
import "./App.css";

let monitorWorker;
if (window.Worker) {
  monitorWorker = new Worker("/monitorWorker.js");
}

function App() {
  const [monitors, setMonitors] = useState([]);
  const [selectedMonitor, setSelectedMonitor] = useState(null);

  useEffect(() => {
    const savedMonitors = localStorage.getItem("apiMonitors");
    if (savedMonitors) {
      setMonitors(JSON.parse(savedMonitors));
    }
  }, []);

  useEffect(() => {
    localStorage.setItem("apiMonitors", JSON.stringify(monitors));
  }, [monitors]);

  useEffect(() => {
    if (!monitorWorker) return;

    monitorWorker.onmessage = (event) => {
      const { type, monitorId, data, error } = event.data;

      if (type === "UPDATE_DATA") {
        updateMonitor(monitorId, { previousData: data });
        toast.success(`Update received for ${monitorId}`);
      }

      if (type === "ERROR") {
        toast.error(`Error in ${monitorId}: ${error}`);
      }
    };

    return () => {
      monitorWorker.terminate();
    };
  }, []);

  const addNewMonitor = () => {
    const newMonitor = {
      id: Date.now().toString(),
      name: `Monitor ${monitors.length + 1}`,
      apiUrl: "",
      filterId: "",
      interval: 30,
      isRunning: false,
      previousData: null,
      differences: null,
    };
    setMonitors([...monitors, newMonitor]);
    setSelectedMonitor(newMonitor.id);
  };

  const updateMonitor = (id, updates) => {
    setMonitors((prev) =>
      prev.map((monitor) => (monitor.id === id ? { ...monitor, ...updates } : monitor))
    );
  };

  const deleteMonitor = (id) => {
    monitorWorker?.postMessage({ type: "STOP_MONITOR", monitor: { id } });
    setMonitors((prev) => prev.filter((m) => m.id !== id));
    if (selectedMonitor === id) setSelectedMonitor(null);
  };

  const toggleMonitor = (monitor) => {
    if (!monitorWorker) return;

    if (!monitor.isRunning) {
      monitorWorker.postMessage({ type: "START_MONITOR", monitor });
      updateMonitor(monitor.id, { isRunning: true });
    } else {
      monitorWorker.postMessage({ type: "STOP_MONITOR", monitor });
      updateMonitor(monitor.id, { isRunning: false });
    }
  };

  const selectedMonitorData = monitors.find((m) => m.id === selectedMonitor);

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 to-gray-800 text-white p-8">
      <Toaster position="top-right" />

      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="max-w-6xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-4xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-purple-500">
            API Monitor
          </h1>
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={addNewMonitor}
            className="px-4 py-2 bg-blue-500 rounded-lg flex items-center space-x-2 hover:bg-blue-600 transition-colors"
          >
            <FaPlus /> <span>Add Monitor</span>
          </motion.button>
        </div>

        <div className="grid grid-cols-12 gap-6">
          <div className="col-span-3 bg-gray-800 rounded-xl p-4 h-[calc(100vh-12rem)] overflow-y-auto">
            <h2 className="text-xl font-semibold mb-4">Monitors</h2>
            <div className="space-y-2">
              <AnimatePresence>
                {monitors.map((monitor) => (
                  <motion.div
                    key={monitor.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    className={`p-3 rounded-lg cursor-pointer transition-colors ${
                      selectedMonitor === monitor.id ? "bg-blue-500" : "bg-gray-700 hover:bg-gray-600"
                    }`}
                    onClick={() => setSelectedMonitor(monitor.id)}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-medium">{monitor.name}</span>
                      {monitor.isRunning && <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />}
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          </div>

          <div className="col-span-9">
            {selectedMonitorData ? (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="bg-gray-800 rounded-xl p-8 shadow-2xl">
                <div className="flex justify-between items-center mb-6">
                  <input
                    type="text"
                    value={selectedMonitorData.name}
                    onChange={(e) => updateMonitor(selectedMonitorData.id, { name: e.target.value })}
                    className="text-2xl font-bold bg-transparent border-none focus:outline-none"
                  />
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => deleteMonitor(selectedMonitorData.id)}
                    className="p-2 text-red-400 hover:text-red-300 transition-colors"
                  >
                    <FaTrash />
                  </motion.button>
                </div>

                <div className="space-y-6">
                  <label className="block text-sm font-medium mb-2">API URL</label>
                  <input
                    type="text"
                    value={selectedMonitorData.apiUrl}
                    onChange={(e) => updateMonitor(selectedMonitorData.id, { apiUrl: e.target.value })}
                    className="w-full bg-gray-700 rounded-lg p-3 focus:ring-2 focus:ring-blue-500"
                    placeholder="https://api.example.com/endpoint"
                  />

                  <motion.button
                    onClick={() => toggleMonitor(selectedMonitorData)}
                    className={`w-full p-4 rounded-lg ${selectedMonitorData.isRunning ? "bg-red-500" : "bg-green-500"}`}
                  >
                    {selectedMonitorData.isRunning ? "Stop Monitoring" : "Start Monitoring"}
                  </motion.button>
                </div>
              </motion.div>
            ) : (
              <p>Select a monitor to begin</p>
            )}
          </div>
        </div>
      </motion.div>
    </div>
  );
}

export default App;
