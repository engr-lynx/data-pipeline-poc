from time import time
from json import dumps, loads, JSONDecodeError
from logging import getLogger, INFO
from boto3 import client, resource
from botocore.exceptions import ClientError

logger = getLogger()
logger.setLevel(INFO)

s3 = resource('s3')
cf = client('cloudfront')
cp = client('codepipeline')

def handler(event, context):
  logger.info('Received event: %s' % dumps(event))
  cp_job = event['CodePipeline.job']
  job_id = cp_job['id']
  user_parameters_str = cp_job['data']['actionConfiguration']['configuration']['UserParameters']
  try:
    user_parameters = loads(user_parameters_str)
    empty_source(user_parameters['sourceName'])
    invalidate_distribution(user_parameters['distributionId'])
    cp.put_job_success_result(jobId=job_id)
  except ClientError as e:
    cp.put_job_failure_result(
      jobId=job_id,
      failureDetails={
        'type': 'JobFailed',
        'message': e.response['Error']['Message']
      }
    )
  except JSONDecodeError as e:
    logger.error('Error: %s', e)
    cp.put_job_failure_result(
      jobId=job_id,
      failureDetails={
        'type': 'ConfigurationError',
        'message': e.msg
      }
    )
  return

def empty_source(source_name):
  try:
    bucket = s3.Bucket(source_name)
    bucket.objects.delete()
  except ClientError as e:
    logger.error('Error: %s', e)
    raise e
  return

def invalidate_distribution(distribution_id):
  all_files = ['/*']
  time_reference = str(time()).replace('.', '')
  try:
    cf.create_invalidation(
      DistributionId=distribution_id,
      InvalidationBatch={
        'Paths': {
          'Quantity': 1,
          'Items': all_files
        },
        'CallerReference': time_reference
      }
    )
  except ClientError as e:
    logger.error('Error: %s', e)
    raise e
  return
