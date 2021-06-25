import { Construct } from '@aws-cdk/core';
import { Bucket } from '@aws-cdk/aws-s3';
import { OriginAccessIdentity, PriceClass } from '@aws-cdk/aws-cloudfront';
import { WebDistribution } from './resource-patterns';

export class Cdn extends Construct {

  public readonly source: Bucket;
  public readonly distribution: WebDistribution;

  constructor(scope: Construct, id: string) {
    super(scope, id);
    this.source = new Bucket(this, 'Source');
    const originAccessIdentity = new OriginAccessIdentity(this, 'OriginAccessIdentity');
    const s3OriginSource = {
      s3BucketSource: this.source,
      originAccessIdentity,
    };
    const behaviors = [{
      isDefaultBehavior: true,
    }];
    const originConfigs = [{
      s3OriginSource,
      behaviors,
    }];
    this.distribution = new WebDistribution(this, 'Distribution', {
      originConfigs,
      priceClass: PriceClass.PRICE_CLASS_200,
    });
  }

}
