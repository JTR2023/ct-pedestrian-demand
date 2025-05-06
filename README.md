# Connecticut Pedestrian DemandRank Interactive Map

## Overview
This web application visualizes Connecticut's Pedestrian DemandRank model, allowing users to interact with and customize the prioritization of roadway segments for pedestrian infrastructure improvements on state roads.

## Features
- Interactive map visualization of 500,000+ mile points across Connecticut
- Google Street View integration
- Adjustable model weight parameters with sliders
- Custom filtering options:
  - Pedestrian feasible areas filter
  - Urban context filter
  - Existing sidewalks toggle
  - Score range filters
- Red color gradient visualization based on demand scores
- Data export as CSV or GeoJSON
- Optimized for large datasets using deck.gl
- Designed for Google Cloud hosting

## Data Structure
The application uses the Connecticut Pedestrian DemandRank model with these components:

### Primary Components (20% each)
- Census score - equity focus (zero-vehicle households)
- Crash-risk score - historical pedestrian crashes
- Functional-class score - roadway type priority

### Secondary Components (10% each)
- School proximity
- Trail proximity
- Rail-stop proximity
- Bus-stop proximity

### Screening Factors
- Pedestrian-feasible - infrastructure physically possible
- Urban context - urban vs rural
- Sidewalks - existing sidewalk presence

## Setup Instructions

### Prerequisites
- Google Cloud Platform account
- Google Maps API key
- The GeoPackage data exported from your GIS system

### Local Development Setup
1. Install dependencies:
   ```
   npm install
   ```

2. Update your Google Maps API key in `config.js`

3. Set up your Google Cloud Storage bucket in `config.js`

4. Convert your GeoPackage to GeoJSON chunks:
   ```
   npm run convert
   ```
   
   For large datasets, you'll need to split the GeoJSON into smaller chunks:
   ```
   ogr2ogr -f GeoJSON -skipfailures data/demandrank_0.geojson PG:"host=localhost dbname=yourdb" \
     -sql "SELECT * FROM demandrank LIMIT 10000"
   
   ogr2ogr -f GeoJSON -skipfailures data/demandrank_1.geojson PG:"host=localhost dbname=yourdb" \
     -sql "SELECT * FROM demandrank LIMIT 10000 OFFSET 10000"
   ```

5. Start the development server:
   ```
   npm start
   ```

### Google Cloud Deployment
1. Create a Google Cloud Storage bucket
2. Upload your chunked GeoJSON files to the bucket
3. Make the files publicly accessible
4. Deploy the web application:
   ```
   npm run deploy
   ```

## Hosting Options

### GitHub Pages
1. Create a repository on GitHub
2. Push your code to the repository
3. Enable GitHub Pages in your repository settings

### Google Cloud Storage Website
1. Configure your bucket for website hosting
2. Upload all HTML, CSS, and JavaScript files
3. Make all files publicly accessible
4. Access your site at the provided URL

## Data Management
For the large dataset (500,000+ mile points), the application:

1. Splits data into manageable chunks
2. Loads chunks dynamically based on map view
3. Applies dynamic level-of-detail based on zoom level
4. Uses deck.gl for efficient rendering

## Customization
- Update color schemes in `config.js`
- Adjust score ranges in `config.js`
- Modify UI components in `index.html`
- Change data fields mapping in `config.js` to match your GeoPackage schema