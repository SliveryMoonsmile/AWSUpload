import * as cdk from 'aws-cdk-lib';
import { UploadPortalStack } from '../lib/upload-portal-stack';

const app = new cdk.App();
new UploadPortalStack(app, 'UploadPortalStack', {
  env: { account: process.env.CDK_DEFAULT_ACCOUNT, region: process.env.CDK_DEFAULT_REGION }
});
