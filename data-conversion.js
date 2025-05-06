/**
 * Data Conversion Utility for Connecticut Pedestrian DemandRank
 * 
 * This script helps convert GeoPackage data to chunked GeoJSON files
 * for efficient loading in the web application.
 * 
 * Usage: node data-conversion.js [input-gpkg] [output-dir] [chunk-size]
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Configuration
const DEFAULT_CHUNK_SIZE = 10000; // Default number of features per chunk
const DEFAULT_INPUT = 'data/source.gpkg';
const DEFAULT_OUTPUT_DIR = 'data';

// Parse command line arguments
const args = process.argv.slice(2);
const inputGpkg = args[0] || DEFAULT_INPUT;
const outputDir = args[1] || DEFAULT_OUTPUT_DIR;
const chunkSize = parseInt(args[2] || DEFAULT_CHUNK_SIZE, 10);

// Ensure output directory exists
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
  console.log(`Created output directory: ${outputDir}`);
}

// Get information about the GeoPackage
function getGeoPackageInfo() {
  try {
    const ogrInfoOutput = execSync(`ogrinfo -so ${inputGpkg}`).toString();
    console.log('GeoPackage information:');
    console.log(ogrInfoOutput);
    
    // Extract layer name
    const layerMatch = ogrInfoOutput.match(/\d+: (\w+)/);
    const layerName = layerMatch ? layerMatch[1] : null;
    
    if (!layerName) {
      console.error('Could not determine layer name from GeoPackage');
      process.exit(1);
    }
    
    // Get feature count
    const featureCountOutput = execSync(`ogrinfo -so ${inputGpkg} ${layerName}`).toString();
    const featureCountMatch = featureCountOutput.match(/Feature Count: (\d+)/);
    const featureCount = featureCountMatch ? parseInt(featureCountMatch[1], 10) : 0;
    
    return { layerName, featureCount };
  } catch (error) {
    console.error('Error getting GeoPackage information:', error.message);
    process.exit(1);
  }
}

// Convert GeoPackage to chunked GeoJSON files
function convertToChunkedGeoJSON(layerName, featureCount) {
  console.log(`Converting GeoPackage to ${Math.ceil(featureCount / chunkSize)} GeoJSON chunks...`);
  
  const chunkCount = Math.ceil(featureCount / chunkSize);
  
  for (let i = 0; i < chunkCount; i++) {
    const offset = i * chunkSize;
    const outputFile = path.join(outputDir, `demandrank_${i}.geojson`);
    
    console.log(`Creating chunk ${i+1}/${chunkCount}: ${outputFile} (offset: ${offset})`);
    
    try {
      // Use ogr2ogr to extract a chunk of features
      const cmd = `ogr2ogr -f GeoJSON -skipfailures ${outputFile} ${inputGpkg} ${layerName} -sql "SELECT * FROM ${layerName} LIMIT ${chunkSize} OFFSET ${offset}"`;
      execSync(cmd);
      
      // Validate the output file
      const stats = fs.statSync(outputFile);
      console.log(`  - Created file (${Math.round(stats.size / 1024 / 1024 * 100) / 100} MB)`);
      
      // Optionally check feature count in output
      // const featureCountCmd = `ogrinfo -so ${outputFile} OGRGeoJSON | grep "Feature Count"`;
      // const outputFeatureCount = execSync(featureCountCmd).toString().trim();
      // console.log(`  - ${outputFeatureCount}`);
      
    } catch (error) {
      console.error(`Error creating chunk ${i}:`, error.message);
    }
  }
  
  console.log('Conversion complete!');
}

// Generate a template metadata file with field mappings
function generateMetadataFile(layerName) {
  try {
    // Get field information
    const fieldInfoCmd = `ogrinfo -so ${inputGpkg} ${layerName} | grep "^  [A-Za-z]"`;
    const fieldInfo = execSync(fieldInfoCmd).toString();
    
    // Parse fields
    const fieldLines = fieldInfo.split('\n').filter(line => line.trim() !== '');
    const fields = fieldLines.map(line => {
      const match = line.match(/^\s+(\w+):/);
      return match ? match[1] : null;
    }).filter(field => field !== null);
    
    // Generate metadata
    const metadata = {
      source: path.basename(inputGpkg),
      layerName: layerName,
      chunkSize: chunkSize,
      totalFeatures: getGeoPackageInfo().featureCount,
      chunks: Math.ceil(getGeoPackageInfo().featureCount / chunkSize),
      fields: fields,
      fieldMapping: {}
    };
    
    // Generate suggested field mappings
    fields.forEach(field => {
      // Convert snake_case to camelCase for JavaScript
      const camelCase = field.replace(/_([a-z])/g, (match, letter) => letter.toUpperCase());
      metadata.fieldMapping[field] = camelCase;
    });
    
    // Write metadata file
    const metadataFile = path.join(outputDir, 'metadata.json');
    fs.writeFileSync(metadataFile, JSON.stringify(metadata, null, 2));
    console.log(`Generated metadata file: ${metadataFile}`);
    
  } catch (error) {
    console.error('Error generating metadata:', error.message);
  }
}

// Main function
function main() {
  console.log('Connecticut Pedestrian DemandRank - Data Conversion Utility');
  console.log(`Input GeoPackage: ${inputGpkg}`);
  console.log(`Output directory: ${outputDir}`);
  console.log(`Chunk size: ${chunkSize} features`);
  
  // Check if input file exists
  if (!fs.existsSync(inputGpkg)) {
    console.error(`Error: Input file ${inputGpkg} does not exist`);
    process.exit(1);
  }
  
  // Get GeoPackage information
  const { layerName, featureCount } = getGeoPackageInfo();
  console.log(`Layer name: ${layerName}`);
  console.log(`Total features: ${featureCount}`);
  
  // Convert to chunked GeoJSON
  convertToChunkedGeoJSON(layerName, featureCount);
  
  // Generate metadata file
  generateMetadataFile(layerName);
}

main();