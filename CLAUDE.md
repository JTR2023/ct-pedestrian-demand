# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview
This repository contains a web application for visualizing the Connecticut Pedestrian DemandRank model. The application uses deck.gl with Google Maps to display and interact with a large geospatial dataset (500,000+ mile points) from a GeoPackage.

## Commands

### Installation
```bash
# Install dependencies
npm install

# Install Google Cloud SDK if needed (for deployment)
# See: https://cloud.google.com/sdk/docs/install
```

### Data Conversion
```bash
# Convert GeoPackage to chunked GeoJSON files
node data-conversion.js data/source.gpkg data/ 10000

# Alternative: Convert using ogr2ogr directly
ogr2ogr -f GeoJSON data/demandrank_0.geojson data/source.gpkg -sql "SELECT * FROM layer_name LIMIT 10000"
```

### Development
```bash
# Start local development server
npm start
```

### Deployment
```bash
# Configure Google Cloud Storage
node gcs-setup.js your-bucket-name

# Deploy to Google Cloud Storage
npm run deploy
```

## Key Files

- `index.html` - Main HTML file with UI structure
- `styles.css` - CSS styles for the application
- `app.js` - Main JavaScript application code
- `config.js` - Configuration settings for the application
- `data-conversion.js` - Utility to convert GeoPackage to GeoJSON chunks
- `gcs-setup.js` - Utility to set up Google Cloud Storage bucket

## Implementation Notes

1. **Handling Large Datasets**: The application chunks the data into smaller pieces (10,000 features per file) to optimize loading and rendering performance.

2. **Configuration**: Update `config.js` with your Google Maps API key and Google Cloud Storage bucket information.

3. **Data Format**: The application expects GeoJSON data with properties matching the Connecticut Pedestrian DemandRank model (census_score, crash_risk_score, etc.).

4. **Model Weights**: The application allows adjusting weights for:
   - Census score (20%)
   - Crash risk score (20%)
   - Functional class score (20%)
   - School proximity score (10%)
   - Trail proximity score (10%)
   - Rail proximity score (10%)
   - Bus proximity score (10%)