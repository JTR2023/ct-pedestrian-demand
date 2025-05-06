// Configuration file for the Connecticut Pedestrian DemandRank application
const CONFIG = {
  // Google Cloud Storage configuration
  storage: {
    bucketName: 'ct-pedestrian-demand-data',
    dataPath: 'data/',
    tilesetPath: 'tilesets/',
  },
  
  // Google Maps API configuration
  maps: {
    apiKey: 'AIzaSyDRG2xII3nH7HJkp08TKpssRgLkf0OjMBQ',
    center: {
      lat: 41.6032, // Connecticut center latitude
      lng: -72.7266 // Connecticut center longitude
    },
    zoom: 8,
    maxZoom: 18
  },
  
  // Demand Rank scoring
  demandRank: {
    minPossibleScore: 10,
    maxPossibleScore: 76,
    defaultWeights: {
      census: 0.20,
      crash: 0.20,
      funcClass: 0.20,
      school: 0.10,
      trail: 0.10,
      rail: 0.10,
      bus: 0.10
    },
    // Color scheme - red gradient from dark to light
    colors: [
      { min: 70, max: 100, color: '#7f0000', label: 'Very High' }, // Dark red
      { min: 60, max: 70, color: '#b71c1c', label: 'High' },
      { min: 50, max: 60, color: '#d32f2f', label: 'Medium-High' },
      { min: 40, max: 50, color: '#e53935', label: 'Medium' },
      { min: 30, max: 40, color: '#f44336', label: 'Medium-Low' },
      { min: 20, max: 30, color: '#ef5350', label: 'Low' },
      { min: 0, max: 20, color: '#ffcdd2', label: 'Very Low' }  // Light red
    ],
    sidewalkColor: '#4caf50', // Green for existing sidewalks
  },
  
  // Data chunking for performance
  dataChunking: {
    // Number of features per chunk
    chunkSize: 10000,
    // Maximum features to load at once based on zoom level
    zoomLevelThresholds: [
      { zoom: 8, maxFeatures: 5000 },
      { zoom: 10, maxFeatures: 10000 },
      { zoom: 12, maxFeatures: 25000 },
      { zoom: 14, maxFeatures: 50000 },
      { zoom: 16, maxFeatures: 100000 }
    ]
  },
  
  // File paths and URL patterns for data
  data: {
    // URL pattern for chunked GeoJSON files 
    // e.g. 'data/demandrank_0.geojson', 'data/demandrank_1.geojson', etc.
    geoJsonChunkPattern: 'data/demandrank_{chunk}.geojson',
    
    // Alternative GCS URL pattern
    gcsUrlPattern: 'https://storage.googleapis.com/{bucket}/data/demandrank_{chunk}.geojson',
    
    // Data fields mapping to match your GeoPackage schema
    fields: {
      id: 'id', // Unique identifier
      demandRank: 'demand_rank',
      censusScore: 'census_score',
      crashRiskScore: 'crash_risk_score',
      functionalClassScore: 'functional_class_score',
      schoolProximityScore: 'school_proximity_score',
      trailProximityScore: 'trail_proximity_score',
      railProximityScore: 'rail_proximity_score',
      busProximityScore: 'bus_proximity_score',
      pedestrianFeasible: 'pedestrian_feasible',
      urbanContext: 'urban_context',
      sidewalks: 'sidewalks',
      geometry: 'geometry' // GeoJSON geometry object
    }
  }
};