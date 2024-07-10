const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

// Read config.json
const config = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../config.json'), 'utf8'));
const s3BucketName = config.s3BucketName;

// Get the handler name from the command line arguments
const handlerName = process.argv[2];
if (!handlerName) {
  console.error('Handler name is required');
  process.exit(1);
}

// Construct the local file path and S3 path
const filePath = path.resolve(__dirname, `../dist/${handlerName}.zip`);
const s3Path = `s3://${s3BucketName}/${handlerName}.zip`;

// Upload the file to S3
console.log(`Uploading ${filePath} to ${s3Path}`);
execSync(`aws s3 cp ${filePath} ${s3Path}`, { stdio: 'inherit' });
console.log('Upload complete');
