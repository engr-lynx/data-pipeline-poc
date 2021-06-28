import { join } from 'path';
import { Construct, Stack, StackProps } from '@aws-cdk/core';
import { Stream } from '@aws-cdk/aws-kinesis';
import { Application, ApplicationCode, Runtime, PropertyGroups } from '@aws-cdk/aws-kinesisanalytics-flink';

export interface StreamProps extends StackProps {}

export class StreamStack extends Stack {

  constructor(scope: Construct, id: string, streamProps?: StreamProps) {
    super(scope, id, streamProps);
    const inStream = new Stream(this, "InStream");
    const outStream = new Stream(this, "OutStream");
    const code = ApplicationCode.fromAsset(join(__dirname, 'flink-processor'));
    const propertyGroups = {
      'kinesis.analytics.flink.run.options': {
        python: 'index.py',
        jarfile: 'lib/kinesis-sql-connector.jar',
      },
      'consumer.config.0': {
        'input.stream.name': inStream.streamName,
        'aws.region': this.region,
        'flink.stream.initpos': 'LATEST',
      },
      'producer.config.0': {
        'output.stream.name': outStream.streamName,
        'aws.region': this.region,
        'shard.count': '1',
      },
    };
    const flinkApp = new Application(this, 'FlinkApp', {
      code,
      runtime: Runtime.FLINK_1_11,
      propertyGroups,
    });
    inStream.grantRead(flinkApp);
    outStream.grantWrite(flinkApp);
  }

}
