import { Construct, Stack, StackProps } from '@aws-cdk/core';
import { Vpc, SubnetType } from '@aws-cdk/aws-ec2';
import { NetworkConf } from './context-helper';

export interface NetworkProps extends StackProps, NetworkConf {}

export class NetworkStack extends Stack {

  public readonly vpc: Vpc;

  constructor(scope: Construct, id: string, networkProps: NetworkProps) {
    super(scope, id, networkProps);
    const inSubnetConf = {
      name: 'In',
      subnetType: SubnetType.PUBLIC,
    };
    const appSubnetConf = {
      name: 'Ml',
      subnetType: SubnetType.PRIVATE,
    };
    this.vpc = new Vpc(this, 'Vpc', {
      maxAzs: networkProps.azCount,
      subnetConfiguration: [
        inSubnetConf,
        appSubnetConf,
      ],
    });
  }

}
