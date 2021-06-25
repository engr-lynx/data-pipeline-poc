# AWS Data Pipeline IaC and CI/CD

Simplify building on AWS by adopting this [CDK](https://docs.aws.amazon.com/cdk/latest/guide/home.html) boilerplate for an [IaC Pipeline](https://searchitoperations.techtarget.com/tip/Building-an-infrastructure-as-code-pipeline-in-the-cloud). If you're new to AWS, this can help. It contains pre-made architectural decisions allowing you to get started quickly. Yet because it's IaC, you also have flexibility. You can easily update your architecture by pushing code modifications to your repository. 

## Sample Usage

(to be added)

## Prerequisites

* a development machine with [Yarn](https://yarnpkg.com/getting-started/install) and [CDK](https://docs.aws.amazon.com/cdk/latest/guide/getting_started.html)
* [IAM admin](https://docs.aws.amazon.com/IAM/latest/UserGuide/getting-started_create-admin-group.html) with [programmatic access](https://docs.aws.amazon.com/IAM/latest/UserGuide/id_users_create.html)
* if going to use CodeCommit, relevant IAM users should have [credentials set up](https://docs.aws.amazon.com/IAM/latest/UserGuide/id_credentials_ssh-keys.html)
* if going to use GitHub, [access token](https://docs.github.com/en/github/authenticating-to-github/keeping-your-account-and-data-secure/creating-a-personal-access-token) needs to be in [Secrets Manager](https://docs.aws.amazon.com/secretsmanager/latest/userguide/tutorials_basic.html)

## Initial Deployment

* Configure `cdk.context.yaml`. See [Schema](#schema) below.
* Install the dependencies:
```bash
yarn install
npx yaml2json cdk.context.yaml > cdk.context.json
```
* Test that the configuration and code synthesizes properly:
```bash
cdk synth
```
* [Bootstrap CDK](https://docs.aws.amazon.com/cdk/latest/guide/bootstrapping.html) in the AWS account and region to be used:
```bash
cdk bootstrap \
  --cloudformation-execution-policies arn:aws:iam::aws:policy/AdministratorAccess \
  aws://<account>/<region>
```
* Deploy this pipeline:
```bash
cdk deploy
```
* If CodeCommit is created for this IaC code, [connect the local to the remote repo](https://docs.aws.amazon.com/codecommit/latest/userguide/how-to-connect.html#how-to-connect-local).

## Screenshots

![IaC Pipeline 1](https://res.cloudinary.com/engr-lynx/image/upload/v1623983025/iac/iac-pipeline-1.png "IaC Pipeline 1")
![IaC Pipeline 2](https://res.cloudinary.com/engr-lynx/image/upload/v1623983025/iac/iac-pipeline-2.png "IaC Pipeline 2")

## Tech Stack

[CDK](https://docs.aws.amazon.com/cdk/latest/guide/home.html), [CDK Pipelines](https://aws.amazon.com/blogs/developer/cdk-pipelines-continuous-delivery-for-aws-cdk-applications/), TypeScript

## FAQ

#### How does an IaC pipeline simplify building on the cloud?

(to be added)

#### Why use CDK instead of CloudFormation scripts?

(to be added)

#### What value does CDK Pipelines add to CDK?

(to be added)

## Schema

#### archi

| Field | Type | Description |
| :- | :- | :- |
| `id` | `string` | **Required**. ID for this pipeline |
| `pipeline` | **_`pipeline`_** | **Required**. pipeline definition |

#### pipeline

| Field | Type | Description |
| :- | :- | :- |
| `repo` | **_`repo`_** | **Required**. source stage definition |
| `build` | **_`build`_** | build stage definition |
| `validate` | **_`validate`_** | validate stage definition |

#### repo (CodeCommit)

| Field | Type | Description |
| :- | :- | :- |
| `type` | _`CodeCommit`_ | **Required**. literal if CodeCommit |
| `name` | `string` | **Required**. name of the repo |
| `create` | `boolean` | whether to create or pre-existing |

#### repo (GitHub)

| Field | Type | Description |
| :- | :- | :- |
| `type` | _`GitHub`_ | **Required**. literal if GitHub |
| `name` | `string` | **Required**. GitHub repo name |
| `tokenName` | `string` | **Required**. Secrets Manager token name |
| `owner` | `string` | **Required**. GitHub account name |

#### build

| Field | Type | Description |
| :- | :- | :- |
| `compute` | _`Small / Medium / Large / 2xLarge`_ | build container compute size |

#### validate

| Field | Type | Description |
| :- | :- | :- |
| `compute` | _`Small / Medium / Large / 2xLarge`_ | validate container compute size |
| `emails` | `array of strings` | email addresses to send notification |
