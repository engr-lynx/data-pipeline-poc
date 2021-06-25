import { Construct, Stack, StackProps } from '@aws-cdk/core';
import { Bucket } from '@aws-cdk/aws-s3';

export class PipelineCacheStack extends Stack {

  public readonly bucket: Bucket;

  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);
    const cacheBucket = new Bucket(this, 'CacheBucket');
    this.bucket = cacheBucket;
  }

}
