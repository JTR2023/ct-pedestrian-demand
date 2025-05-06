/**
 * Google Cloud Storage Setup Script for Connecticut Pedestrian DemandRank
 * 
 * This script helps set up a Google Cloud Storage bucket for hosting
 * the web application and geospatial data.
 * 
 * Requirements:
 * - Google Cloud SDK installed and configured
 * - Node.js and npm
 * - @google-cloud/storage npm package
 * 
 * Usage: node gcs-setup.js [bucket-name]
 */

const { Storage } = require('@google-cloud/storage');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Configuration
const DEFAULT_BUCKET_NAME = 'ct-pedestrian-demandrank';
const DATA_DIR = 'data';
const WEB_FILES = [
  'index.html',
  'styles.css',
  'app.js',
  'config.js'
];

// Parse command line arguments
const args = process.argv.slice(2);
const bucketName = args[0] || DEFAULT_BUCKET_NAME;

// Initialize Google Cloud Storage client
const storage = new Storage();

// Create a new bucket
async function createBucket() {
  try {
    console.log(`Creating bucket: ${bucketName}`);
    
    // Check if bucket already exists
    const [buckets] = await storage.getBuckets();
    const bucketExists = buckets.some(bucket => bucket.name === bucketName);
    
    if (bucketExists) {
      console.log(`Bucket ${bucketName} already exists`);
    } else {
      // Create new bucket with website configuration
      await storage.createBucket(bucketName, {
        location: 'us-east1',
        website: {
          mainPageSuffix: 'index.html',
          notFoundPage: '404.html'
        }
      });
      console.log(`Bucket ${bucketName} created`);
    }
    
    // Make bucket public
    await makePublic();
    
    return bucketName;
  } catch (error) {
    console.error('Error creating bucket:', error);
    throw error;
  }
}

// Make bucket public
async function makePublic() {
  try {
    console.log(`Making bucket ${bucketName} publicly accessible...`);
    
    // Add IAM policy binding to make all objects publicly readable
    await storage.bucket(bucketName).iam.addBinding('allUsers', 'roles/storage.objectViewer');
    
    console.log('Bucket is now publicly accessible');
  } catch (error) {
    console.error('Error making bucket public:', error);
    throw error;
  }
}

// Upload web files
async function uploadWebFiles() {
  try {
    console.log('Uploading web application files...');
    
    for (const file of WEB_FILES) {
      if (fs.existsSync(file)) {
        await storage.bucket(bucketName).upload(file, {
          destination: file,
          metadata: {
            cacheControl: 'public, max-age=3600'
          }
        });
        console.log(`Uploaded ${file}`);
      } else {
        console.warn(`Warning: File ${file} not found`);
      }
    }
    
    console.log('Web files uploaded successfully');
  } catch (error) {
    console.error('Error uploading web files:', error);
    throw error;
  }
}

// Upload data files
async function uploadDataFiles() {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      console.warn(`Warning: Data directory ${DATA_DIR} not found`);
      return;
    }
    
    console.log(`Uploading data files from ${DATA_DIR}...`);
    
    // List all files in the data directory
    const files = fs.readdirSync(DATA_DIR);
    const geoJsonFiles = files.filter(file => file.endsWith('.geojson'));
    
    if (geoJsonFiles.length === 0) {
      console.warn('No GeoJSON files found in data directory');
      return;
    }
    
    console.log(`Found ${geoJsonFiles.length} GeoJSON files to upload`);
    
    // Upload each file
    for (const file of geoJsonFiles) {
      const filePath = path.join(DATA_DIR, file);
      
      await storage.bucket(bucketName).upload(filePath, {
        destination: `data/${file}`,
        metadata: {
          contentType: 'application/json',
          cacheControl: 'public, max-age=86400'
        }
      });
      
      console.log(`Uploaded ${file}`);
    }
    
    console.log('Data files uploaded successfully');
  } catch (error) {
    console.error('Error uploading data files:', error);
    throw error;
  }
}

// Update config.js with bucket information
function updateConfig() {
  try {
    console.log('Updating config.js with bucket information...');
    
    if (!fs.existsSync('config.js')) {
      console.warn('Warning: config.js not found, skipping update');
      return;
    }
    
    // Read existing config
    let configContent = fs.readFileSync('config.js', 'utf8');
    
    // Update bucket name
    configContent = configContent.replace(/bucketName: ['"]YOUR_GCS_BUCKET_NAME['"]/, `bucketName: '${bucketName}'`);
    
    // Get public URL
    const publicUrl = `https://storage.googleapis.com/${bucketName}`;
    configContent = configContent.replace(/gcsUrlPattern: ['"]https:\/\/storage\.googleapis\.com\/\{bucket\}\/data\/demandrank_\{chunk\}\.geojson['"]/, 
      `gcsUrlPattern: '${publicUrl}/data/demandrank_{chunk}.geojson'`);
    
    // Write updated config
    fs.writeFileSync('config.js', configContent);
    
    console.log('Config updated with bucket information');
    
    // Create a backup copy for upload
    fs.writeFileSync('config.js.bak', configContent);
    
    // Upload updated config
    execSync(`gsutil cp config.js gs://${bucketName}/config.js`);
    console.log('Updated config uploaded to bucket');
    
  } catch (error) {
    console.error('Error updating config:', error);
  }
}

// Main function
async function main() {
  console.log('Connecticut Pedestrian DemandRank - Google Cloud Storage Setup');
  console.log(`Bucket name: ${bucketName}`);
  
  try {
    // Create and configure bucket
    await createBucket();
    
    // Upload files
    await uploadWebFiles();
    await uploadDataFiles();
    
    // Update config
    updateConfig();
    
    // Print success message with access URL
    console.log('\nSetup complete!');
    console.log(`Your application is accessible at: https://storage.googleapis.com/${bucketName}/index.html`);
    console.log('\nNext steps:');
    console.log('1. Update your Google Maps API key in config.js');
    console.log('2. Upload any additional data files to the bucket');
    console.log('3. Consider setting up a custom domain with Google Cloud Load Balancer');
    
  } catch (error) {
    console.error('Setup failed:', error);
  }
}

// Run main function
main();