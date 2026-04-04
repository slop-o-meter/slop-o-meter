import * as cdk from "aws-cdk-lib";
import CertificateStack from "../lib/certificate-stack.js";
import SlopOMeterStack from "../lib/slop-o-meter-stack.js";

const app = new cdk.App();
const stage = app.node.tryGetContext("stage") ?? "production";
const hostedZoneId = app.node.tryGetContext("hostedZoneId");
const account = process.env.CDK_DEFAULT_ACCOUNT;

if (!hostedZoneId) {
  throw new Error("Missing required context: hostedZoneId");
}

const certificateStack = new CertificateStack(
  app,
  `SlopOMeter-${stage}-certificate`,
  {
    stage,
    hostedZoneId,
    env: { account, region: "us-east-1" },
    crossRegionReferences: true,
  },
);

new SlopOMeterStack(app, `SlopOMeter-${stage}`, {
  stage,
  certificate: certificateStack.certificate,
  hostedZoneId,
  env: { account, region: "eu-central-1" },
  crossRegionReferences: true,
});
