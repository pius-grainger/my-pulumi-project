const AWS = require('aws-sdk');
const fs = require('fs');
const path = require('path');

const s3 = new AWS.S3();

const args = process.argv.slice(2);
const handlerName = args[0];

if (!handlerName) {
    console.error('Handler name is required');
    process.exit(1);
}

const bucketName = process.env.S3_BUCKET_NAME || "pius.chungath2";
const filePath = path.resolve(__dirname, `../dist/${handlerName}.zip`);
const key = `${handlerName}.zip`;

if (!fs.existsSync(filePath)) {
    console.error(`File not found: ${filePath}`);
    process.exit(1);
}

s3.upload({
    Bucket: bucketName,
    Key: key,
    Body: fs.createReadStream(filePath)
}, (err, data) => {
    if (err) {
        console.error(`Failed to upload ${filePath} to ${bucketName}/${key}:`, err);
        process.exit(1);
    } else {
        console.log(`Successfully uploaded ${filePath} to ${bucketName}/${key}`);
    }
});
