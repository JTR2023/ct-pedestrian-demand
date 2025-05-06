# Connecticut Pedestrian DemandRank Setup Guide

## Project Status

We've created a complete web application framework for visualizing your Connecticut Pedestrian DemandRank model. The application includes:

- Interactive map interface using deck.gl and Google Maps
- Weight adjustment for all 7 model components
- Filtering capabilities (pedestrian feasible, urban context, sidewalks)
- Data export functionality
- Google Cloud integration

## Next Steps

### 1. Complete GDAL Installation

The GDAL tools are needed to convert your GeoPackage to GeoJSON. Installation was started with:

```bash
brew install gdal
```

This may take some time to complete. You can check if it's finished by running:

```bash
which ogr2ogr
```

If it returns a path, GDAL is installed.

### 2. Convert GeoPackage to GeoJSON

Once GDAL is installed, you can convert your GeoPackage:

```bash
# Using our script
node data-conversion.js

# Or directly with ogr2ogr
ogr2ogr -f GeoJSON data/demandrank.geojson data/source.gpkg
```

For your large dataset (500,000+ points), we'll need to split it into chunks:

```bash
# Create 10 chunks of approximately 50,000 features each
for i in {0..9}; do
  ogr2ogr -f GeoJSON data/demandrank_$i.geojson data/source.gpkg -sql "SELECT * FROM layer_name LIMIT 50000 OFFSET $(($i * 50000))"
done
```

Replace "layer_name" with the actual layer name from your GeoPackage.

### 3. Configure Google Maps API

You'll need a Google Maps API key:

1. Go to https://console.cloud.google.com/
2. Create a new project or select existing one
3. Enable Maps JavaScript API and Street View API
4. Create API key
5. Update the key in `config.js`

### 4. Set Up Google Cloud Storage

For hosting the application and data:

```bash
# Install Google Cloud SDK if not already installed
# See: https://cloud.google.com/sdk/docs/install

# Initialize and log in
gcloud init

# Create a bucket (replace 'your-bucket-name' with desired name)
node gcs-setup.js your-bucket-name
```

### 5. Deploy Application

```bash
# After setting up your bucket in config.js
npm run deploy
```

## Testing Locally

Once GDAL is installed and data is converted:

```bash
# Start the local development server
npm start

# Access the application at http://localhost:8080
```

## File Descriptions

- `index.html` - Main application HTML
- `app.js` - Core application logic
- `config.js` - Configuration settings
- `styles.css` - Application styling
- `data-conversion.js` - Utility for converting GeoPackage
- `gcs-setup.js` - Google Cloud Storage setup utility
- `demo.html` - Simple demo with sample data