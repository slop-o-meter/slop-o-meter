import * as path from "node:path";
import * as cdk from "aws-cdk-lib";
import type * as acm from "aws-cdk-lib/aws-certificatemanager";
import * as cloudfront from "aws-cdk-lib/aws-cloudfront";
import * as origins from "aws-cdk-lib/aws-cloudfront-origins";
import * as iam from "aws-cdk-lib/aws-iam";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as lambdaEventSources from "aws-cdk-lib/aws-lambda-event-sources";
import * as route53 from "aws-cdk-lib/aws-route53";
import * as route53Targets from "aws-cdk-lib/aws-route53-targets";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as sqs from "aws-cdk-lib/aws-sqs";
import * as customResources from "aws-cdk-lib/custom-resources";
import type { Construct } from "constructs";
import { domainName, DOMAIN_NAME } from "./domain.js";

interface SlopOMeterStackProps extends cdk.StackProps {
  stage: string;
  certificate: acm.ICertificate;
  hostedZoneId: string;
}

export default class SlopOMeterStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: SlopOMeterStackProps) {
    super(scope, id, props);

    const { stage, certificate, hostedZoneId } = props;

    cdk.Tags.of(this).add("project", "slop-o-meter");
    cdk.Tags.of(this).add("stage", stage);

    const hostedZone = route53.HostedZone.fromHostedZoneAttributes(
      this,
      "HostedZone",
      {
        hostedZoneId,
        zoneName: DOMAIN_NAME,
      },
    );

    const dataBucket = new s3.Bucket(this, "DataBucket", {
      bucketName: `slop-o-meter-data-${stage}`,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      encryption: s3.BucketEncryption.S3_MANAGED,
      removalPolicy:
        stage === "production"
          ? cdk.RemovalPolicy.RETAIN
          : cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: stage !== "production",
    });

    const deadLetterQueue = new sqs.Queue(this, "MeasurementDeadLetterQueue", {
      queueName: `slop-o-meter-measurement-dlq-${stage}`,
      retentionPeriod: cdk.Duration.days(14),
    });

    const measurementQueue = new sqs.Queue(this, "MeasurementQueue", {
      queueName: `slop-o-meter-measurement-${stage}`,
      visibilityTimeout: cdk.Duration.seconds(360),
      retentionPeriod: cdk.Duration.days(4),
      deadLetterQueue: {
        queue: deadLetterQueue,
        maxReceiveCount: 3,
      },
    });

    const ssmParameterPrefix = "/slop-o-meter";
    const ssmParameterArn = this.formatArn({
      service: "ssm",
      resource: "parameter",
      resourceName: "slop-o-meter",
    });
    const ssmParameterChildrenArn = this.formatArn({
      service: "ssm",
      resource: "parameter",
      resourceName: "slop-o-meter/*",
    });

    const environmentVariables: Record<string, string> = {
      DATA_BUCKET_NAME: dataBucket.bucketName,
      MEASUREMENT_QUEUE_URL: measurementQueue.queueUrl,
      SSM_PARAMETER_PREFIX: ssmParameterPrefix,
    };

    const httpHandler = new lambda.Function(this, "HttpHandler", {
      runtime: lambda.Runtime.NODEJS_24_X,
      architecture: lambda.Architecture.ARM_64,
      handler: "index.handler",
      code: lambda.Code.fromAsset(
        path.join(import.meta.dirname, "../assets/web"),
      ),
      memorySize: 256,
      timeout: cdk.Duration.seconds(30),
      environment: environmentVariables,
    });

    const httpFunctionUrl = httpHandler.addFunctionUrl({
      authType: lambda.FunctionUrlAuthType.NONE,
    });

    dataBucket.grantReadWrite(httpHandler, "projects/*");
    measurementQueue.grantSendMessages(httpHandler);
    httpHandler.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ["ssm:GetParameter", "ssm:GetParametersByPath"],
        resources: [ssmParameterArn, ssmParameterChildrenArn],
      }),
    );

    const workerHandler = new lambda.DockerImageFunction(
      this,
      "WorkerHandler",
      {
        code: lambda.DockerImageCode.fromImageAsset(
          path.join(import.meta.dirname, "../docker/worker"),
        ),
        architecture: lambda.Architecture.ARM_64,
        memorySize: 1769,
        timeout: cdk.Duration.seconds(300),
        ephemeralStorageSize: cdk.Size.mebibytes(1024),
        environment: environmentVariables,
      },
    );

    dataBucket.grantReadWrite(workerHandler, "projects/*");
    dataBucket.grantReadWrite(workerHandler, "cache/*");
    workerHandler.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ["ssm:GetParameter", "ssm:GetParametersByPath"],
        resources: [ssmParameterArn, ssmParameterChildrenArn],
      }),
    );

    workerHandler.addEventSource(
      new lambdaEventSources.SqsEventSource(measurementQueue, {
        batchSize: 1,
      }),
    );

    const httpOrigin = new origins.FunctionUrlOrigin(httpFunctionUrl);

    const pageCachePolicy = new cloudfront.CachePolicy(
      this,
      "PageCachePolicy",
      {
        cachePolicyName: `slop-o-meter-page-cache-${stage}`,
        defaultTtl: cdk.Duration.minutes(5),
        maxTtl: cdk.Duration.minutes(5),
        minTtl: cdk.Duration.seconds(0),
        enableAcceptEncodingGzip: true,
        enableAcceptEncodingBrotli: true,
      },
    );

    const distribution = new cloudfront.Distribution(this, "Distribution", {
      defaultBehavior: {
        origin: httpOrigin,
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        cachePolicy: pageCachePolicy,
        originRequestPolicy:
          cloudfront.OriginRequestPolicy.ALL_VIEWER_EXCEPT_HOST_HEADER,
        allowedMethods: cloudfront.AllowedMethods.ALLOW_ALL,
      },
      additionalBehaviors: {
        "/api/*": {
          origin: httpOrigin,
          viewerProtocolPolicy:
            cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
          cachePolicy: cloudfront.CachePolicy.CACHING_DISABLED,
          originRequestPolicy:
            cloudfront.OriginRequestPolicy.ALL_VIEWER_EXCEPT_HOST_HEADER,
          allowedMethods: cloudfront.AllowedMethods.ALLOW_ALL,
        },
        "/static/*": {
          origin: httpOrigin,
          viewerProtocolPolicy:
            cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
          cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
        },
      },
      domainNames: [domainName(stage)],
      certificate,
      priceClass: cloudfront.PriceClass.PRICE_CLASS_100,
    });

    workerHandler.addEnvironment(
      "CLOUDFRONT_DISTRIBUTION_ID",
      distribution.distributionId,
    );
    workerHandler.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ["cloudfront:CreateInvalidation"],
        resources: [
          `arn:aws:cloudfront::${this.account}:distribution/${distribution.distributionId}`,
        ],
      }),
    );

    new customResources.AwsCustomResource(this, "CloudFrontInvalidation", {
      onUpdate: {
        service: "CloudFront",
        action: "createInvalidation",
        parameters: {
          DistributionId: distribution.distributionId,
          InvalidationBatch: {
            CallerReference: `deploy-${Date.now()}`,
            Paths: {
              Quantity: 1,
              Items: ["/*"],
            },
          },
        },
        physicalResourceId: customResources.PhysicalResourceId.of(
          Date.now().toString(),
        ),
      },
      policy: customResources.AwsCustomResourcePolicy.fromStatements([
        new iam.PolicyStatement({
          actions: ["cloudfront:CreateInvalidation"],
          resources: [
            `arn:aws:cloudfront::${this.account}:distribution/${distribution.distributionId}`,
          ],
        }),
      ]),
    });

    new route53.ARecord(this, "AliasRecord", {
      zone: hostedZone,
      recordName: domainName(stage),
      target: route53.RecordTarget.fromAlias(
        new route53Targets.CloudFrontTarget(distribution),
      ),
    });

    new cdk.CfnOutput(this, "Url", {
      value: `https://${domainName(stage)}`,
    });
  }
}
