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
    // Ensure the panel starts hidden by default
    advancedPanel.classList.add('hidden');
    advancedPanel.classList.remove('expanded');
    
    toggleBtn.addEventListener('click', () => {
      // Toggle the hidden class
      advancedPanel.classList.toggle('hidden');
      
      // Toggle expanded class for animation (opposite of hidden)
      const isExpanded = !advancedPanel.classList.contains('hidden');
      advancedPanel.classList.toggle('expanded', isExpanded);
      
      // Update button text
      toggleBtn.textContent = isExpanded 
        ? 'Advanced Options ▲' 
        : 'Advanced Options ▼';
      
      console.log(`Advanced panel toggled, isExpanded: ${isExpanded}`);
      
      // Force a redraw of weight controls when panel is displayed
      if (isExpanded) {
        // Use a short timeout to allow the panel to become visible first
        setTimeout(() => {
          console.log('Updating weight displays after panel expansion');
          // Update all weight displays
          Object.entries(currentWeights).forEach(([key, value]) => {
            const input = document.getElementById(`${key}-weight`);
            if (input) {
              input.value = value;
              const label = input.parentElement.querySelector('label');
              const valueDisplay = label ? label.querySelector('.weight-value') : null;
              
              if (valueDisplay) {
                valueDisplay.textContent = `${Math.round(value * 100)}%`;
              }
            }
          });
          updateTotalWeight();
        }, 100);
      }
    });
    
    // For debugging
    console.log('Advanced panel toggle initialized');
  } else {
    console.warn('Toggle button or advanced panel not found in DOM');
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
    if (!input) {
      console.warn(`Weight slider for ${key} not found in DOM`);
      return;
    }
    
    // Find the weight value display in the label element
    const label = input.parentElement.querySelector('label');
    const valueDisplay = label ? label.querySelector('.weight-value') : null;
    
    if (!valueDisplay) {
      console.warn(`Value display for ${key} not found`);
    }
    
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
      const valueDisplay = label ? label.querySelector('.weight-value') : null;
      
      if (valueDisplay) {
        valueDisplay.textContent = `${Math.round(value * 100)}%`;
      } else {
        console.warn(`Value display for ${key} not found during initialization`);
      }
    } else {
      console.warn(`Weight slider for ${key} not found during initialization`);
    }
  });
  
  // Ensure total weight is calculated on initialization
  updateTotalWeight();
  
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
    if (!checkbox) {
      console.warn(`Checkbox with ID ${id} not found in the DOM`);
      return;
    }
    
    // For regular filter checkboxes
    if (id !== 'show-street-view') {
      checkbox.addEventListener('change', () => {
        if (isDataLoaded) {
          filterAndUpdateMap();
        }
      });
    } 
    // Special handling for the Street View checkbox
    else {
      checkbox.addEventListener('change', () => {
        const streetViewContainer = document.getElementById('street-view');
        if (!streetViewContainer) {
          console.error('Street view container not found');
          return;
        }
        
        console.log('Street view checkbox toggled:', checkbox.checked);
        
        if (checkbox.checked) {
          // Show street view
          streetViewContainer.classList.remove('hidden');
          
          try {
            // Try to make the panorama visible
            if (panorama) {
              panorama.setVisible(true);
              
              // If we have a filtered dataset, try to show a point in the current view
              if (filteredData && filteredData.length > 0) {
                console.log('Looking for a good point to show in street view');
                
                // Find a point in the current view bounds
                const bounds = map.getBounds();
                const visiblePoints = filteredData.filter(point => {
                  if (!point.position || point.position.length < 2) return false;
                  const lat = point.position[1];
                  const lng = point.position[0];
                  return bounds.contains(new google.maps.LatLng(lat, lng));
                });
                
                console.log(`Found ${visiblePoints.length} visible points to try for street view`);
                
                // Try to find a point with street view coverage
                if (visiblePoints.length > 0) {
                  const pointToShow = visiblePoints[Math.floor(Math.random() * visiblePoints.length)];
                  const position = { 
                    lat: pointToShow.position[1], 
                    lng: pointToShow.position[0] 
                  };
                  
                  console.log('Setting street view position to:', position);
                  panorama.setPosition(position);
                  
                  // Add a marker to show where street view is looking
                  const svMarker = new google.maps.Marker({
                    position: position,
                    map: map,
                    icon: {
                      path: google.maps.SymbolPath.CIRCLE,
                      scale: 7,
                      fillColor: '#4285F4',
                      fillOpacity: 1,
                      strokeColor: '#ffffff',
                      strokeWeight: 2
                    }
                  });
                  
                  // Remove marker when street view is hidden
                  setTimeout(() => {
                    svMarker.setMap(null);
                  }, 5000);
                }
              }
            } else {
              console.error('Panorama not initialized');
            }
          } catch (error) {
            console.error('Error showing street view:', error);
          }
        } else {
          // Hide street view
          streetViewContainer.classList.add('hidden');
          if (panorama) {
            panorama.setVisible(false);
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
  console.log('Starting data loading process...');
  
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
    
    console.log('Fetching main data from:', url);
    const data = await loadGeoJSON(url);
    
    // Validate data structure
    if (!data) {
      throw new Error('Received null or undefined data from GCS');
    }
    
    console.log('Data loaded successfully, type:', data.type ? data.type : 'No type');
    
    // Store parsed data - ensure we extract features if it's a FeatureCollection
    if (data && data.type === 'FeatureCollection' && Array.isArray(data.features)) {
      pointsData = data.features;
      console.log(`Extracted ${pointsData.length} features from FeatureCollection`);
    } else if (Array.isArray(data)) {
      pointsData = data;
      console.log(`Data is an array with ${pointsData.length} items`);
    } else {
      console.warn('Data is not in expected format. Attempting to convert:', typeof data);
      
      // Try to handle unexpected formats
      if (typeof data === 'object') {
        // Maybe it's a single feature?
        if (data.type === 'Feature' && data.geometry) {
          pointsData = [data];
          console.log('Converted single Feature to array');
        } else {
          // Try to extract any array-like data
          const possibleArrays = Object.values(data).filter(val => Array.isArray(val));
          if (possibleArrays.length > 0) {
            // Use the largest array found
            pointsData = possibleArrays.reduce((a, b) => a.length > b.length ? a : b);
            console.log(`Extracted array with ${pointsData.length} items from object`);
          } else {
            // Create a single-item array as last resort
            pointsData = [data];
            console.log('Converted object to single-item array as fallback');
          }
        }
      } else {
        throw new Error(`Unexpected data format: ${typeof data}`);
      }
    }
    
    // Safety check
    if (!Array.isArray(pointsData)) {
      console.error('pointsData is not an array after processing:', pointsData);
      pointsData = [];
    }
    
    // Normalize data
    updateLoadingStatus('Normalizing data structure...', 70);
    normalizeData();
    
    if (pointsData.length === 0) {
      console.error('No valid data points after normalization!');
      updateLoadingStatus('Error: No valid data points were found', 100, true);
      return;
    }
    
    // Update UI
    document.getElementById('totalPoints').textContent = pointsData.length.toLocaleString();
    updateLoadingStatus('Data loaded successfully', 100);
    
    // Setup complete - filter and show data
    isDataLoaded = true;
    
    // Recalculate DemandRank with current weights
    recalculateDemandRank();
    
    // Filter and update map
    filterAndUpdateMap();
    
    console.log('Initial data display complete');
    
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
        // Handle null or undefined features
        if (!feature) return null;
        
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
        
        // Fix common field naming issues
        const demandRank = properties.DemandRank || properties.demand_rank || 0;
        const censusScore = properties.census_score || properties.Census_Score || 0;
        const crashRiskScore = properties.crash_risk_score || properties.Crash_Risk_Score || 0;
        const functionalClassScore = properties.functional_class_score || properties.Functional_Class_Score || 0;
        const schoolProximityScore = properties.school_proximity_score || properties.School_Proximity_Score || 0;
        const trailProximityScore = properties.trail_proximity_score || properties.Trail_Proximity_Score || 0;
        const railProximityScore = properties.rail_proximity_score || properties.Rail_Proximity_Score || 0;
        const busProximityScore = properties.bus_proximity_score || properties.Bus_Proximity_Score || 0;
        
        return {
          ...properties,
          geometry: geometry,
          // Ensure consistent property naming with fallbacks
          DemandRank: demandRank,
          census_score: censusScore,
          crash_risk_score: crashRiskScore,
          functional_class_score: functionalClassScore,
          school_proximity_score: schoolProximityScore,
          trail_proximity_score: trailProximityScore,
          rail_proximity_score: railProximityScore,
          bus_proximity_score: busProximityScore,
          pedestrian_feasible: properties.pedestrian_feasible || properties.Pedestrian_Feasible || 0,
          urban_context: properties.urban_context || properties.Urban_Context || 0,
          Sidewalks: properties.Sidewalks || properties.sidewalks || 0,
          position: position
        };
      });
    } else {
      console.log("Normalizing non-Feature data");
      // Handle other array format
      pointsData = pointsData.map(point => {
        // Handle null or undefined points
        if (!point) return null;
        
        const properties = point.properties || point;
        let position = properties.position;
        
        if (!position) {
          if (point.geometry && point.geometry.coordinates) {
            position = point.geometry.coordinates;
          } else if (properties.longitude != null && properties.latitude != null) {
            position = [properties.longitude, properties.latitude];
          } else if (properties.lng != null && properties.lat != null) {
            position = [properties.lng, properties.lat];
          }
        }
        
        // Fix common field naming issues
        const demandRank = properties.DemandRank || properties.demand_rank || 0;
        
        return {
          ...properties,
          // Ensure consistent property naming
          DemandRank: demandRank,
          census_score: properties.census_score || 0,
          crash_risk_score: properties.crash_risk_score || 0,
          functional_class_score: properties.functional_class_score || 0,
          school_proximity_score: properties.school_proximity_score || 0,
          trail_proximity_score: properties.trail_proximity_score || 0,
          rail_proximity_score: properties.rail_proximity_score || 0,
          bus_proximity_score: properties.bus_proximity_score || 0,
          pedestrian_feasible: properties.pedestrian_feasible || 0,
          urban_context: properties.urban_context || 0,
          Sidewalks: properties.Sidewalks || properties.sidewalks || 0,
          position: position
        };
      });
    }
  }
  
  // Remove any null entries created during processing
  pointsData = pointsData.filter(point => point !== null);
  
  // Filter out any entries without valid positions
  const initialCount = pointsData.length;
  pointsData = pointsData.filter(point => 
    point.position && Array.isArray(point.position) && point.position.length >= 2
  );
  console.log(`Normalized ${pointsData.length} data points (filtered out ${initialCount - pointsData.length} invalid points)`);
  
  // Log a sample point for debugging
  if (pointsData.length > 0) {
    console.log("Sample normalized point:", pointsData[0]);
  } else {
    console.error("No valid data points after normalization!");
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
  if (!deckOverlay) {
    console.error('deck.gl overlay not initialized');
    return;
  }
  
  if (!filteredData) {
    console.log('No filtered data available to display');
    deckOverlay.setProps({ layers: [] });
    return;
  }
  
  if (filteredData.length === 0) {
    console.log('Filtered data is empty, nothing to display');
    // Clear the map layers but keep the overlay
    deckOverlay.setProps({ layers: [] });
    return;
  }
  
  // Log summary for debugging
  console.log(`Preparing to display ${filteredData.length} points on the map`);
  
  // Validate data points before rendering
  const validData = filteredData.filter(point => {
    if (!point.position || !Array.isArray(point.position) || point.position.length < 2) {
      return false;
    }
    // Validate latitude/longitude values
    const lng = point.position[0];
    const lat = point.position[1];
    return !isNaN(lat) && !isNaN(lng) && 
           lat >= -90 && lat <= 90 && 
           lng >= -180 && lng <= 180;
  });
  
  if (validData.length < filteredData.length) {
    console.warn(`Filtered out ${filteredData.length - validData.length} points with invalid positions`);
  }
  
  if (validData.length === 0) {
    console.error('No valid points to display after position filtering');
    deckOverlay.setProps({ layers: [] });
    return;
  }
  
  // Create datasets for different visualizations
  let roadData = validData;
  let sidewalkGaps = [];
  let crashSegments = [];
  
  // Get current view bounds to optimize rendering
  const bounds = map.getBounds();
  const inView = point => {
    const lat = point.position[1];
    const lng = point.position[0];
    return lat >= bounds.getSouthWest().lat() && 
           lat <= bounds.getNorthEast().lat() && 
           lng >= bounds.getSouthWest().lng() && 
           lng <= bounds.getNorthEast().lng();
  };
  
  // Limit points if too many to render efficiently
  const maxPointsToRender = 100000;
  let visiblePoints;
  
  if (roadData.length > maxPointsToRender) {
    // If too many points, prioritize visible ones and sample others
    const visibleData = roadData.filter(inView);
    console.log(`${visibleData.length} points in current view`);
    
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
  } else {
    visiblePoints = roadData;
  }
  
  // Check for special highlighting
  const highlightSidewalkGaps = document.getElementById('highlight-sidewalk-gaps')?.checked;
  const highlightCrashSegments = document.getElementById('highlight-crash-segments')?.checked;
  
  // Split data into categories for visualization
  if (highlightSidewalkGaps || highlightCrashSegments) {
    // Create a temporary array for the main road data
    const filteredRoadData = [];
    
    // Classify each point
    for (const point of visiblePoints) {
      const isSidewalkGap = point.pedestrian_feasible === 1 && point.Sidewalks === 0;
      const isCrashSegment = point.crash_risk_score === 10;
      
      if (highlightSidewalkGaps && isSidewalkGap) {
        sidewalkGaps.push(point);
      } else if (highlightCrashSegments && isCrashSegment) {
        crashSegments.push(point);
      } else {
        filteredRoadData.push(point);
      }
    }
    
    roadData = filteredRoadData;
  } else {
    roadData = visiblePoints;
  }
  
  console.log(`Final display counts: main=${roadData.length}, sidewalk gaps=${sidewalkGaps.length}, crash segments=${crashSegments.length}`);
  
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
  try {
    deckOverlay.setProps({ layers });
    console.log('Map layers updated successfully');
  } catch (error) {
    console.error('Error updating deck.gl layers:', error);
  }
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