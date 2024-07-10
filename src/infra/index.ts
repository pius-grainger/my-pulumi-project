import * as pulumi from "@pulumi/pulumi";
import * as aws from "@pulumi/aws";
import { createLambdaFromS3 } from "@pius-grainger/pulumi-lambda-library";

// Load configuration
const config = new pulumi.Config();
const s3BucketName = config.require("s3BucketName");
const awsRegion: aws.Region = config.require("awsRegion") as aws.Region;

// Ensure the AWS provider is using the correct region
const provider = new aws.Provider("aws-provider", {
    region: awsRegion,
});

// Use the correct runtime available in the Pulumi AWS package
const nodejsRuntime = aws.lambda.Runtime.NodeJS18dX;

const apiHandlerS3Key = "apiHandler.zip";
const snsHandlerS3Key = "snsHandler.zip";

const apiLambda = createLambdaFromS3("apiLambda", s3BucketName, apiHandlerS3Key, "index.handler", nodejsRuntime);
const snsLambda = createLambdaFromS3("snsLambda", s3BucketName, snsHandlerS3Key, "index.handler", nodejsRuntime);

const api = new aws.apigatewayv2.Api("api", {
    protocolType: "HTTP",
});

const integration = new aws.apigatewayv2.Integration("integration", {
    apiId: api.id,
    integrationType: "AWS_PROXY",
    integrationUri: apiLambda.arn,
    payloadFormatVersion: "2.0",
});

const defaultStage = new aws.apigatewayv2.Stage("defaultStage", {
    apiId: api.id,
    name: "$default",
    autoDeploy: true,
    accessLogSettings: {
        destinationArn: new aws.cloudwatch.LogGroup("apiGatewayLogs", {
            retentionInDays: 7,
        }).arn,
        format: JSON.stringify({
            requestId: "$context.requestId",
            ip: "$context.identity.sourceIp",
            caller: "$context.identity.caller",
            user: "$context.identity.user",
            requestTime: "$context.requestTime",
            httpMethod: "$context.httpMethod",
            resourcePath: "$context.resourcePath",
            status: "$context.status",
            protocol: "$context.protocol",
            responseLength: "$context.responseLength",
        }),
    },
});

// Define the GET route
const getRoute = new aws.apigatewayv2.Route("getRoute", {
    apiId: api.id,
    routeKey: "GET /",
    target: pulumi.interpolate`integrations/${integration.id}`,
});

new aws.lambda.Permission("apiLambdaPermission", {
    action: "lambda:InvokeFunction",
    function: apiLambda,
    principal: "apigateway.amazonaws.com",
    sourceArn: pulumi.interpolate`${api.executionArn}/*/*`,
});

const topic = new aws.sns.Topic("topic");

new aws.sns.TopicSubscription("subscription", {
    topic: topic,
    protocol: "lambda",
    endpoint: snsLambda.arn,
});

new aws.lambda.Permission("snsLambdaPermission", {
    action: "lambda:InvokeFunction",
    function: snsLambda,
    principal: "sns.amazonaws.com",
    sourceArn: topic.arn,
});

// Print debug information using apply and interpolate
api.id.apply(id => pulumi.log.info(`API ID: ${id}`));
api.apiEndpoint.apply(endpoint => pulumi.log.info(`API Endpoint: ${endpoint}`));
defaultStage.name.apply(stageName => pulumi.log.info(`Stage Name: ${stageName}`));

export const apiEndpoint = api.apiEndpoint;
export const snsTopicArn = topic.arn;

