import { Construct, Stage, StageProps } from '@aws-cdk/core';
import { NetworkStack } from './network-stack';
import { DataPipelineConf } from './context-helper';

/**
 * Deployable unit of entire architecture
 */
export class CloudDeployStage extends Stage {

  constructor(scope: Construct, id: string, props?: StageProps) {
    super(scope, id, props);
    const dataPipelineContext = this.node.tryGetContext('dataPipeline');
    const dataPipelineConf = dataPipelineContext as DataPipelineConf;
    const dataPipelineNetwork = new NetworkStack(this, 'DataPipelineNetwork', {
      ...dataPipelineConf.network,
    });
  }

}
