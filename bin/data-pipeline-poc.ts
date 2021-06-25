#!/usr/bin/env node
import 'source-map-support/register';
import { App } from '@aws-cdk/core';
import { RepoCloudPipelineStack } from '../lib/repo-cloud-pipeline-stack';
import { ArchiConf } from '../lib/context-helper';

const app = new App();
const archiContext = app.node.tryGetContext('archi');
const archiConf = archiContext as ArchiConf;
new RepoCloudPipelineStack(app, archiConf.id, {
  ...archiConf.pipeline,
});
app.synth();
