import { join } from 'path';
import { Construct, Stack, StackProps } from '@aws-cdk/core';
import { Stream } from '@aws-cdk/aws-kinesis';
import { Application, ApplicationCode, Runtime } from '@aws-cdk/aws-kinesisanalytics-flink';

export interface StreamProps extends StackProps {}

export class StreamStack extends Stack {

  constructor(scope: Construct, id: string, streamProps?: StreamProps) {
    super(scope, id, streamProps);
    const inStream = new Stream(this, "InStream");
    const outStream = new Stream(this, "OutStream");
    const code = ApplicationCode.fromAsset(join(__dirname, 'flink-processor'))
    const flinkApp = new Application(this, 'FlinkApp', {
      code,
      runtime: Runtime.FLINK_1_11,
    });
    inStream.grantRead(flinkApp);
    outStream.grantWrite(flinkApp);
  }

}
