import { join } from 'path';
import { Stack, SecretValue, Duration } from '@aws-cdk/core';
import { Artifact } from '@aws-cdk/aws-codepipeline';
import { GitHubSourceAction, CodeCommitSourceAction, CodeBuildAction, CodeBuildActionType, LambdaInvokeAction } from '@aws-cdk/aws-codepipeline-actions';
import { SimpleSynthAction } from '@aws-cdk/pipelines';
import { Repository } from '@aws-cdk/aws-codecommit';
import { PipelineProject, ComputeType, LinuxBuildImage, BuildSpec, Cache } from '@aws-cdk/aws-codebuild';
import { Repository as EcrRepository, AuthorizationToken } from '@aws-cdk/aws-ecr';
import { Bucket } from '@aws-cdk/aws-s3';
import { Asset } from '@aws-cdk/aws-s3-assets';
import { PythonFunction } from '@aws-cdk/aws-lambda-python';
import { PolicyStatement } from '@aws-cdk/aws-iam';
import { RetentionDays } from '@aws-cdk/aws-logs';
import { Cdn } from './cdn';
import { RepoType, CodeCommitConf, GitHubConf, ValidateConf, ComputeSize, BuildConf, StageConf } from './context-helper';

interface KeyValue {
  [key: string]: string,
}

interface BasePipelineHelperProps {
  prefix?: string,
}

export interface CodeCommitSourceActionProps extends BasePipelineHelperProps, CodeCommitConf {}

export interface GitHubSourceActionProps extends BasePipelineHelperProps, GitHubConf {}

export type RepoSourceActionProps = CodeCommitSourceActionProps | GitHubSourceActionProps

export function buildRepoSourceAction (scope: Stack, repoSourceActionProps: RepoSourceActionProps) {
  const prefix = repoSourceActionProps.prefix??'';
  const sourceCodeId = prefix + 'SourceCode';
  const sourceCode = new Artifact(sourceCodeId);
  const actionName = prefix + 'RepoSource';
  let action;
  switch(repoSourceActionProps.type) {
    case RepoType.CodeCommit:
      const codeCommitSourceActionProps = repoSourceActionProps as CodeCommitSourceActionProps;
      const repoId = prefix + 'Repo';
      const repository = codeCommitSourceActionProps.create ?
        new Repository(scope, repoId, {
          repositoryName: codeCommitSourceActionProps.name,
        }) :
        Repository.fromRepositoryName(scope, repoId, codeCommitSourceActionProps.name);
      action = new CodeCommitSourceAction({
        actionName,
        output: sourceCode,
        repository,
      });
      break;
    case RepoType.GitHub:
      const gitHubSourceActionProps = repoSourceActionProps as GitHubSourceActionProps;
      const gitHubToken = SecretValue.secretsManager(gitHubSourceActionProps.tokenName);
      action = new GitHubSourceAction({
        actionName,
        output: sourceCode,
        oauthToken: gitHubToken,
        owner: gitHubSourceActionProps.owner,
        repo: gitHubSourceActionProps.name,
      });
      break;
    default:
      throw new Error('Unsupported Type');
  };
  return {
    action,
    sourceCode,
  };
}

export interface YarnSynthActionProps extends BasePipelineHelperProps, BuildConf {
  sourceCode: Artifact,
}

export function buildYarnSynthAction (scope: Stack, yarnSynthActionProps: YarnSynthActionProps) {
  const prefix = yarnSynthActionProps.prefix??'';
  const cloudAssembly = new Artifact('CloudAssembly');
  const computeType = mapCompute(yarnSynthActionProps.compute);
  const environment = {
    buildImage: LinuxBuildImage.AMAZON_LINUX_2_3,
    computeType,
  };
  const actionName = prefix + 'Synth';
  const action = SimpleSynthAction.standardYarnSynth({
    actionName,
    sourceArtifact: yarnSynthActionProps.sourceCode,
    cloudAssemblyArtifact: cloudAssembly,
    buildCommand: 'npx yaml2json cdk.context.yaml > cdk.context.json',
    environment,
  });
  return {
    action,
    cloudAssembly,
  }
}

export interface ArchiValidateActionProps extends BasePipelineHelperProps, ValidateConf {
  cloudAssembly: Artifact,
  runOrder?: number,
  cacheBucket: Bucket,
}

export function buildArchiValidateAction (scope: Stack, archiValidateActionProps: ArchiValidateActionProps) {
  const prefix = archiValidateActionProps.prefix??'';
  const diagramsSite = new Cdn(scope, 'DiagramsSite');
  const path = join(__dirname, 'cloud-diagrams/index.html');
  const diagramsIndex = new Asset(scope, 'DiagramsIndex', {
    path,
  });
  const envVar = {
    SITE_SOURCE: diagramsSite.source.s3UrlForObject(),
    SITE_DISTRIBUTION: diagramsSite.distribution.distributionId,
    INDEX_ASSET: diagramsIndex.s3ObjectUrl,
  };
  const runtimes = {
    nodejs: 12,
  };
  const installCommands = [
    'yarn global add @mhlabs/cfn-diagram',
  ];
  const prebuildCommands = [
    'mkdir out',
    'jq -n "[]" > ./out/templates.json',
    'cd assembly-*',
  ];
  const buildCommands = [
    `for f in *.template.json ; do 
      cfn-dia h -c -t "\${f}" -o "../out/\${f%.template.json}" ; 
      echo $( jq ". + [\\"\${f%.template.json}\\"]" ../out/templates.json ) > ../out/templates.json ; 
    done`,
  ];
  const postbuildCommands = [
    'aws s3 sync ../out/ ${SITE_SOURCE}',
    'aws s3 cp ${INDEX_ASSET} ${SITE_SOURCE}/index.html --content-type text/html --metadata-directive REPLACE',
    'aws cloudfront create-invalidation --distribution-id ${SITE_DISTRIBUTION} --paths "/*"',
  ];
  const diagramsSpec = BuildSpec.fromObjectToYaml({
    version: '0.2',
    env: {
      variables: envVar,
    },
    phases: {
      install: {
        'runtime-versions': runtimes,
        commands: installCommands,
      },
      pre_build: {
        commands: prebuildCommands,
      },
      build: {
        commands: buildCommands,
      },
      post_build: {
        commands: postbuildCommands,
      },
    },
    cache: {
      paths: [
        '/usr/local/share/.config/yarn/global/**/*',
        '${HOME}/.config/yarn/global/**/*',
      ],
    },
  });
  const computeType = mapCompute(archiValidateActionProps.compute);
  const environment = {
    computeType,
    buildImage: LinuxBuildImage.AMAZON_LINUX_2_3,
  };
  const projectId = prefix + 'DiagramProject';
  const cache = Cache.bucket(archiValidateActionProps.cacheBucket, {
    prefix: projectId,
  });
  const diagramsProject = new PipelineProject(scope, projectId, {
    buildSpec: diagramsSpec,
    environment,
    cache,
  });
  diagramsSite.source.grantReadWrite(diagramsProject);
  diagramsIndex.grantRead(diagramsProject);
  diagramsSite.distribution.grantInvalidate(diagramsProject);
  const actionName = prefix + 'Diagram';
  const action = new CodeBuildAction({
    actionName,
    project: diagramsProject,
    input: archiValidateActionProps.cloudAssembly,
    runOrder: archiValidateActionProps.runOrder,
  });
  return {
    action,
    source: diagramsSite.source,
    distribution: diagramsSite.distribution,
  }
}

export interface ContBuildActionProps extends BasePipelineHelperProps, BuildConf {
  sourceCode: Artifact,
  envVar?: KeyValue,
  prebuildCommands?: string[];
  postbuildCommands?: string[];
}

export function buildContBuildAction (scope: Stack, contBuildActionProps: ContBuildActionProps) {
  const prefix = contBuildActionProps.prefix??'';
  const contRepoId = prefix + 'ContRepo';
  const contRepo = new EcrRepository(scope, contRepoId);
  const envVar = {
    ...contBuildActionProps.envVar,
    PREBUILD_SCRIPT: contBuildActionProps.prebuildScript,
    POSTBUILD_SCRIPT: contBuildActionProps.postbuildScript,
    REPO_URI: contRepo.repositoryUri,
  };
  const runtimes = {
    ...contBuildActionProps.runtimes,
    docker: 20.10,
  };
  const prebuildCommands = [];
  prebuildCommands.push(...contBuildActionProps.prebuildCommands??[]);
  prebuildCommands.push(
    '[ -f "${PREBUILD_SCRIPT}" ] && . ./${PREBUILD_SCRIPT} || [ ! -f "${PREBUILD_SCRIPT}" ]',
    'aws ecr get-login-password | docker login --username AWS --password-stdin ${REPO_URI}',
    'docker pull ${REPO_URI}:latest || true',
  );
  const postbuildCommands = [];
  postbuildCommands.push(
    'docker push ${REPO_URI}',
    '[ -f "${POSTBUILD_SCRIPT}" ] && . ./${POSTBUILD_SCRIPT} || [ ! -f "${POSTBUILD_SCRIPT}" ]',
  );
  postbuildCommands.push(...contBuildActionProps.postbuildCommands??[]);
  const contSpec = BuildSpec.fromObjectToYaml({
    version: '0.2',
    env: {
      variables: envVar,
    },
    phases: {
      install: {
        'runtime-versions': runtimes,
      },
      pre_build: {
        commands: prebuildCommands,
      },
      build: {
        commands: 'DOCKER_BUILDKIT=1 docker build --build-arg BUILDKIT_INLINE_CACHE=1 \
          --cache-from ${REPO_URI}:latest -t ${REPO_URI}:latest .',
      },
      post_build: {
        commands: postbuildCommands,
      },
    },
  });
  const computeType = mapCompute(contBuildActionProps.compute);
  const linuxPrivilegedEnv = {
    computeType,
    buildImage: LinuxBuildImage.AMAZON_LINUX_2_3,
    privileged: true,
  };
  const projectName = prefix + 'ContProject';
  const contProject = new PipelineProject(scope, projectName, {
    environment: linuxPrivilegedEnv,
    buildSpec: contSpec,
  });
  AuthorizationToken.grantRead(contProject);
  contRepo.grantPullPush(contProject);
  const actionName = prefix + 'ContBuild';
  const action = new CodeBuildAction({
    actionName,
    project: contProject,
    input: contBuildActionProps.sourceCode,
  });
  return {
    action,
    grantee: contProject,
    contRepo,
  };
}

export interface DroidBuildActionProps extends BasePipelineHelperProps, BuildConf {
  sourceCode: Artifact,
  envVar?: KeyValue,
  prebuildCommands?: string[];
  postbuildCommands?: string[];
  cacheBucket: Bucket,
}

export function buildDroidBuildAction (scope: Stack, droidBuildActionProps: DroidBuildActionProps) {
  const prefix = droidBuildActionProps.prefix??'';
  const apkFilesId = prefix + 'ApkFiles';
  const apkFiles = new Artifact(apkFilesId);
  const envVar = {
    ...droidBuildActionProps.envVar,
    PREBUILD_SCRIPT: droidBuildActionProps.prebuildScript,
    POSTBUILD_SCRIPT: droidBuildActionProps.postbuildScript,
  };
  const runtimes = {
    ...droidBuildActionProps.runtimes,
    android: 29,
    java: 'corretto8',
  };
  const prebuildCommands = [];
  prebuildCommands.push(...droidBuildActionProps.prebuildCommands??[]);
  prebuildCommands.push(
    '[ -f "${PREBUILD_SCRIPT}" ] && . ./${PREBUILD_SCRIPT} || [ ! -f "${PREBUILD_SCRIPT}" ]',
  );
  const postbuildCommands = [];
  postbuildCommands.push(
    '[ -f "${POSTBUILD_SCRIPT}" ] && . ./${POSTBUILD_SCRIPT} || [ ! -f "${POSTBUILD_SCRIPT}" ]',
  );
  postbuildCommands.push(...droidBuildActionProps.postbuildCommands??[]);
  const droidSpec = BuildSpec.fromObjectToYaml({
    version: '0.2',
    env: {
      variables: envVar,
    },
    phases: {
      install: {
        'runtime-versions': runtimes,        
      },
      pre_build: {
        commands: prebuildCommands,
      },
      build: {
        commands: './gradlew assembleDebug',
      },
      post_build: {
        commands: postbuildCommands,
      },
    },
    artifacts: {
      files: [
        './app/build/outputs/**/*.apk',
      ],
      'discard-paths': 'yes',
    },
    cache: {
      paths: [
        '${HOME}/.gradle/caches/**/*',
        '${HOME}/.gradle/jdks/**/*',
        '${HOME}/.gradle/wrapper/dists/**/*',
        './build-cache/**/*',
      ],
    },
  });
  const computeType = mapCompute(droidBuildActionProps.compute);
  const environment = {
    computeType,
    buildImage: LinuxBuildImage.AMAZON_LINUX_2_3,
  };
  const projectId = prefix + 'DroidProject';
  const cache = Cache.bucket(droidBuildActionProps.cacheBucket, {
    prefix: projectId,
  });
  const droidProject = new PipelineProject(scope, projectId, {
    buildSpec: droidSpec,
    environment,
    cache,
  });
  const actionName = prefix + 'DroidBuild';
  const action = new CodeBuildAction({
    actionName,
    project: droidProject,
    input: droidBuildActionProps.sourceCode,
    outputs: [
      apkFiles,
    ],
  });
  return {
    action,
    grantee: droidProject,
    apkFiles,
  };
}

export interface CustomActionProps extends BasePipelineHelperProps, StageConf {
  type?: CodeBuildActionType,
  input: Artifact,
  cacheBucket: Bucket,
}

export function buildCustomAction (scope: Stack, customActionProps: CustomActionProps) {
  const prefix = customActionProps.prefix??'';
  const artifactId = prefix + 'Artifact';
  const artifact = new Artifact(artifactId);
  const buildSpec = customActionProps.specFilename ?
    BuildSpec.fromSourceFilename(customActionProps.specFilename) :
    undefined;
  const computeType = mapCompute(customActionProps.compute);
  const environment = {
    computeType,
    buildImage: LinuxBuildImage.AMAZON_LINUX_2_3,
  };
  const projectId = prefix + 'Project';
  const cache = Cache.bucket(customActionProps.cacheBucket, {
    prefix: projectId,
  });
  const customProject = new PipelineProject(scope, projectId, {
    buildSpec,
    environment,
    cache,
  });
  const actionName = prefix + 'Action';
  const action = new CodeBuildAction({
    actionName,
    project: customProject,
    type: customActionProps.type,
    input: customActionProps.input,
    outputs: [
      artifact,
    ],
  });
  return {
    action,
    artifact,
  };
}

interface Policy {
  actions: string[],
  resources: string [],
}

export interface PyInvokeActionProps extends BasePipelineHelperProps {
  policies?: Policy[],
  path: string,
  index?: string,
  handler?: string,
  params?: KeyValue,
  runOrder?: number,
}

export function buildPyInvokeAction (scope: Stack, pyInvokeActionProps: PyInvokeActionProps) {
  const prefix = pyInvokeActionProps.prefix??'';
  const initialPolicy = pyInvokeActionProps.policies?.map(policy => new PolicyStatement(policy));
  const entry = join(__dirname, pyInvokeActionProps.path);
  const handlerName = prefix + 'Handler';
  const lambda = new PythonFunction(scope, handlerName, {
    entry,
    index: pyInvokeActionProps.index,
    handler: pyInvokeActionProps.handler,
    timeout: Duration.minutes(1),
    logRetention: RetentionDays.ONE_DAY,
    initialPolicy,
  });
  const actionName = prefix + 'Action';
  const action = new LambdaInvokeAction({
    actionName,
    lambda,
    userParameters: pyInvokeActionProps.params,
    runOrder: pyInvokeActionProps.runOrder,
  });
  return {
    action,
    grantee: lambda,
  };
}

export function mapCompute (compute?: ComputeSize) {
  switch (compute) {
    case ComputeSize.Small:
      return ComputeType.SMALL;
    case ComputeSize.Medium:
      return ComputeType.MEDIUM;
    case ComputeSize.Large:
      return ComputeType.LARGE;
    case ComputeSize.X2Large:
      return ComputeType.X2_LARGE;
    default:
      return;
  };
}
