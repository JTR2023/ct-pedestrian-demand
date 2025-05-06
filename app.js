// Global variables
let map;
let panorama;
let deckOverlay;
let pointsData = [];
let filteredData = [];
let isDataLoaded = false;

// Default model weights
const defaultWeights = {
  census: 0.20,
  crash: 0.20,
  funcClass: 0.20,
  school: 0.10,
  trail: 0.10,
  rail: 0.10,
  bus: 0.10
};

// Current weights (start with defaults)
let currentWeights = { ...defaultWeights };

// Preset filters
const presetFilters = {
  high_need: "DemandRank >= 50 AND Sidewalks = 0 AND pedestrian_feasible = 1",
  high_crash: "crash_risk_score = 10 AND pedestrian_feasible = 1",
  slam_dunk: "DemandRank >= 50 AND crash_risk_score = 10 AND Sidewalks = 0 AND pedestrian_feasible = 1"
};

// Initialize the map when Google Maps API loads
function initMap() {
  // Set up Google Map
  map = new google.maps.Map(document.getElementById('map'), {
    center: { lat: 41.6032, lng: -72.7266 },
    zoom: 9,
    mapTypeId: 'roadmap',
    mapTypeControl: true,
    mapTypeControlOptions: {
      position: google.maps.ControlPosition.TOP_RIGHT
    },
    streetViewControl: true,
    streetViewControlOptions: {
      position: google.maps.ControlPosition.RIGHT_TOP
    }
  });
  
  // Set up Street View
  panorama = new google.maps.StreetViewPanorama(
    document.getElementById('street-view'),
    {
      position: { lat: 41.6032, lng: -72.7266 },
      pov: { heading: 0, pitch: 0 },
      visible: false
    }
  );
  map.setStreetView(panorama);
  
  // Hide UI in Street View
  map.addListener('streetview_changed', () => {
    const infoPanel = document.querySelector('.info-panel');
    if (map.getStreetView().getVisible()) {
      infoPanel.classList.add('hidden-in-streetview');
    } else {
      infoPanel.classList.remove('hidden-in-streetview');
    }
  });
  
  // Update map layers when view changes (for large datasets)
  map.addListener('idle', () => {
    if (isDataLoaded) {
      updateMapLayers();
    }
  });
  
  // Initialize deck.gl overlay
  initDeckGL();
  
  // Set up event listeners
  setupEventListeners();
  
  // Load initial state from URL hash if present
  loadStateFromUrl();
  
  // Load data (either chunks or FlatGeobuf)
  loadData();
}

// Initialize deck.gl overlay
function initDeckGL() {
  deckOverlay = new deck.GoogleMapsOverlay({
    layers: []
  });
  deckOverlay.setMap(map);
}

// Set up event listeners
function setupEventListeners() {
  // Advanced panel toggle
  const toggleBtn = document.getElementById('toggle-advanced');
  const advancedPanel = document.querySelector('.advanced-panel');
  
  if (toggleBtn && advancedPanel) {
    // Ensure the panel starts hidden
    advancedPanel.classList.add('hidden');
    advancedPanel.classList.remove('expanded');
    
    toggleBtn.addEventListener('click', () => {
      advancedPanel.classList.toggle('hidden');
      // Also toggle expanded class for animation
      advancedPanel.classList.toggle('expanded', !advancedPanel.classList.contains('hidden'));
      toggleBtn.textContent = advancedPanel.classList.contains('hidden') 
        ? 'Advanced Options ▼' 
        : 'Advanced Options ▲';
      
      // Force a redraw of weight controls when panel is displayed
      if (!advancedPanel.classList.contains('hidden')) {
        setTimeout(() => {
          // Update all weight displays
          Object.entries(currentWeights).forEach(([key, value]) => {
            const input = document.getElementById(`${key}-weight`);
            if (input) {
              input.value = value;
              const label = input.parentElement.querySelector('label');
              const valueDisplay = label ? label.querySelector('.weight-value') : input.parentElement.querySelector('.weight-value');
              if (valueDisplay) {
                valueDisplay.textContent = `${Math.round(value * 100)}%`;
              }
            }
          });
          updateTotalWeight();
        }, 50);
      }
    });
  }
  
  // DemandRank filter sliders
  const minScoreSlider = document.getElementById('min-score');
  const maxScoreSlider = document.getElementById('max-score');
  const minScoreValue = document.getElementById('min-score-value');
  const maxScoreValue = document.getElementById('max-score-value');
  
  minScoreSlider.addEventListener('input', () => {
    const minValue = parseInt(minScoreSlider.value);
    const maxValue = parseInt(maxScoreSlider.value);
    
    minScoreValue.textContent = minValue;
    
    if (minValue > maxValue) {
      maxScoreSlider.value = minValue;
      maxScoreValue.textContent = minValue;
    }
    
    if (isDataLoaded) {
      filterAndUpdateMap();
    }
  });
  
  maxScoreSlider.addEventListener('input', () => {
    const minValue = parseInt(minScoreSlider.value);
    const maxValue = parseInt(maxScoreSlider.value);
    
    maxScoreValue.textContent = maxValue;
    
    if (maxValue < minValue) {
      minScoreSlider.value = maxValue;
      minScoreValue.textContent = maxValue;
    }
    
    if (isDataLoaded) {
      filterAndUpdateMap();
    }
  });
  
  // Weight sliders
  const weightInputs = {
    census: document.getElementById('census-weight'),
    crash: document.getElementById('crash-weight'),
    funcClass: document.getElementById('func-class-weight'),
    school: document.getElementById('school-weight'),
    trail: document.getElementById('trail-weight'),
    rail: document.getElementById('rail-weight'),
    bus: document.getElementById('bus-weight')
  };
  
  // Update weights when sliders change
  Object.entries(weightInputs).forEach(([key, input]) => {
    if (!input) return;
    
    // Find the weight value display more specifically in the label element
    const label = input.parentElement.querySelector('label');
    const valueDisplay = label ? label.querySelector('.weight-value') : input.parentElement.querySelector('.weight-value');
    
    input.addEventListener('input', () => {
      const value = parseFloat(input.value);
      if (valueDisplay) {
        valueDisplay.textContent = `${Math.round(value * 100)}%`;
      }
      currentWeights[key] = value;
      updateTotalWeight();
    });
  });
  
  // Initialize weight displays with current values
  Object.entries(currentWeights).forEach(([key, value]) => {
    const input = document.getElementById(`${key}-weight`);
    if (input) {
      input.value = value;
      const label = input.parentElement.querySelector('label');
      const valueDisplay = label ? label.querySelector('.weight-value') : input.parentElement.querySelector('.weight-value');
      if (valueDisplay) {
        valueDisplay.textContent = `${Math.round(value * 100)}%`;
      }
    }
  });
  
  // Recalculate button
  const recalculateBtn = document.getElementById('recalculate');
  if (recalculateBtn) {
    recalculateBtn.addEventListener('click', () => {
      if (isDataLoaded) {
        recalculateDemandRank();
        filterAndUpdateMap();
      }
    });
  }
  
  // Filter checkboxes
  const filterCheckboxes = [
    'pedestrian-feasible',
    'urban-context',
    'highlight-sidewalk-gaps',
    'highlight-crash-segments',
    'show-street-view'
  ];
  
  filterCheckboxes.forEach(id => {
    const checkbox = document.getElementById(id);
    if (checkbox) {
      checkbox.addEventListener('change', () => {
        if (isDataLoaded) {
          filterAndUpdateMap();
        }
        
        if (id === 'show-street-view') {
          const streetViewContainer = document.getElementById('street-view');
          if (streetViewContainer) {
            if (checkbox.checked) {
              streetViewContainer.classList.remove('hidden');
              panorama.setVisible(true);
              
              // If we have a filtered dataset, try to show a point in the current view
              if (filteredData && filteredData.length > 0) {
                // Find a point in the current view bounds
                const bounds = map.getBounds();
                const visiblePoint = filteredData.find(point => {
                  if (!point.position || point.position.length < 2) return false;
                  const lat = point.position[1];
                  const lng = point.position[0];
                  return bounds.contains(new google.maps.LatLng(lat, lng));
                });
                
                if (visiblePoint) {
                  panorama.setPosition({ 
                    lat: visiblePoint.position[1], 
                    lng: visiblePoint.position[0] 
                  });
                }
              }
            } else {
              streetViewContainer.classList.add('hidden');
              panorama.setVisible(false);
            }
          }
        }
      });
    }
  });
  
  // Preset radio buttons
  const presetRadios = document.querySelectorAll('input[name="preset"]');
  presetRadios.forEach(radio => {
    radio.addEventListener('change', () => {
      if (isDataLoaded) {
        filterAndUpdateMap();
      }
    });
  });
  
  // Route search
  const searchBtn = document.getElementById('search-button');
  const routeInput = document.getElementById('route-search');
  
  if (searchBtn && routeInput) {
    searchBtn.addEventListener('click', () => {
      searchByRouteId(routeInput.value);
    });
    
    routeInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        searchByRouteId(routeInput.value);
      }
    });
  }
  
  // Basemap style
  const basemapSelect = document.getElementById('basemap-style');
  if (basemapSelect) {
    basemapSelect.addEventListener('change', () => {
      map.setMapTypeId(basemapSelect.value);
    });
  }
  
  // Export buttons
  const exportCsvBtn = document.getElementById('export-csv');
  const copyLinkBtn = document.getElementById('copy-link');
  
  if (exportCsvBtn) {
    exportCsvBtn.addEventListener('click', exportCSV);
  }
  
  if (copyLinkBtn) {
    copyLinkBtn.addEventListener('click', shareCurrentView);
  }
}

// Load data from Google Cloud Storage
async function loadData() {
  updateLoadingStatus('Initializing...', 0);
  
  try {
    // Load the single GeoJSON file from Google Cloud Storage
    const url = 'https://storage.googleapis.com/ct-pedestrian-demand-data/data/milepoints_data.json';
    updateLoadingStatus('Fetching data from Google Cloud Storage...', 10);
    
    // Try to fetch and log headers to diagnose CORS issues
    try {
      const headResponse = await fetch(url, { method: 'HEAD' });
      console.log('GCS Headers:', {
        'content-type': headResponse.headers.get('content-type'),
        'access-control-allow-origin': headResponse.headers.get('access-control-allow-origin'),
        'status': headResponse.status
      });
    } catch (headError) {
      console.warn('Could not fetch headers:', headError);
    }
    
    const data = await loadGeoJSON(url);
    console.log('Data loaded successfully, sample:', data.type ? data.type : 'No type');
    
    // Store parsed data - ensure we extract features if it's a FeatureCollection
    if (data && data.type === 'FeatureCollection' && Array.isArray(data.features)) {
      pointsData = data.features;
      console.log(`Extracted ${pointsData.length} features from FeatureCollection`);
    } else {
      pointsData = data;
      console.log('Data was not a standard FeatureCollection');
    }
    
    // Normalize data if needed
    normalizeData();
    
    // Update UI
    document.getElementById('totalPoints').textContent = pointsData.length.toLocaleString();
    updateLoadingStatus('Data loaded successfully', 100);
    
    // Setup complete - filter and show data
    isDataLoaded = true;
    filterAndUpdateMap();
    
  } catch (error) {
    console.error('Error loading data:', error);
    updateLoadingStatus(`Error: ${error.message}`, 100, true);
  }
}

// Load data using FlatGeobuf format
async function loadFlatGeobuf(url) {
  updateLoadingStatus('Loading FlatGeobuf data...', 10);
  
  try {
    const data = await loaders.load(url, loaders.FlatGeobufLoader);
    updateLoadingStatus('Processing data...', 80);
    return data;
  } catch (error) {
    throw new Error(`Failed to load FlatGeobuf: ${error.message}`);
  }
}

// Load data using GeoJSON format
async function loadGeoJSON(url) {
  updateLoadingStatus('Fetching GeoJSON data...', 10);
  
  try {
    // Fetch the data with appropriate cache settings
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Accept': 'application/json'
      },
      cache: 'no-cache' // Ensure we get fresh data
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error! Status: ${response.status}`);
    }
    
    // Get content length if available
    const contentLength = +response.headers.get('Content-Length');
    const totalSizeMB = contentLength ? (contentLength / (1024 * 1024)).toFixed(1) : 'unknown';
    updateLoadingStatus(`Loading data (${totalSizeMB} MB total)...`, 15);
    
    // Stream and process the response
    const reader = response.body.getReader();
    let receivedLength = 0;
    let chunks = [];
    let lastProgressUpdate = Date.now();
    
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      
      chunks.push(value);
      receivedLength += value.length;
      
      // Update progress (but limit updates to once every 500ms to avoid UI thrashing)
      const now = Date.now();
      if (now - lastProgressUpdate > 500) {
        lastProgressUpdate = now;
        
        if (contentLength) {
          const percentComplete = Math.round((receivedLength / contentLength) * 100);
          const progress = Math.round((receivedLength / contentLength) * 65);
          updateLoadingStatus(`Loading data: ${(receivedLength / (1024 * 1024)).toFixed(1)} MB of ${totalSizeMB} MB (${percentComplete}%)`, 15 + progress);
        } else {
          updateLoadingStatus(`Loading data: ${(receivedLength / (1024 * 1024)).toFixed(1)} MB received`, 40);
        }
      }
    }
    
    updateLoadingStatus('Processing GeoJSON data...', 80);
    
    // Combine chunks and parse JSON
    const chunksAll = new Uint8Array(receivedLength);
    let position = 0;
    for (let chunk of chunks) {
      chunksAll.set(chunk, position);
      position += chunk.length;
    }
    
    const text = new TextDecoder("utf-8").decode(chunksAll);
    const parsedData = JSON.parse(text);
    
    // Log the data structure for debugging
    console.log("GeoJSON data structure:", {
      type: parsedData.type,
      featureCount: parsedData.features ? parsedData.features.length : 'No features array',
      sampleFeature: parsedData.features && parsedData.features.length > 0 ? 
                      { type: parsedData.features[0].type, properties: Object.keys(parsedData.features[0].properties || {}) } : 
                      'No features'
    });
    
    updateLoadingStatus('GeoJSON loaded successfully, preparing data...', 90);
    
    // Make sure we're returning a properly formatted dataset
    if (parsedData.type === "FeatureCollection" && Array.isArray(parsedData.features)) {
      return parsedData;
    } else {
      console.warn("Data is not in expected FeatureCollection format, attempting to process anyway");
      return parsedData;
    }
  } catch (error) {
    console.error('GeoJSON loading error:', error);
    throw new Error(`Failed to load GeoJSON: ${error.message}`);
  }
}

// Normalize data format if needed
function normalizeData() {
  console.log(`Starting normalization of ${pointsData.length} data points`);
  
  // This function adapts different data formats to a common structure
  // Check what kind of GeoJSON structure we have
  if (Array.isArray(pointsData) && pointsData.length > 0) {
    if (pointsData[0].type === "Feature") {
      console.log("Normalizing GeoJSON Features");
      // Handle proper GeoJSON Features
      pointsData = pointsData.map(feature => {
        const properties = feature.properties || {};
        const geometry = feature.geometry || {};
        const coordinates = geometry.coordinates || [];
        
        // For Point geometry, coordinates is just [lng, lat]
        // For LineString, it's an array of points, so we take the first one
        let position;
        if (coordinates.length > 0) {
          if (geometry.type === "Point") {
            position = coordinates; // [lng, lat]
          } else if (geometry.type === "LineString" && coordinates[0] && coordinates[0].length >= 2) {
            position = coordinates[0]; // First point in the line
          } else if (Array.isArray(coordinates[0])) {
            position = coordinates[0]; // Assume first item is a point
          } else if (coordinates.length >= 2) {
            position = coordinates; // Assume coordinates is a single point
          }
        }
        
        return {
          ...properties,
          geometry: geometry,
          // Ensure consistent property naming
          DemandRank: properties.DemandRank || properties.demand_rank || 0,
          census_score: properties.census_score || 0,
          crash_risk_score: properties.crash_risk_score || 0,
          functional_class_score: properties.functional_class_score || 0,
          school_proximity_score: properties.school_proximity_score || 0,
          trail_proximity_score: properties.trail_proximity_score || 0,
          rail_proximity_score: properties.rail_proximity_score || 0,
          bus_proximity_score: properties.bus_proximity_score || 0,
          pedestrian_feasible: properties.pedestrian_feasible || 0,
          urban_context: properties.urban_context || 0,
          Sidewalks: properties.Sidewalks || 0,
          position: position
        };
      });
    } else {
      console.log("Normalizing non-Feature data");
      // Handle other array format
      pointsData = pointsData.map(point => {
        const properties = point.properties || point;
        let position = properties.position;
        
        if (!position) {
          if (point.geometry && point.geometry.coordinates) {
            position = point.geometry.coordinates;
          } else if (properties.longitude != null && properties.latitude != null) {
            position = [properties.longitude, properties.latitude];
          }
        }
        
        return {
          ...properties,
          // Ensure consistent property naming
          DemandRank: properties.DemandRank || properties.demand_rank || 0,
          position: position
        };
      });
    }
  }
  
  // Filter out any entries without valid positions
  const initialCount = pointsData.length;
  pointsData = pointsData.filter(point => 
    point.position && Array.isArray(point.position) && point.position.length >= 2
  );
  console.log(`Normalized ${pointsData.length} data points (filtered out ${initialCount - pointsData.length} invalid points)`);
  
  // Log a sample point for debugging
  if (pointsData.length > 0) {
    console.log("Sample normalized point:", pointsData[0]);
  }
}

// Update the loading status display
function updateLoadingStatus(message, progress, isError = false) {
  const statusElement = document.getElementById('loadingStatus');
  const progressFill = document.getElementById('progressFill');
  
  if (statusElement) {
    statusElement.textContent = message;
  }
  
  if (progressFill) {
    progressFill.style.width = `${progress}%`;
    if (isError) {
      progressFill.style.backgroundColor = '#f44336';
    }
  }
}

// Calculate total weight and update display
function updateTotalWeight() {
  const total = Object.values(currentWeights).reduce((sum, weight) => sum + weight, 0);
  const totalDisplay = document.getElementById('total-weight');
  
  if (totalDisplay) {
    totalDisplay.textContent = `${Math.round(total * 100)}%`;
    
    if (Math.abs(total - 1) > 0.01) {
      totalDisplay.style.color = 'red';
    } else {
      totalDisplay.style.color = 'inherit';
    }
  }
}

// Recalculate DemandRank based on current weights
function recalculateDemandRank() {
  pointsData.forEach(point => {
    // Store original demand rank if not already stored
    if (!point.hasOwnProperty('original_DemandRank')) {
      point.original_DemandRank = point.DemandRank;
    }
    
    // Calculate new demand rank using weights
    const newDemandRank =
      currentWeights.census * (point.census_score || 0) +
      currentWeights.crash * (point.crash_risk_score || 0) +
      currentWeights.funcClass * (point.functional_class_score || 0) +
      currentWeights.school * (point.school_proximity_score || 0) +
      currentWeights.trail * (point.trail_proximity_score || 0) +
      currentWeights.rail * (point.rail_proximity_score || 0) +
      currentWeights.bus * (point.bus_proximity_score || 0);
    
    // Update demand rank
    point.DemandRank = newDemandRank;
  });
}

// Filter data based on UI controls and update map
function filterAndUpdateMap() {
  // Get current filter values
  const minRank = parseInt(document.getElementById('min-score').value);
  const maxRank = parseInt(document.getElementById('max-score').value);
  
  // Optional filters
  const pedestrianFeasible = document.getElementById('pedestrian-feasible')?.checked;
  const urbanContext = document.getElementById('urban-context')?.checked;
  const highlightSidewalkGaps = document.getElementById('highlight-sidewalk-gaps')?.checked;
  const highlightCrashSegments = document.getElementById('highlight-crash-segments')?.checked;
  
  // Check for active preset
  const activePreset = document.querySelector('input[name="preset"]:checked')?.value;
  
  // Apply filters to data
  filteredData = pointsData.filter(point => {
    // Basic validation
    if (!point || !point.position || !Array.isArray(point.position) || point.position.length !== 2) {
      return false;
    }
    
    // Demand rank filter
    const rank = point.DemandRank;
    if (typeof rank !== 'number' || isNaN(rank) || rank < minRank || rank > maxRank) {
      return false;
    }
    
    // Optional filters
    if (pedestrianFeasible && !point.pedestrian_feasible) {
      return false;
    }
    
    if (urbanContext && !point.urban_context) {
      return false;
    }
    
    // Preset filters
    if (activePreset && activePreset !== 'none') {
      const presetCondition = presetFilters[activePreset];
      if (presetCondition) {
        // Parse and apply the SQL-like condition
        if (presetCondition.includes('DemandRank >= 50') && point.DemandRank < 50) return false;
        if (presetCondition.includes('crash_risk_score = 10') && point.crash_risk_score !== 10) return false;
        if (presetCondition.includes('Sidewalks = 0') && point.Sidewalks !== 0) return false;
        if (presetCondition.includes('pedestrian_feasible = 1') && point.pedestrian_feasible !== 1) return false;
      }
    }
    
    return true;
  });
  
  // Update the map with filtered data
  updateMapLayers();
}

// Update deck.gl layers
function updateMapLayers() {
  if (!deckOverlay || !filteredData) {
    console.log('No filtered data available to display');
    return;
  }
  
  if (filteredData.length === 0) {
    console.log('Filtered data is empty, nothing to display');
    // Clear the map layers but keep the overlay
    deckOverlay.setProps({ layers: [] });
    return;
  }
  
  // Log summary for debugging
  console.log(`Displaying ${filteredData.length} points on the map`);
  
  // Create datasets for different visualizations
  let roadData = filteredData;
  let sidewalkGaps = [];
  let crashSegments = [];
  
  // Get current view bounds to optimize rendering
  const bounds = map.getBounds();
  const inView = point => {
    if (!point.position || !Array.isArray(point.position) || point.position.length < 2) return false;
    const lat = point.position[1];
    const lng = point.position[0];
    return lat >= bounds.getSouthWest().lat() && 
           lat <= bounds.getNorthEast().lat() && 
           lng >= bounds.getSouthWest().lng() && 
           lng <= bounds.getNorthEast().lng();
  };
  
  // Limit points if too many to render efficiently
  const maxPointsToRender = 100000;
  let visiblePoints = roadData;
  
  if (roadData.length > maxPointsToRender) {
    // If too many points, prioritize visible ones and sample others
    const visibleData = roadData.filter(inView);
    if (visibleData.length < maxPointsToRender) {
      // We can show all visible points and sample the rest
      const remainingPoints = roadData.filter(p => !inView(p));
      const samplingRate = (maxPointsToRender - visibleData.length) / remainingPoints.length;
      const sampledPoints = remainingPoints.filter(() => Math.random() < samplingRate);
      visiblePoints = [...visibleData, ...sampledPoints];
    } else {
      // Sample from visible points only
      const samplingRate = maxPointsToRender / visibleData.length;
      visiblePoints = visibleData.filter(() => Math.random() < samplingRate);
    }
    console.log(`Showing ${visiblePoints.length} of ${roadData.length} total points (sampling)`);
  }
  
  // Check for special highlighting
  const highlightSidewalkGaps = document.getElementById('highlight-sidewalk-gaps')?.checked;
  const highlightCrashSegments = document.getElementById('highlight-crash-segments')?.checked;
  
  if (highlightSidewalkGaps || highlightCrashSegments) {
    // Split data into categories for visualization
    roadData = visiblePoints.filter(point => {
      const isSidewalkGap = point.pedestrian_feasible === 1 && point.Sidewalks === 0;
      const isCrashSegment = point.crash_risk_score === 10;
      
      if (highlightSidewalkGaps && isSidewalkGap) {
        sidewalkGaps.push(point);
        return false;
      }
      
      if (highlightCrashSegments && isCrashSegment) {
        crashSegments.push(point);
        return false;
      }
      
      return true;
    });
  } else {
    roadData = visiblePoints;
  }
  
  // Create layers array
  const layers = [];
  
  // Main data layer
  layers.push(
    new deck.ScatterplotLayer({
      id: 'demand-points',
      data: roadData,
      getPosition: d => d.position,
      getFillColor: d => getColor(d.DemandRank),
      getRadius: 15,
      radiusUnits: 'meters',
      radiusMinPixels: 2,
      radiusMaxPixels: 20,
      pickable: true,
      opacity: 0.7,
      stroked: false,
      onClick: info => handleClick(info),
      onHover: info => handleHover(info)
    })
  );
  
  // Sidewalk gaps layer (if enabled)
  if (highlightSidewalkGaps && sidewalkGaps.length > 0) {
    layers.push(
      new deck.ScatterplotLayer({
        id: 'sidewalk-gaps',
        data: sidewalkGaps,
        getPosition: d => d.position,
        getFillColor: [76, 175, 80], // Green
        getRadius: 18,
        radiusUnits: 'meters',
        radiusMinPixels: 3,
        radiusMaxPixels: 22,
        pickable: true,
        opacity: 0.8,
        stroked: true,
        strokeWidth: 2,
        onClick: info => handleClick(info),
        onHover: info => handleHover(info)
      })
    );
  }
  
  // Crash segments layer (if enabled)
  if (highlightCrashSegments && crashSegments.length > 0) {
    layers.push(
      new deck.ScatterplotLayer({
        id: 'crash-segments',
        data: crashSegments,
        getPosition: d => d.position,
        getFillColor: [255, 87, 34], // Orange
        getRadius: 18,
        radiusUnits: 'meters',
        radiusMinPixels: 3,
        radiusMaxPixels: 22,
        pickable: true,
        opacity: 0.8,
        stroked: true,
        strokeWidth: 2,
        onClick: info => handleClick(info),
        onHover: info => handleHover(info)
      })
    );
  }
  
  // Update the deck.gl overlay
  deckOverlay.setProps({ layers });
}

// Get color for a score
function getColor(score) {
  if (score >= 70) return [127, 0, 0, 220]; // Very high
  if (score >= 60) return [183, 28, 28, 220]; // High
  if (score >= 50) return [198, 40, 40, 220]; // Medium-high
  if (score >= 40) return [211, 47, 47, 220]; // Medium
  if (score >= 30) return [229, 57, 53, 220]; // Medium-low
  if (score >= 20) return [239, 83, 80, 220]; // Low
  return [255, 205, 210, 220]; // Very low
}

// Handle click on a point
function handleClick(info) {
  if (!info.object) return;
  
  const point = info.object;
  console.log('Clicked point:', point); // For debugging
  
  // Ensure position exists and is valid
  if (!point.position || !Array.isArray(point.position) || point.position.length < 2) {
    console.error('Invalid position data for clicked point:', point);
    return;
  }
  
  // Create info window content - with safe value handling
  const getDemandRank = () => {
    try { return point.DemandRank.toFixed(1); } 
    catch (e) { return point.DemandRank || 'N/A'; }
  };
  
  const content = `
    <div style="font-family: Arial, sans-serif; line-height: 1.5;">
      <h3 style="margin: 0 0 8px; color: #d32f2f;">DemandRank: ${getDemandRank()}</h3>
      ${point.route_id ? `<p><strong>Route:</strong> ${point.route_id}</p>` : ''}
      ${point.begin_poin ? `<p><strong>Milepoint:</strong> ${point.begin_poin}</p>` : ''}
      <p><strong>Census Score:</strong> ${point.census_score || 'N/A'}</p>
      <p><strong>Crash Risk:</strong> ${point.crash_risk_score || 'N/A'}</p>
      <p><strong>Sidewalks:</strong> ${point.Sidewalks ? 'Yes' : 'No'}</p>
      <p><strong>Pedestrian Feasible:</strong> ${point.pedestrian_feasible ? 'Yes' : 'No'}</p>
      <p><strong>Urban Context:</strong> ${point.urban_context ? 'Urban' : 'Rural'}</p>
      <hr>
      <p><strong>Coords:</strong> ${point.position[1].toFixed(6)}, ${point.position[0].toFixed(6)}</p>
      <button id="view-in-streetview" style="margin-top:10px;padding:5px;background:#d32f2f;color:white;border:none;border-radius:4px;cursor:pointer;">
        View in Street View
      </button>
    </div>
  `;
  
  // Create and show info window
  const infoWindow = new google.maps.InfoWindow({
    content: content,
    position: { lat: point.position[1], lng: point.position[0] }
  });
  
  infoWindow.open(map);
  
  // Add event listener for Street View button after the info window is shown
  google.maps.event.addListener(infoWindow, 'domready', function() {
    document.getElementById('view-in-streetview').addEventListener('click', function() {
      const streetViewContainer = document.getElementById('street-view');
      if (streetViewContainer) {
        streetViewContainer.classList.remove('hidden');
        panorama.setPosition({ lat: point.position[1], lng: point.position[0] });
        panorama.setVisible(true);
        
        // Also enable the checkbox
        const streetViewCheckbox = document.getElementById('show-street-view');
        if (streetViewCheckbox) streetViewCheckbox.checked = true;
      }
    });
  });
  
  // If street view is already enabled, show the location in street view
  const showStreetView = document.getElementById('show-street-view')?.checked;
  if (showStreetView) {
    const streetViewContainer = document.getElementById('street-view');
    if (streetViewContainer) {
      streetViewContainer.classList.remove('hidden');
      panorama.setPosition({ lat: point.position[1], lng: point.position[0] });
      panorama.setVisible(true);
    }
  }
}

// Handle hover over a point
function handleHover(info) {
  // We can implement hover effects if needed
  // For now, we'll use the click handler for info display
}

// Search by route ID
function searchByRouteId(routeId) {
  if (!routeId || !isDataLoaded) return;
  
  routeId = routeId.trim().toUpperCase();
  
  // Find matching points
  const matches = pointsData.filter(point => 
    point.route_id && point.route_id.toUpperCase() === routeId
  );
  
  if (matches.length === 0) {
    alert(`No points found for Route ID: ${routeId}`);
    return;
  }
  
  // Calculate bounds of matched points
  const bounds = new google.maps.LatLngBounds();
  
  matches.forEach(point => {
    bounds.extend({ lat: point.position[1], lng: point.position[0] });
  });
  
  // Pan to bounds
  map.fitBounds(bounds);
  
  // Highlight that this is a filtered view
  document.getElementById('loadingStatus').textContent = `Showing ${matches.length} points for Route ${routeId}`;
}

// Export filtered data as CSV
function exportCSV() {
  if (filteredData.length === 0) {
    alert('No data to export. Please adjust filters to show some data.');
    return;
  }
  
  // Define CSV headers based on data
  const samplePoint = filteredData[0];
  const fields = Object.keys(samplePoint).filter(key => 
    // Exclude position field and other unwanted fields
    key !== 'position' && typeof samplePoint[key] !== 'function' && typeof samplePoint[key] !== 'object'
  );
  
  // Create CSV content
  let csvContent = 'data:text/csv;charset=utf-8,' + fields.join(',') + '\n';
  
  // Add data rows
  filteredData.forEach(point => {
    const row = fields.map(field => {
      const value = point[field];
      // Handle string values with commas
      if (typeof value === 'string' && value.includes(',')) {
        return `"${value}"`;
      }
      return value;
    });
    csvContent += row.join(',') + '\n';
  });
  
  // Download CSV
  const encodedUri = encodeURI(csvContent);
  const link = document.createElement('a');
  link.setAttribute('href', encodedUri);
  link.setAttribute('download', 'pedestrian_demandrank.csv');
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

// Share current view (copy URL with state)
function shareCurrentView() {
  try {
    // Get current view state
    const state = {
      c: [map.getCenter().lat(), map.getCenter().lng()], // center coordinates
      z: map.getZoom(), // zoom level
      f: { // filters
        min: parseInt(document.getElementById('min-score').value),
        max: parseInt(document.getElementById('max-score').value),
        pf: document.getElementById('pedestrian-feasible')?.checked || false,
        uc: document.getElementById('urban-context')?.checked || false,
        sg: document.getElementById('highlight-sidewalk-gaps')?.checked || false,
        cs: document.getElementById('highlight-crash-segments')?.checked || false
      },
      w: currentWeights, // weights
      p: document.querySelector('input[name="preset"]:checked')?.value || 'none' // preset
    };
    
    // Create URL with state
    const url = new URL(window.location.href);
    url.hash = btoa(JSON.stringify(state)); // Base64 encode state
    
    // Copy URL to clipboard
    navigator.clipboard.writeText(url.toString())
      .then(() => {
        // Show success message
        const button = document.getElementById('copy-link');
        const originalText = button.textContent;
        button.textContent = 'Copied!';
        setTimeout(() => {
          button.textContent = originalText;
        }, 2000);
      })
      .catch(err => {
        console.error('Error copying URL:', err);
        alert('Could not copy URL. Please try again.');
      });
  } catch (error) {
    console.error('Error creating shareable URL:', error);
  }
}

// Load state from URL hash
function loadStateFromUrl() {
  if (!window.location.hash) return;
  
  try {
    const hash = window.location.hash.substring(1);
    const state = JSON.parse(atob(hash));
    
    // Set map position
    if (state.c && state.c.length === 2) {
      map.setCenter({ lat: state.c[0], lng: state.c[1] });
    }
    
    if (state.z) {
      map.setZoom(state.z);
    }
    
    // Set filters
    if (state.f) {
      if (state.f.min) document.getElementById('min-score').value = state.f.min;
      if (state.f.max) document.getElementById('max-score').value = state.f.max;
      if (document.getElementById('min-score-value')) {
        document.getElementById('min-score-value').textContent = state.f.min;
      }
      if (document.getElementById('max-score-value')) {
        document.getElementById('max-score-value').textContent = state.f.max;
      }
      
      if (document.getElementById('pedestrian-feasible')) {
        document.getElementById('pedestrian-feasible').checked = state.f.pf;
      }
      if (document.getElementById('urban-context')) {
        document.getElementById('urban-context').checked = state.f.uc;
      }
      if (document.getElementById('highlight-sidewalk-gaps')) {
        document.getElementById('highlight-sidewalk-gaps').checked = state.f.sg;
      }
      if (document.getElementById('highlight-crash-segments')) {
        document.getElementById('highlight-crash-segments').checked = state.f.cs;
      }
    }
    
    // Set weights
    if (state.w) {
      currentWeights = state.w;
      Object.entries(state.w).forEach(([key, value]) => {
        const input = document.getElementById(`${key}-weight`);
        if (input) {
          input.value = value;
          const valueDisplay = input.parentElement.querySelector('.weight-value');
          if (valueDisplay) {
            valueDisplay.textContent = `${Math.round(value * 100)}%`;
          }
        }
      });
      updateTotalWeight();
    }
    
    // Set preset
    if (state.p) {
      const preset = document.querySelector(`input[name="preset"][value="${state.p}"]`);
      if (preset) {
        preset.checked = true;
      }
    }
    
  } catch (error) {
    console.error('Error loading state from URL:', error);
  }
}