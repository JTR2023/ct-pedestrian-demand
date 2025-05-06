# Google Cloud Storage Setup Guide

This guide will help you set up Google Cloud Storage to host your GeoJSON data files.

## 1. Create a Google Cloud Project

1. Go to https://console.cloud.google.com/
2. Create a new project (or use an existing one)
3. Note your Project ID for later use

## 2. Set Up a Cloud Storage Bucket

1. Go to https://console.cloud.google.com/storage/browser
2. Click "Create Bucket"
3. Name your bucket (e.g., `ct-pedestrian-demand-data`)
4. Choose a region close to your users (e.g., `us-east1`)
5. Set the default storage class to "Standard"
6. Under "Access Control", choose "Fine-grained" (recommended)
7. Click "Create"

## 3. Configure Bucket for Web Access

1. Select your bucket in the list
2. Go to the "Permissions" tab
3. Click "Add members"
4. In the "New members" field, enter `allUsers`
5. For the role, select "Cloud Storage" > "Storage Object Viewer"
6. Click "Save"

This allows public read-only access to your data files.

## 4. Enable CORS for Web Access

1. Select your bucket in the list
2. Go to the "CORS" tab (might be under "Settings")
3. Click "Add CORS configuration"
4. Use the following configuration:

```json
[
  {
    "origin": ["https://JTR2023.github.io"],
    "method": ["GET", "HEAD"],
    "responseHeader": ["Content-Type"],
    "maxAgeSeconds": 3600
  }
]
```

Replace `YOUR_USERNAME` with your GitHub username.

## 5. Upload Your GeoJSON Data

Once you've converted your GeoPackage to GeoJSON chunks, upload them:

```bash
# Using gsutil (part of Google Cloud SDK)
gsutil -m cp data/geojson/*.geojson gs://your-bucket-name/data/

# Or use the Google Cloud Console web interface
```

## 6. Update Configuration

Update `config.js` with your bucket information:

```javascript
storage: {
  bucketName: 'your-bucket-name',
  dataPath: 'data/',
}
```

## Cost Considerations

- Google Cloud Storage has a free tier (5GB)
- Beyond that, costs are based on storage used and data transferred
- For your dataset (~100MB), costs should be minimal (a few dollars per month)

## Security Notes

- Make sure to keep your GCP project secure
- Consider setting up a budget alert to avoid unexpected charges
- For production, consider using signed URLs instead of public access