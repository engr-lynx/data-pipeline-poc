import { Construct, Arn } from '@aws-cdk/core';
import { CloudFrontWebDistribution, CloudFrontWebDistributionProps } from '@aws-cdk/aws-cloudfront';
import { IGrantable, PolicyStatement } from '@aws-cdk/aws-iam';

type WebDistributionProps = Omit<CloudFrontWebDistributionProps, 'defaultRootObject'>;

export class WebDistribution extends CloudFrontWebDistribution {

  constructor(scope: Construct, id: string, webDistributionProps: WebDistributionProps) {
    const cloudFrontWebDistributionProps = {
      ...webDistributionProps,
      defaultRootObject: 'index.html',
    };
    super(scope, id, cloudFrontWebDistributionProps);
  }

  grantInvalidate(grantee: IGrantable) {
    const distributionArn = Arn.format({
      service: 'cloudfront',
      resource: 'distribution',
      region: '',
      resourceName: this.distributionId,
    }, this.stack);
    const invalidationPolicy = new PolicyStatement({
      actions: [
        'cloudfront:CreateInvalidation',
      ],
      resources: [
        distributionArn,
      ],
    });
    grantee.grantPrincipal.addToPrincipalPolicy(invalidationPolicy);
  }

}
