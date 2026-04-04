import * as cdk from "aws-cdk-lib";
import * as acm from "aws-cdk-lib/aws-certificatemanager";
import * as route53 from "aws-cdk-lib/aws-route53";
import type { Construct } from "constructs";
import { domainName, DOMAIN_NAME } from "./domain.js";

interface CertificateStackProps extends cdk.StackProps {
  stage: string;
  hostedZoneId: string;
}

export default class CertificateStack extends cdk.Stack {
  public readonly certificate: acm.Certificate;

  constructor(scope: Construct, id: string, props: CertificateStackProps) {
    super(scope, id, props);

    const hostedZone = route53.HostedZone.fromHostedZoneAttributes(
      this,
      "HostedZone",
      {
        hostedZoneId: props.hostedZoneId,
        zoneName: DOMAIN_NAME,
      },
    );

    this.certificate = new acm.Certificate(this, "Certificate", {
      domainName: domainName(props.stage),
      validation: acm.CertificateValidation.fromDns(hostedZone),
    });
  }
}
