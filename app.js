// Global variables
let map;
let panorama;
let deckOverlay;
let dataChunks = [];
let activeChunks = [];
let currentWeights = { ...CONFIG.demandRank.defaultWeights };
let filteredData = [];
let isDataLoaded = false;

// DOM elements
const weightControls = {
  census: document.getElementById('census-weight'),
  crash: document.getElementById('crash-weight'),
  funcClass: document.getElementById('func-class-weight'),
  school: document.getElementById('school-weight'),
  trail: document.getElementById('trail-weight'),
  rail: document.getElementById('rail-weight'),
  bus: document.getElementById('bus-weight')
};

const filters = {
  pedestrianFeasible: document.getElementById('pedestrian-feasible'),
  urbanContext: document.getElementById('urban-context'),
  existingSidewalks: document.getElementById('existing-sidewalks'),
  showStreetView: document.getElementById('show-street-view')
};

const scoreFilters = {
  minScore: document.getElementById('min-score'),
  maxScore: document.getElementById('max-score')
};

// Initialize the map and deck.gl overlay
function initMap() {
  // Create Google Map
  map = new google.maps.Map(document.getElementById('map'), {
    center: CONFIG.maps.center,
    zoom: CONFIG.maps.zoom,
    maxZoom: CONFIG.maps.maxZoom,
    mapTypeId: google.maps.MapTypeId.ROADMAP,
    mapTypeControl: true,
    streetViewControl: false // We'll add our own Street View control
  });
  
  // Create Street View panorama
  panorama = new google.maps.StreetViewPanorama(
    document.getElementById('street-view'),
    {
      position: CONFIG.maps.center,
      pov: { heading: 0, pitch: 0 },
      visible: false
    }
  );
  
  // Toggle Street View when clicking on the map
  map.addListener('click', function(event) {
    if (filters.showStreetView.checked) {
      const streetViewService = new google.maps.StreetViewService();
      
      streetViewService.getPanorama({
        location: event.latLng,
        radius: 50 // meters
      }, function(data, status) {
        if (status === google.maps.StreetViewStatus.OK) {
          document.getElementById('street-view').classList.remove('hidden');
          panorama.setPosition(event.latLng);
          panorama.setVisible(true);
        } else {
          alert('No Street View available at this location');
        }
      });
    }
  });
  
  // Initialize deck.gl overlay
  initDeckGL();
  
  // Add legend
  createLegend();
  
  // Load data
  loadDataChunks();
  
  // Set up event listeners
  setupEventListeners();
}

// Initialize deck.gl overlay on the map
function initDeckGL() {
  // Create deck.gl overlay for Google Maps
  deckOverlay = new deck.GoogleMapsOverlay({
    layers: []
  });
  
  // Add overlay to map
  deckOverlay.setMap(map);
}

// Create map legend
function createLegend() {
  const legend = document.createElement('div');
  legend.className = 'legend';
  legend.style.position = 'absolute';
  legend.style.bottom = '30px';
  legend.style.right = '10px';
  
  let legendContent = '<div class="legend-title">DemandRank Score</div>';
  
  // Add color blocks for each range
  CONFIG.demandRank.colors.forEach(colorRange => {
    legendContent += `
      <div>
        <i style="background-color: ${colorRange.color}"></i>
        ${colorRange.min}-${colorRange.max} (${colorRange.label})
      </div>
    `;
  });
  
  // Add sidewalk entry if enabled
  legendContent += `
    <div id="sidewalk-legend" class="hidden">
      <div class="legend-title" style="margin-top: 10px;">Infrastructure</div>
      <div>
        <i style="background-color: ${CONFIG.demandRank.sidewalkColor}"></i>
        Existing Sidewalks
      </div>
    </div>
  `;
  
  legend.innerHTML = legendContent;
  document.getElementById('map').appendChild(legend);
}

// Update sidewalk legend visibility
function updateSidewalkLegend() {
  const sidewalkLegend = document.getElementById('sidewalk-legend');
  if (filters.existingSidewalks.checked) {
    sidewalkLegend.classList.remove('hidden');
  } else {
    sidewalkLegend.classList.add('hidden');
  }
}

// Set up all event listeners
function setupEventListeners() {
  // Weight sliders
  Object.entries(weightControls).forEach(([key, control]) => {
    const valueDisplay = control.nextElementSibling;
    
    control.addEventListener('input', () => {
      const value = parseFloat(control.value);
      valueDisplay.textContent = `${Math.round(value * 100)}%`;
      currentWeights[key] = value;
      updateTotalWeight();
    });
  });
  
  // Score range filters
  scoreFilters.minScore.addEventListener('input', () => {
    const value = parseInt(scoreFilters.minScore.value);
    document.getElementById('min-score-value').textContent = value;
    
    // Ensure min doesn't exceed max
    if (value > parseInt(scoreFilters.maxScore.value)) {
      scoreFilters.maxScore.value = value;
      document.getElementById('max-score-value').textContent = value;
    }
  });
  
  scoreFilters.maxScore.addEventListener('input', () => {
    const value = parseInt(scoreFilters.maxScore.value);
    document.getElementById('max-score-value').textContent = value;
    
    // Ensure max doesn't go below min
    if (value < parseInt(scoreFilters.minScore.value)) {
      scoreFilters.minScore.value = value;
      document.getElementById('min-score-value').textContent = value;
    }
  });
  
  // Filter checkboxes
  Object.values(filters).forEach(filter => {
    filter.addEventListener('change', () => {
      if (filter === filters.existingSidewalks) {
        updateSidewalkLegend();
      }
      
      if (filter === filters.showStreetView) {
        if (!filter.checked) {
          document.getElementById('street-view').classList.add('hidden');
          panorama.setVisible(false);
        }
      }
      
      if (isDataLoaded) {
        applyFiltersAndUpdate();
      }
    });
  });
  
  // Recalculate button
  document.getElementById('recalculate').addEventListener('click', () => {
    if (isDataLoaded) {
      recalculateDemandRank();
      applyFiltersAndUpdate();
    }
  });
  
  // Export buttons
  document.getElementById('export-csv').addEventListener('click', exportCSV);
  document.getElementById('export-geojson').addEventListener('click', exportGeoJSON);
  
  // Map zoom changed - load appropriate data chunks
  map.addListener('zoom_changed', debounce(() => {
    if (isDataLoaded) {
      loadAppropriateChunks();
    }
  }, 300));
  
  // Map bounds changed - load appropriate data chunks
  map.addListener('bounds_changed', debounce(() => {
    if (isDataLoaded) {
      loadAppropriateChunks();
    }
  }, 300));
}

// Update total weight display
function updateTotalWeight() {
  const total = Object.values(currentWeights)
    .reduce((sum, weight) => sum + weight, 0);
  
  const totalDisplay = document.getElementById('total-weight');
  totalDisplay.textContent = `${Math.round(total * 100)}%`;
  
  // Highlight if not equal to 100%
  if (Math.abs(total - 1) > 0.01) {
    totalDisplay.style.color = 'red';
  } else {
    totalDisplay.style.color = 'inherit';
  }
}

// Load data chunks based on Google Cloud Storage
async function loadDataChunks() {
  try {
    // For development, we can use a simple approach with a fixed number of chunks
    // In production, you would use Firebase or direct GCS access to list available chunks
    const totalChunks = 10; // Adjust based on your data size
    
    let loadedChunks = 0;
    const loadingPromises = [];
    
    // Start loading all chunks
    for (let i = 0; i < totalChunks; i++) {
      const chunkPromise = fetch(CONFIG.data.geoJsonChunkPattern.replace('{chunk}', i))
        .then(response => {
          if (!response.ok) {
            if (response.status === 404) {
              // This is OK - we might have reached the end of chunks
              return null;
            }
            throw new Error(`Failed to load data chunk ${i}: ${response.status}`);
          }
          return response.json();
        })
        .then(data => {
          if (data) {
            dataChunks.push({
              index: i,
              data: data.features || data,
              bounds: calculateBounds(data.features || data)
            });
            loadedChunks++;
          }
          // Update loading progress
          updateLoadingProgress(loadedChunks, totalChunks);
        })
        .catch(error => {
          console.error(`Error loading chunk ${i}:`, error);
          // Continue with other chunks
          return null;
        });
      
      loadingPromises.push(chunkPromise);
    }
    
    // Wait for all chunks to be processed
    await Promise.all(loadingPromises);
    
    // Initialize the app with the loaded data
    isDataLoaded = true;
    recalculateDemandRank();
    loadAppropriateChunks();
    
  } catch (error) {
    console.error('Error loading data chunks:', error);
    alert('Failed to load data. See console for details.');
  }
}

// Update loading progress indicator
function updateLoadingProgress(loaded, total) {
  // You could implement a loading bar here
  console.log(`Loading data: ${loaded}/${total} chunks`);
}

// Calculate geographic bounds for a set of features
function calculateBounds(features) {
  if (!features || features.length === 0) return null;
  
  let minLat = Infinity;
  let maxLat = -Infinity;
  let minLng = Infinity;
  let maxLng = -Infinity;
  
  features.forEach(feature => {
    // This assumes point geometries - adjust for lines/polygons as needed
    const coords = feature.geometry.coordinates;
    
    if (feature.geometry.type === 'Point') {
      minLng = Math.min(minLng, coords[0]);
      maxLng = Math.max(maxLng, coords[0]);
      minLat = Math.min(minLat, coords[1]);
      maxLat = Math.max(maxLat, coords[1]);
    } 
    else if (feature.geometry.type === 'LineString') {
      coords.forEach(point => {
        minLng = Math.min(minLng, point[0]);
        maxLng = Math.max(maxLng, point[0]);
        minLat = Math.min(minLat, point[1]);
        maxLat = Math.max(maxLat, point[1]);
      });
    }
    // Add handling for other geometry types as needed
  });
  
  return {
    north: maxLat,
    south: minLat,
    east: maxLng,
    west: minLng
  };
}

// Load chunks that are relevant to the current map view
function loadAppropriateChunks() {
  const currentZoom = map.getZoom();
  const currentBounds = map.getBounds();
  
  if (!currentBounds) return;
  
  // Find zoom threshold
  const zoomThreshold = CONFIG.dataChunking.zoomLevelThresholds.find(
    threshold => currentZoom <= threshold.zoom
  ) || CONFIG.dataChunking.zoomLevelThresholds[CONFIG.dataChunking.zoomLevelThresholds.length - 1];
  
  // Reset active chunks
  activeChunks = [];
  
  // Calculate which chunks intersect the current view
  const intersectingChunks = dataChunks.filter(chunk => {
    if (!chunk.bounds) return false;
    
    // Check if chunk bounds intersect with map bounds
    return !(
      chunk.bounds.west > currentBounds.getNorthEast().lng() ||
      chunk.bounds.east < currentBounds.getSouthWest().lng() ||
      chunk.bounds.north < currentBounds.getSouthWest().lat() ||
      chunk.bounds.south > currentBounds.getNorthEast().lat()
    );
  });
  
  // Sort by distance to center of view for priority
  const center = map.getCenter();
  intersectingChunks.sort((a, b) => {
    const aCenterLat = (a.bounds.north + a.bounds.south) / 2;
    const aCenterLng = (a.bounds.east + a.bounds.west) / 2;
    const bCenterLat = (b.bounds.north + b.bounds.south) / 2;
    const bCenterLng = (b.bounds.east + b.bounds.west) / 2;
    
    const aDistance = Math.sqrt(
      Math.pow(aCenterLat - center.lat(), 2) + 
      Math.pow(aCenterLng - center.lng(), 2)
    );
    
    const bDistance = Math.sqrt(
      Math.pow(bCenterLat - center.lat(), 2) + 
      Math.pow(bCenterLng - center.lng(), 2)
    );
    
    return aDistance - bDistance;
  });
  
  // Limit number of active chunks based on zoom level
  const maxFeatures = zoomThreshold.maxFeatures;
  let featureCount = 0;
  
  for (const chunk of intersectingChunks) {
    if (featureCount >= maxFeatures) break;
    
    activeChunks.push(chunk);
    featureCount += chunk.data.length;
  }
  
  // Apply filters and update visualization
  applyFiltersAndUpdate();
}

// Recalculate DemandRank for all features using current weights
function recalculateDemandRank() {
  dataChunks.forEach(chunk => {
    chunk.data.forEach(feature => {
      const props = feature.properties;
      
      // Calculate new demand rank based on current weights
      const newDemandRank = 
        currentWeights.census * props[CONFIG.data.fields.censusScore] +
        currentWeights.crash * props[CONFIG.data.fields.crashRiskScore] +
        currentWeights.funcClass * props[CONFIG.data.fields.functionalClassScore] +
        currentWeights.school * props[CONFIG.data.fields.schoolProximityScore] +
        currentWeights.trail * props[CONFIG.data.fields.trailProximityScore] +
        currentWeights.rail * props[CONFIG.data.fields.railProximityScore] +
        currentWeights.bus * props[CONFIG.data.fields.busProximityScore];
      
      // Store original and recalculated scores
      if (!props.hasOwnProperty('original_demand_rank')) {
        props.original_demand_rank = props[CONFIG.data.fields.demandRank];
      }
      
      props[CONFIG.data.fields.demandRank] = newDemandRank;
    });
  });
}

// Apply filters to active chunks and update visualization
function applyFiltersAndUpdate() {
  const minScore = parseInt(scoreFilters.minScore.value);
  const maxScore = parseInt(scoreFilters.maxScore.value);
  
  // Reset filtered data
  filteredData = [];
  
  // Apply filters to active chunks
  activeChunks.forEach(chunk => {
    const filtered = chunk.data.filter(feature => {
      const props = feature.properties;
      const score = props[CONFIG.data.fields.demandRank];
      
      // Apply score range filter
      if (score < minScore || score > maxScore) {
        return false;
      }
      
      // Apply pedestrian feasible filter
      if (filters.pedestrianFeasible.checked && 
          props[CONFIG.data.fields.pedestrianFeasible] !== 1) {
        return false;
      }
      
      // Apply urban context filter
      if (filters.urbanContext.checked && 
          props[CONFIG.data.fields.urbanContext] !== 1) {
        return false;
      }
      
      return true;
    });
    
    filteredData = filteredData.concat(filtered);
  });
  
  // Update deck.gl visualization
  updateDeckGLLayers();
}

// Update deck.gl layers with filtered data
function updateDeckGLLayers() {
  if (!deckOverlay || filteredData.length === 0) return;
  
  // Create separate datasets for sidewalks and regular road segments
  let sidewalkData = [];
  let roadData = [];
  
  if (filters.existingSidewalks.checked) {
    // Split data into sidewalks and roads
    filteredData.forEach(feature => {
      if (feature.properties[CONFIG.data.fields.sidewalks] === 1) {
        sidewalkData.push(feature);
      } else {
        roadData.push(feature);
      }
    });
  } else {
    // All features treated as roads
    roadData = filteredData;
  }
  
  // Create layers
  const layers = [];
  
  // Road segments layer
  if (roadData.length > 0) {
    layers.push(
      new deck.GeoJsonLayer({
        id: 'road-layer',
        data: {
          type: 'FeatureCollection',
          features: roadData
        },
        pickable: true,
        stroked: false,
        filled: true,
        extruded: false,
        lineWidthScale: 20,
        lineWidthMinPixels: 2,
        lineWidthMaxPixels: 5,
        lineJointRounded: true,
        getLineColor: feature => getColorForScore(feature.properties[CONFIG.data.fields.demandRank]),
        getLineWidth: 5,
        onHover: info => handleHover(info)
      })
    );
  }
  
  // Sidewalk layer
  if (sidewalkData.length > 0) {
    layers.push(
      new deck.GeoJsonLayer({
        id: 'sidewalk-layer',
        data: {
          type: 'FeatureCollection',
          features: sidewalkData
        },
        pickable: true,
        stroked: false,
        filled: true,
        extruded: false,
        lineWidthScale: 20,
        lineWidthMinPixels: 2,
        lineWidthMaxPixels: 5,
        lineJointRounded: true,
        getLineColor: [76, 175, 80], // Green color for sidewalks
        getLineWidth: 5,
        onHover: info => handleHover(info)
      })
    );
  }
  
  // Update deck.gl overlay with new layers
  deckOverlay.setProps({
    layers: layers
  });
}

// Get color for a DemandRank score
function getColorForScore(score) {
  // Find the color range for this score
  const colorRange = CONFIG.demandRank.colors.find(
    range => score >= range.min && score <= range.max
  ) || CONFIG.demandRank.colors[CONFIG.demandRank.colors.length - 1];
  
  // Convert hex color to RGB array
  return hexToRgb(colorRange.color);
}

// Convert hex color to RGB array
function hexToRgb(hex) {
  const result = /^#?([a-f\\d]{2})([a-f\\d]{2})([a-f\\d]{2})$/i.exec(hex);
  return result ? [
    parseInt(result[1], 16),
    parseInt(result[2], 16),
    parseInt(result[3], 16)
  ] : [0, 0, 0];
}

// Handle hover events on features
function handleHover(info) {
  // Show info tooltip on hover
  if (info.object) {
    const props = info.object.properties;
    
    // Create tooltip content
    const tooltipContent = `
      <div style="padding: 10px; background: white; border-radius: 5px; box-shadow: 0 0 10px rgba(0,0,0,0.3);">
        <h3>DemandRank: ${props[CONFIG.data.fields.demandRank].toFixed(2)}</h3>
        <p><strong>Census Score:</strong> ${props[CONFIG.data.fields.censusScore]}</p>
        <p><strong>Crash Risk Score:</strong> ${props[CONFIG.data.fields.crashRiskScore]}</p>
        <p><strong>Pedestrian Feasible:</strong> ${props[CONFIG.data.fields.pedestrianFeasible] ? 'Yes' : 'No'}</p>
        <p><strong>Urban Context:</strong> ${props[CONFIG.data.fields.urbanContext] ? 'Urban' : 'Rural'}</p>
        <p><strong>Existing Sidewalks:</strong> ${props[CONFIG.data.fields.sidewalks] ? 'Yes' : 'No'}</p>
      </div>
    `;
    
    // Show tooltip (in a real implementation, you would use a tooltip library or custom elements)
    console.log(tooltipContent);
  }
}

// Export filtered data as CSV
function exportCSV() {
  if (filteredData.length === 0) {
    alert('No data to export. Please adjust your filters to show some data.');
    return;
  }
  
  // Create CSV headers
  const fields = CONFIG.data.fields;
  const headers = [
    'demand_rank',
    'census_score',
    'crash_risk_score',
    'functional_class_score',
    'school_proximity_score',
    'trail_proximity_score',
    'rail_proximity_score',
    'bus_proximity_score',
    'pedestrian_feasible',
    'urban_context',
    'sidewalks'
  ];
  
  // Create CSV content
  let csvContent = 'data:text/csv;charset=utf-8,' + headers.join(',') + '\n';
  
  // Add data rows
  filteredData.forEach(feature => {
    const props = feature.properties;
    const row = headers.map(header => {
      const value = props[fields[camelCaseToSnakeCase(header)]];
      return typeof value === 'undefined' ? '' : value;
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

// Export filtered data as GeoJSON
function exportGeoJSON() {
  if (filteredData.length === 0) {
    alert('No data to export. Please adjust your filters to show some data.');
    return;
  }
  
  // Create GeoJSON object
  const geoJson = {
    type: 'FeatureCollection',
    features: filteredData
  };
  
  // Convert to string
  const geoJsonString = JSON.stringify(geoJson);
  
  // Download GeoJSON
  const blob = new Blob([geoJsonString], {type: 'application/json'});
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', 'pedestrian_demandrank.geojson');
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

// Convert camelCase to snake_case
function camelCaseToSnakeCase(str) {
  return str.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
}

// Helper function for debouncing events
function debounce(func, wait) {
  let timeout;
  return function(...args) {
    const context = this;
    clearTimeout(timeout);
    timeout = setTimeout(() => func.apply(context, args), wait);
  };
}

// Load app when DOM is ready
window.addEventListener('DOMContentLoaded', function() {
  // Custom initialization can be performed here before Google Maps loads
});