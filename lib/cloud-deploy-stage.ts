import { Construct, Stage, StageProps } from '@aws-cdk/core';
import { NetworkStack } from './network-stack';
import { StreamStack } from './stream-stack';
import { DataPipelineConf } from './context-helper';

interface CloudDeployProps extends StageProps {
  cacheBucketArn?: string,
}

/**
 * Deployable unit of entire architecture
 */
export class CloudDeployStage extends Stage {

  constructor(scope: Construct, id: string, cloudDeployProps?: CloudDeployProps) {
    super(scope, id, cloudDeployProps);
    const dataPipelineContext = this.node.tryGetContext('dataPipeline');
    const dataPipelineConf = dataPipelineContext as DataPipelineConf;
    const dataPipelineNetwork = new NetworkStack(this, 'StreamNetwork', {
      ...dataPipelineConf.network,
    });
    new StreamStack(this, 'StreamProcessor');
  }

}
