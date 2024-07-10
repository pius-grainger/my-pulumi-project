import * as pulumi from "@pulumi/pulumi";
import * as aws from "@pulumi/aws";
import { createLambdaFromS3 } from "@pius-grainger/pulumi-lambda-library";

const config = new pulumi.Config();
const s3BucketName = config.require("s3BucketName");

// Use the correct runtime available in the Pulumi AWS package
const nodejsRuntime = aws.lambda.Runtime.NodeJS18dX;

const apiHandlerS3Key = "apiHandler.zip";
const snsHandlerS3Key = "snsHandler.zip";

const apiLambda = createLambdaFromS3("apiLambda", s3BucketName, apiHandlerS3Key, "index.handler", aws.lambda.Runtime.NodeJS18dX);
const snsLambda = createLambdaFromS3("snsLambda", s3BucketName, snsHandlerS3Key, "index.handler", aws.lambda.Runtime.NodeJS18dX);

const api = new aws.apigatewayv2.Api("api", {
    protocolType: "HTTP",
});

const integration = new aws.apigatewayv2.Integration("integration", {
    apiId: api.id,
    integrationType: "AWS_PROXY",
    integrationUri: apiLambda.arn,
    payloadFormatVersion: "2.0",
});

new aws.apigatewayv2.Route("route", {
    apiId: api.id,
    routeKey: "$default",
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

export const apiEndpoint = api.apiEndpoint;
export const snsTopicArn = topic.arn;
