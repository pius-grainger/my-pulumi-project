import * as pulumi from "@pulumi/pulumi";
import * as aws from "@pulumi/aws";
import { createLambda, createApiGateway, createSns } from "@pius-grainger/pulumi-lambda-library";
import * as path from "path";

// Load configuration
const config = new pulumi.Config();
const s3BucketName = config.require("s3BucketName");
const awsRegion: aws.Region = config.require("awsRegion") as aws.Region;

// Load tags from config or environment variables
const tagsConfig = config.getObject<{ [key: string]: string }>("tags") || JSON.parse(process.env.TAGS || "{}");

// Ensure the AWS provider is using the correct region
const provider = new aws.Provider("aws-provider", {
    region: awsRegion,
});

// Create the S3 bucket if not exists
const bucket = new aws.s3.Bucket(s3BucketName, {
    bucket: s3BucketName,
    tags: tagsConfig,
}, { protect: true });

// Use the correct runtime available in the Pulumi AWS package
const nodejsRuntime = aws.lambda.Runtime.NodeJS18dX;

// Define Lambda configurations
const lambdaConfigs = [
    {
        name: "apiHandler",
        handler: "apiHandler",
        entryPoint: "index.handler",
        runtime: nodejsRuntime,
        triggers: [{ type: "apigateway" as const }],
        s3Bucket: bucket,
        artifactPath: path.resolve(__dirname, "../../dist/apiHandler.zip"), // Correct path to the artifact
        tags: tagsConfig,
    },
    {
        name: "snsHandler",
        handler: "snsHandler",
        entryPoint: "index.handler",
        runtime: nodejsRuntime,
        triggers: [{ type: "sns" as const }],
        s3Bucket: bucket,
        artifactPath: path.resolve(__dirname, "../../dist/snsHandler.zip"), // Correct path to the artifact
        tags: tagsConfig,
    }
];

// Create Lambdas and their respective triggers
let api: aws.apigateway.RestApi | undefined;

lambdaConfigs.forEach(config => {
    const lambdas = createLambda(config);

    lambdas.forEach(lambda => {
        if (config.triggers.some(trigger => trigger.type === "apigateway")) {
            if (!api) {
                // Create API Gateway if it doesn't exist
                api = createApiGateway({
                    apiName: `${config.name}-api`, // Ensure unique name
                    lambda: lambda,
                    resourcePath: "hello",
                    method: "GET",
                    tags: config.tags,
                });
            } else {
                // Add the lambda to existing API Gateway integration if API already exists
                const resource = new aws.apigateway.Resource(`${config.name}-resource`, {
                    restApi: api.id,
                    parentId: api.rootResourceId,
                    pathPart: "hello",
                });

                const method = new aws.apigateway.Method(`${config.name}-method`, {
                    restApi: api.id,
                    resourceId: resource.id,
                    httpMethod: "GET",
                    authorization: "NONE",
                });

                const integration = new aws.apigateway.Integration(`${config.name}-integration`, {
                    restApi: api.id,
                    resourceId: resource.id,
                    httpMethod: method.httpMethod,
                    type: "AWS_PROXY",
                    integrationHttpMethod: "POST",
                    uri: lambda.invokeArn,
                });

                new aws.lambda.Permission(`${config.name}-apiPermission`, {
                    action: "lambda:InvokeFunction",
                    function: lambda,
                    principal: "apigateway.amazonaws.com",
                    sourceArn: pulumi.interpolate`${api.executionArn}/*/*`,
                });
            }
        }

        if (config.triggers.some(trigger => trigger.type === "sns")) {
            createSns({
                snsName: `${config.name}-sns`,
                lambda: lambda,
                tags: config.tags,
            });
        }
    });
});
