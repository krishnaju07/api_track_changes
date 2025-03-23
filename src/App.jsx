import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast, Toaster } from 'react-hot-toast';
import { FaPlay, FaStop, FaPlus, FaTrash, FaClock, FaLink } from 'react-icons/fa';
import './App.css';

function App() {
  const [monitors, setMonitors] = useState([]);
  const [selectedMonitor, setSelectedMonitor] = useState(null);
  const [intervals, setIntervals] = useState({});

  useEffect(() => {
    // Load saved monitors from localStorage
    const savedMonitors = localStorage.getItem('apiMonitors');
    if (savedMonitors) {
      const parsedMonitors = JSON.parse(savedMonitors);
      setMonitors(parsedMonitors);

      // Restart monitoring for active monitors
      parsedMonitors.forEach(monitor => {
        if (monitor.isRunning) {
          startMonitor(monitor);
        }
      });
    }
  }, []);

  useEffect(() => {
    // Save monitors to localStorage whenever they change
    localStorage.setItem('apiMonitors', JSON.stringify(monitors));
  }, [monitors]);

  const clearMonitorInterval = (monitorId) => {
    if (intervals[monitorId]) {
      clearInterval(intervals[monitorId]);
      setIntervals(prev => {
        const newIntervals = { ...prev };
        delete newIntervals[monitorId];
        return newIntervals;
      });
    }
  };

  const addNewMonitor = () => {
    const newMonitor = {
      id: Date.now().toString(),
      name: `Monitor ${monitors.length + 1}`,
      apiUrl: '',
      filterId: '',
      interval: 30,
      isRunning: false,
      previousData: null,
      differences: null
    };
    setMonitors([...monitors, newMonitor]);
    setSelectedMonitor(newMonitor.id);
  };

  const updateMonitor = (id, updates) => {
    setMonitors(prevMonitors =>
      prevMonitors.map(monitor => {
        if (monitor.id === id) {
          if ('interval' in updates || ('isRunning' in updates && !updates.isRunning)) {
            clearMonitorInterval(id);
          }
          return { ...monitor, ...updates };
        }
        return monitor;
      })
    );
  };

  const deleteMonitor = (id) => {
    clearMonitorInterval(id);
    setMonitors(prevMonitors => prevMonitors.filter(monitor => monitor.id !== id));
    if (selectedMonitor === id) {
      setSelectedMonitor(null);
    }
  };

  const extractRelevantData = (data, id) => {
    if (data && data.queues) {
      if (id) {
        return data.queues.find(queue => queue.name === id);
      }
      return data.queues;
    }

    if (Array.isArray(data)) {
      if (id) {
        return data.find(item => item.id === id || item.name === id);
      }
      return data;
    }

    if (typeof data === 'object' && data !== null) {
      if (id) {
        return (data.id === id || data.name === id) ? data : null;
      }
      return data;
    }

    return null;
  };

  const getSlugFromData = (data) => {
    if (!data) return null;
    return data.slug || data.name || null;
  };

  const getNameFromData = (data) => {
    if (!data) return null;
    return data.name || data.displayName || data.title || null;
  };

  const fetchData = async (monitor) => {
    try {
      if (!monitor.apiUrl) {
        toast.error(`Please enter an API URL for ${monitor.name}`);
        return;
      }

      const response = await fetch(monitor.apiUrl, {
        headers: {
          'Accept': '*/*',
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      let data;
      const text = await response.text();

      try {
        data = JSON.parse(text);
      } catch (e) {
        const match = text.match(/window\.queueFair\.settings\s*=\s*({[\s\S]*?});/);
        if (match) {
          try {
            data = JSON.parse(match[1]);
          } catch (e2) {
            throw new Error('Failed to parse response data');
          }
        } else {
          throw new Error('Unsupported response format');
        }
      }

      const relevantData = extractRelevantData(data, monitor.filterId);

      if (!relevantData) {
        toast.error(`No data found for the specified ID in ${monitor.name}`);
        return;
      }

      const currentSlug = getSlugFromData(relevantData);
      const previousSlug = monitor.previousData ? getSlugFromData(monitor.previousData) : null;

      if (monitor.previousData && currentSlug !== previousSlug) {
        const difference = {
          name: getNameFromData(relevantData),
          url: `${monitor.apiUrl}/${currentSlug}`,
          slug_difference: {
            previous: previousSlug,
            current: currentSlug
          }
        };

        updateMonitor(monitor.id, {
          differences: difference,
          previousData: relevantData
        });
        toast.success(`Changes detected in ${monitor.name}!`);
      } else {
        updateMonitor(monitor.id, { previousData: relevantData });
      }
    } catch (error) {
      toast.error(`Error in ${monitor.name}: ${error.message}`);
      console.error('Error:', error);
    }
  };

  const startMonitor = (monitor) => {
    fetchData(monitor);
    const intervalId = setInterval(() => fetchData(monitor), monitor.interval * 1000);
    setIntervals(prev => ({ ...prev, [monitor.id]: intervalId }));
    updateMonitor(monitor.id, { isRunning: true });
  };

  const toggleMonitor = (monitor) => {
    if (!monitor.isRunning) {
      startMonitor(monitor);
    } else {
      clearMonitorInterval(monitor.id);
      updateMonitor(monitor.id, { isRunning: false });
    }
  };

  useEffect(() => {
    return () => {
      Object.keys(intervals).forEach(clearMonitorInterval);
    };
  }, []);

  const selectedMonitorData = monitors.find(m => m.id === selectedMonitor);

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 to-gray-800 text-white p-8">
      <Toaster position="top-right" />
      
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-6xl mx-auto"
      >
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
          {/* Sidebar */}
          <div className="col-span-3 bg-gray-800 rounded-xl p-4 h-[calc(100vh-12rem)] overflow-y-auto">
            <h2 className="text-xl font-semibold mb-4">Monitors</h2>
            <div className="space-y-2">
              <AnimatePresence>
                {monitors.map(monitor => (
                  <motion.div
                    key={monitor.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    className={`p-3 rounded-lg cursor-pointer transition-colors ${
                      selectedMonitor === monitor.id
                        ? 'bg-blue-500'
                        : 'bg-gray-700 hover:bg-gray-600'
                    }`}
                    onClick={() => setSelectedMonitor(monitor.id)}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-medium">{monitor.name}</span>
                      <div className="flex items-center space-x-2">
                        {monitor.isRunning && (
                          <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
                        )}
                      </div>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          </div>

          {/* Main Content */}
          <div className="col-span-9">
            {selectedMonitorData ? (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="bg-gray-800 rounded-xl p-8 shadow-2xl"
              >
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
                  <div className="flex items-center space-x-4">
                    <div className="flex-1">
                      <label className="flex items-center space-x-2 text-sm font-medium mb-2">
                        <FaLink /> <span>API URL</span>
                      </label>
                      <input
                        type="text"
                        value={selectedMonitorData.apiUrl}
                        onChange={(e) => updateMonitor(selectedMonitorData.id, { apiUrl: e.target.value })}
                        className="w-full bg-gray-700 rounded-lg p-3 focus:ring-2 focus:ring-blue-500"
                        placeholder="https://api.example.com/endpoint"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium mb-2">ID/Name Filter (Optional)</label>
                      <input
                        type="text"
                        value={selectedMonitorData.filterId}
                        onChange={(e) => updateMonitor(selectedMonitorData.id, { filterId: e.target.value })}
                        className="w-full bg-gray-700 rounded-lg p-3 focus:ring-2 focus:ring-blue-500"
                        placeholder="Enter ID or name to filter"
                      />
                    </div>

                    <div>
                      <label className="flex items-center space-x-2 text-sm font-medium mb-2">
                        <FaClock /> <span>Check Interval (seconds)</span>
                      </label>
                      <input
                        type="number"
                        value={selectedMonitorData.interval}
                        onChange={(e) => updateMonitor(selectedMonitorData.id, { interval: parseInt(e.target.value, 10) })}
                        className="w-full bg-gray-700 rounded-lg p-3 focus:ring-2 focus:ring-blue-500"
                        min="1"
                      />
                    </div>
                  </div>

                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => toggleMonitor(selectedMonitorData)}
                    className={`w-full p-4 rounded-lg flex items-center justify-center space-x-2 ${
                      selectedMonitorData.isRunning
                        ? 'bg-red-500 hover:bg-red-600'
                        : 'bg-green-500 hover:bg-green-600'
                    }`}
                  >
                    {selectedMonitorData.isRunning ? (
                      <>
                        <FaStop /> <span>Stop Monitoring</span>
                      </>
                    ) : (
                      <>
                        <FaPlay /> <span>Start Monitoring</span>
                      </>
                    )}
                  </motion.button>

                  {selectedMonitorData.differences && (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="mt-8 p-4 bg-gray-700 rounded-lg"
                    >
                      <h2 className="text-xl font-semibold mb-4">Latest Change Detected</h2>
                      <pre className="whitespace-pre-wrap overflow-x-auto">
                        {JSON.stringify(selectedMonitorData.differences, null, 2)}
                      </pre>
                    </motion.div>
                  )}
                </div>
              </motion.div>
            ) : (
              <div className="h-full flex items-center justify-center text-gray-500">
                <p>Select a monitor or create a new one to get started</p>
              </div>
            )}
          </div>
        </div>
      </motion.div>
    </div>
  );
}

export default App;