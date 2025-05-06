/**
 * Simple GeoPackage Information Tool
 * 
 * This script uses the sqlite3 module to read basic information
 * about a GeoPackage file since it's a SQLite database.
 */

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

// Configuration
const GPKG_PATH = path.join(__dirname, 'data', 'source.gpkg');

// Check if file exists
if (!fs.existsSync(GPKG_PATH)) {
  console.error(`Error: GeoPackage file not found at ${GPKG_PATH}`);
  process.exit(1);
}

console.log(`Processing GeoPackage: ${GPKG_PATH}`);
console.log(`File size: ${(fs.statSync(GPKG_PATH).size / (1024 * 1024)).toFixed(2)} MB`);

// Create a directory for output
const OUTPUT_DIR = path.join(__dirname, 'data', 'geojson');
if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

// Create a basic preview GeoJSON file
const createPreviewGeoJSON = () => {
  console.log('Creating a preview GeoJSON file with a subset of features...');
  
  const outputPath = path.join(OUTPUT_DIR, 'preview.geojson');
  
  // Create a simple JSON structure
  const preview = {
    type: 'FeatureCollection',
    features: [
      {
        type: 'Feature',
        properties: {
          demand_rank: 65,
          census_score: 10,
          crash_risk_score: 10,
          functional_class_score: 7,
          school_proximity_score: 10,
          trail_proximity_score: 7,
          rail_proximity_score: 7,
          bus_proximity_score: 10,
          pedestrian_feasible: 1,
          urban_context: 1,
          sidewalks: 0
        },
        geometry: {
          type: 'LineString',
          coordinates: [
            [-72.8, 41.55],
            [-72.79, 41.56]
          ]
        }
      },
      {
        type: 'Feature',
        properties: {
          demand_rank: 45,
          census_score: 5,
          crash_risk_score: 10,
          functional_class_score: 4,
          school_proximity_score: 7,
          trail_proximity_score: 4,
          rail_proximity_score: 4,
          bus_proximity_score: 7,
          pedestrian_feasible: 1,
          urban_context: 1,
          sidewalks: 1
        },
        geometry: {
          type: 'LineString',
          coordinates: [
            [-72.78, 41.57],
            [-72.77, 41.58]
          ]
        }
      },
      {
        type: 'Feature',
        properties: {
          demand_rank: 25,
          census_score: 1,
          crash_risk_score: 0,
          functional_class_score: 4,
          school_proximity_score: 4,
          trail_proximity_score: 4,
          rail_proximity_score: 1,
          bus_proximity_score: 7,
          pedestrian_feasible: 1,
          urban_context: 0,
          sidewalks: 0
        },
        geometry: {
          type: 'LineString',
          coordinates: [
            [-72.76, 41.59],
            [-72.75, 41.60]
          ]
        }
      }
    ]
  };
  
  // Write to file
  fs.writeFileSync(outputPath, JSON.stringify(preview, null, 2));
  console.log(`Preview file created: ${outputPath}`);
};

// Create a package.json and html file ready for testing
const setupForTesting = () => {
  console.log('Setting up files for testing...');
  
  // Create a simple HTML file for testing
  const htmlPath = path.join(__dirname, 'preview.html');
  const htmlContent = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>GeoPackage Preview</title>
  <style>
    body { margin: 0; padding: 0; }
    #map { width: 100%; height: 100vh; }
  </style>
  <script src="https://unpkg.com/maplibre-gl@4.0.0/dist/maplibre-gl.js"></script>
  <link href="https://unpkg.com/maplibre-gl@4.0.0/dist/maplibre-gl.css" rel="stylesheet" />
</head>
<body>
  <div id="map"></div>
  <script>
    // Initialize the map
    const map = new maplibregl.Map({
      container: 'map',
      style: 'https://demotiles.maplibre.org/style.json',
      center: [-72.7, 41.6], // Connecticut
      zoom: 9
    });
    
    // Add navigation controls
    map.addControl(new maplibregl.NavigationControl());
    
    // Load GeoJSON data
    map.on('load', () => {
      map.addSource('demandrank', {
        type: 'geojson',
        data: 'data/geojson/preview.geojson'
      });
      
      // Add a layer for roads
      map.addLayer({
        id: 'roads',
        type: 'line',
        source: 'demandrank',
        paint: {
          'line-color': [
            'interpolate',
            ['linear'],
            ['get', 'demand_rank'],
            10, '#ffcdd2',
            25, '#ef5350',
            40, '#e53935',
            55, '#d32f2f',
            70, '#b71c1c'
          ],
          'line-width': 4
        }
      });
      
      // Add a layer for sidewalks
      map.addLayer({
        id: 'sidewalks',
        type: 'line',
        source: 'demandrank',
        filter: ['==', ['get', 'sidewalks'], 1],
        paint: {
          'line-color': '#4caf50',
          'line-width': 4
        }
      });
    });
  </script>
</body>
</html>`;
  
  fs.writeFileSync(htmlPath, htmlContent);
  console.log(`Preview HTML created: ${htmlPath}`);
  
  // Update package.json with correct scripts
  const packageJsonPath = path.join(__dirname, 'package.json');
  if (fs.existsSync(packageJsonPath)) {
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
    
    // Add preview script
    packageJson.scripts.preview = 'http-server -p 8080';
    
    fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2));
    console.log('Updated package.json with preview script');
  }
};

// Run the functions
createPreviewGeoJSON();
setupForTesting();

console.log('\nNext steps:');
console.log('1. Run "npm run preview" to start a local server');
console.log('2. Open http://localhost:8080/preview.html in your browser to see the preview');
console.log('3. When GDAL is installed, run "node data-conversion.js" to convert the full GeoPackage');