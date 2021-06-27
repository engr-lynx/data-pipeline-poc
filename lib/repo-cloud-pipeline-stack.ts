import { Construct, Stack, StackProps } from '@aws-cdk/core';
import { CdkPipeline } from '@aws-cdk/pipelines';
import { Bucket } from '@aws-cdk/aws-s3';
import { ManualApprovalAction } from '@aws-cdk/aws-codepipeline-actions';
import { CloudDeployStage } from './cloud-deploy-stage';
import { buildRepoSourceAction, buildYarnSynthAction, buildArchiValidateAction, buildPyInvokeAction } from './pipeline-helper';
import { PipelineConf } from './context-helper';

export interface RepoCloudPipelineProps extends StackProps, PipelineConf {}

export class RepoCloudPipelineStack extends Stack {

  constructor(scope: Construct, id: string, repoCloudPipelineProps: RepoCloudPipelineProps) {
    super(scope, id, repoCloudPipelineProps);
    const cacheBucket = new Bucket(this, 'CacheBucket');
    const { action: repoAction, sourceCode } = buildRepoSourceAction(this, {
      ...repoCloudPipelineProps.repo,
    });
    const { action: synthAction, cloudAssembly } = buildYarnSynthAction(this, {
      ...repoCloudPipelineProps.build,
      sourceCode,
      cacheBucket,
    });
    const repoCloudPipeline = new CdkPipeline(this, 'RepoCloudPipeline', {
      cloudAssemblyArtifact: cloudAssembly,
      sourceAction: repoAction,
      synthAction,
    });
    // This is where we add the application stages
    // ...
    if (repoCloudPipelineProps.validate) {
      const validateStage = repoCloudPipeline.addStage('Validate');
      const { action: validateAction, source, distribution } = buildArchiValidateAction(this, {
        ...repoCloudPipelineProps.validate,
        cloudAssembly,
        runOrder: validateStage.nextSequentialRunOrder(),
        cacheBucket,
      });
      const externalEntityLink = 'https://' + distribution.distributionDomainName;
      const approvalAction = new ManualApprovalAction({
        actionName: 'Approval',
        externalEntityLink,
        notifyEmails: repoCloudPipelineProps.validate.emails,
        runOrder: validateStage.nextSequentialRunOrder(),
      });
      const params = {
        sourceName: source.bucketName,
        distributionId: distribution.distributionId,
      };
      const { action: cleanupAction, grantee: cleanupFunc } = buildPyInvokeAction(this, {
        prefix: 'Cleanup',
        path: 'cdn-empty-handler',
        params,
        runOrder: validateStage.nextSequentialRunOrder(),
      });
      source.grantRead(cleanupFunc);
      source.grantDelete(cleanupFunc);
      distribution.grantInvalidate(cleanupFunc);
      validateStage.addActions(validateAction, approvalAction, cleanupAction);
    };
    const deploy = new CloudDeployStage(this, 'Deploy');
    repoCloudPipeline.addApplicationStage(deploy);
  }

}
