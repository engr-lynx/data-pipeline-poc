#!/usr/bin/env node
import 'source-map-support/register';
import { App } from '@aws-cdk/core';
import { RepoCloudPipelineStack } from '../lib/repo-cloud-pipeline-stack';
import { ArchiConf } from '../lib/context-helper';

const app = new App();
const env = {
  account: process.env.CDK_DEFAULT_ACCOUNT,
  region: process.env.CDK_DEFAULT_REGION,
};
const archiContext = app.node.tryGetContext('archi');
const archiConf = archiContext as ArchiConf;
new RepoCloudPipelineStack(app, archiConf.id, {
  ...archiConf.pipeline,
  env,
});
app.synth();
