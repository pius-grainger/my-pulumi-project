import * as pulumi from "@pulumi/pulumi";
import * as aws from "@pulumi/aws";
import { createLambda, createApiGateway, createSns } from "@pius-grainger/pulumi-lambda-library";
import * as path from "path";

// Load configuration
const config = new pulumi.Config();
const s3BucketName = config.require("s3BucketName");
const awsRegion: aws.Region = config.require("awsRegion") as aws.Region;

// Ensure the AWS provider is using the correct region
const provider = new aws.Provider("aws-provider", {
    region: awsRegion,
});

// Create the S3 bucket if not exists
const bucket = new aws.s3.Bucket(s3BucketName, {
    bucket: s3BucketName,
}, { protect: true });

// Use the correct runtime available in the Pulumi AWS package
const nodejsRuntime = aws.lambda.Runtime.NodeJS18dX;

// Define Lambda configurations
const lambdaConfigs = [
    {
        name: "apiHandler",
        handlerFileName: "apiHandler",
        runtime: nodejsRuntime,
        triggers: [{ type: "apigateway" as const }],
        s3Bucket: bucket,
        artifactPath: path.resolve(__dirname, "../../dist/apiHandler.zip"), // Correct path to the artifact
    },
    {
        name: "snsHandler",
        handlerFileName: "snsHandler",
        runtime: nodejsRuntime,
        triggers: [{ type: "sns" as const }],
        s3Bucket: bucket,
        artifactPath: path.resolve(__dirname, "../../dist/snsHandler.zip"), // Correct path to the artifact
    }
];

// Create Lambdas and their respective triggers
lambdaConfigs.forEach(config => {
    const lambdas = createLambda(config);

    lambdas.forEach(lambda => {
        if (config.triggers.some(trigger => trigger.type === "apigateway")) {
            createApiGateway({
                apiName: `${config.name}-api`, // Ensure unique name
                lambda: lambda,
                resourcePath: "hello",
            });
        }
        
        if (config.triggers.some(trigger => trigger.type === "sns")) {
            createSns({
                snsName: `${config.name}-sns`, // Ensure unique name
                lambda: lambda,
            });
        }
    });
});
