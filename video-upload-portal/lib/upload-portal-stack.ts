import * as cdk from 'aws-cdk-lib';
import { CfnOutput, Duration, RemovalPolicy, Stack, StackProps } from 'aws-cdk-lib';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as nodejs from 'aws-cdk-lib/aws-lambda-nodejs';
import * as s3 from 'aws-cdk-lib/aws-s3';
import { Construct } from 'constructs';

export class UploadPortalStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);
    const allowedOrigin = new cdk.CfnParameter(this, 'AllowedOrigin', {
      type: 'String', description: 'Exact HTTPS origin that hosts web/index.html, e.g. https://portal.example.com'
    });
    const uploadBucket = new s3.Bucket(this, 'UploadBucket', {
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      encryption: s3.BucketEncryption.S3_MANAGED,
      enforceSSL: true,
      versioned: true,
      removalPolicy: RemovalPolicy.RETAIN,
      lifecycleRules: [{ abortIncompleteMultipartUploadAfter: Duration.days(7) }],
      cors: [{ allowedMethods: [s3.HttpMethods.PUT], allowedOrigins: [allowedOrigin.valueAsString], allowedHeaders: ['content-type'], maxAge: 3000 }]
    });
    const userPool = new cognito.UserPool(this, 'PortalUsers', {
      selfSignUpEnabled: false,
      signInAliases: { email: true },
      passwordPolicy: { minLength: 14, requireDigits: true, requireLowercase: true, requireUppercase: true, requireSymbols: true },
      accountRecovery: cognito.AccountRecovery.EMAIL_ONLY,
      removalPolicy: RemovalPolicy.RETAIN
    });
    const client = userPool.addClient('PortalWebClient', { authFlows: { userSrp: true, userPassword: true }, generateSecret: false });
    const signer = new nodejs.NodejsFunction(this, 'PresignUpload', {
      entry: 'lib/lambda/presign.ts', runtime: lambda.Runtime.NODEJS_22_X, timeout: Duration.seconds(10), memorySize: 256,
      environment: { BUCKET_NAME: uploadBucket.bucketName, ALLOWED_ORIGIN: allowedOrigin.valueAsString }
    });
    uploadBucket.grantPut(signer);
    signer.addToRolePolicy(new iam.PolicyStatement({ actions: ['s3:AbortMultipartUpload'], resources: [uploadBucket.arnForObjects('*')] }));
    const api = new apigateway.RestApi(this, 'UploadApi', {
      deployOptions: { throttlingBurstLimit: 20, throttlingRateLimit: 10 },
      defaultCorsPreflightOptions: { allowOrigins: [allowedOrigin.valueAsString], allowMethods: ['POST', 'OPTIONS'], allowHeaders: ['Content-Type', 'Authorization'] }
    });
    const authorizer = new apigateway.CognitoUserPoolsAuthorizer(this, 'UserAuthorizer', { cognitoUserPools: [userPool] });
    api.root.addResource('uploads').addMethod('POST', new apigateway.LambdaIntegration(signer), { authorizationType: apigateway.AuthorizationType.COGNITO, authorizer });
    new CfnOutput(this, 'ApiUrl', { value: api.url });
    new CfnOutput(this, 'BucketName', { value: uploadBucket.bucketName });
    new CfnOutput(this, 'UserPoolId', { value: userPool.userPoolId });
    new CfnOutput(this, 'UserPoolClientId', { value: client.userPoolClientId });
  }
}
