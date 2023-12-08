

import { CognitoToApiGatewayToLambda } from '@aws-solutions-constructs/aws-cognito-apigateway-lambda';
import { WafwebaclToApiGateway } from '@aws-solutions-constructs/aws-wafwebacl-apigateway';
import { CfnOutput, Duration, RemovalPolicy, Stack, StackProps } from 'aws-cdk-lib';
import { AuthorizationType, CognitoUserPoolsAuthorizer, Cors, LambdaIntegration, RequestValidator, RestApi } from 'aws-cdk-lib/aws-apigateway';
import { AccountRecovery, CfnUserPoolDomain, UserPool, UserPoolClient } from 'aws-cdk-lib/aws-cognito';
import { Policy, PolicyStatement } from 'aws-cdk-lib/aws-iam';
import { Code, HttpMethod, Runtime } from 'aws-cdk-lib/aws-lambda';
import { NagSuppressions } from 'cdk-nag';
import { Construct } from 'constructs';
import { WebACLConstruct } from './constructs/webacl';
import { Frontend } from './constructs/frontend';
import { Bucket, BlockPublicAccess, ObjectOwnership, BucketEncryption, HttpMethods } from 'aws-cdk-lib/aws-s3';
// Properties for the ordering-stack
export class InfrastureStack extends Stack {
  readonly userPool: UserPool;
  readonly client: UserPoolClient;
  readonly apigw: RestApi;
  readonly domainUrl: string;

  constructor(scope: Construct, id: string, props: StackProps) {
    super(scope, id);

    const logBucket = new Bucket(this, 's3AccessLogsBucket', {
      versioned: true,
      publicReadAccess: false,
      blockPublicAccess: BlockPublicAccess.BLOCK_ALL,
      removalPolicy: RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
      objectOwnership: ObjectOwnership.OBJECT_WRITER,
      encryption: BucketEncryption.S3_MANAGED,
    });

    const uploadBucket2 = Bucket.fromBucketName(this, 'mybucket', 'banyantree-user-files');


    const bucketName = `banyantree-user-files${this.account}`; 
    const uploadBucket = new Bucket(this, 'uploadBucket', {
      publicReadAccess: false,
      bucketName: bucketName,     
      blockPublicAccess: BlockPublicAccess.BLOCK_ALL,
      serverAccessLogsBucket: logBucket,
      removalPolicy: RemovalPolicy.RETAIN,
      encryption: BucketEncryption.S3_MANAGED,
      cors: [
        {
          allowedMethods: [HttpMethods.HEAD, HttpMethods.GET, HttpMethods.PUT],
          allowedOrigins: ['*'],
          allowedHeaders: ['Authorization', '*'],
        },
      ],
    });

    const cloudWatchPolicyStatement = new PolicyStatement({
      actions: ["logs:CreateLogGroup",
        "logs:CreateLogStream",
        "logs:PutLogEvents"],
      resources: [`arn:aws:logs:${this.region}:${this.account}:log-group:/aws/lambda/*:*`],
    });
    const cloudWatchPolicy = new Policy(this, `${id}-cloudwatch-policy`, {
      statements: [cloudWatchPolicyStatement],
    });

    const webacl = new WebACLConstruct(this, `${id}-webacl`);
    
    // Setup the API with Cognito user pool
    const congitoToApiGwToLambda = new CognitoToApiGatewayToLambda(this, 'air-quality-api', {
      lambdaFunctionProps: {
        functionName: `air-quality-cognito-lambda`,
        description: `Lambda Function to handle authorization for air quality requests.`,
        runtime: Runtime.NODEJS_18_X,
        code: Code.fromAsset(`${__dirname}/lambda/`),
        handler: 'asset.handler',
        timeout: Duration.seconds(15),
        environment: {
          UPLOAD_BUCKET: uploadBucket.bucketName,
          UPLOAD_BUCKET_REGION: this.region,
          UPLOAD_FOLDER: `raw/`,
          DOWNLOAD_FOLDER: `processed/`
        }
      },
      apiGatewayProps: {
        restApiName: "air-quality-api",
        proxy: false,
        description: 'air quality handler API',
      },
      cognitoUserPoolProps: {
        passwordPolicy: {
          requireLowercase: true,
          requireUppercase: true,
          requireDigits: true,
          requireSymbols: true,
          tempPasswordValidity: Duration.days(1),
        },
        selfSignUpEnabled: true,
        accountRecovery: AccountRecovery.EMAIL_ONLY,
        signInAliases: {
          email: true,
          username: false,
        },
        signInCaseSensitive: false,
        removalPolicy: RemovalPolicy.DESTROY,
      },
      cognitoUserPoolClientProps: {
        generateSecret: false,
        refreshTokenValidity: Duration.hours(2),
        oAuth: {
          flows: {
            authorizationCodeGrant: false,
            implicitCodeGrant: true,
            clientCredentials: false,

            refreshTokens: true
          }
        }
      }
    });

    congitoToApiGwToLambda.lambdaFunction.role?.attachInlinePolicy(cloudWatchPolicy);
    uploadBucket.grantPut(congitoToApiGwToLambda.lambdaFunction);
    uploadBucket.grantRead(congitoToApiGwToLambda.lambdaFunction);
    uploadBucket2.grantPut(congitoToApiGwToLambda.lambdaFunction);
    uploadBucket2.grantRead(congitoToApiGwToLambda.lambdaFunction);
    const statement = new PolicyStatement({
      actions: ['s3:ListBucket'],
      resources: [uploadBucket.bucketArn,
        uploadBucket2.bucketArn],
      conditions: {
        StringLike: {
          's3:prefix': 'processed'
        }
      }
    });
    congitoToApiGwToLambda.lambdaFunction.addToRolePolicy(statement);



    const airQualityReportsResource = congitoToApiGwToLambda.apiGateway.root.addResource("assets", {
      defaultCorsPreflightOptions: {
        allowOrigins: Cors.ALL_ORIGINS,
        allowHeaders: [
          'Content-Type',
          'X-Amz-Date',
          'Authorization',
          'X-Api-Key',
          'X-Amz-Security-Token'
        ],
        allowMethods: [HttpMethod.GET, HttpMethod.POST, HttpMethod.OPTIONS],
        allowCredentials: true
      }
    });

    new RequestValidator(this, `${id} - airQuality - request - validator`, {
      restApi: congitoToApiGwToLambda.apiGateway,
      // the properties below are optional
      requestValidatorName: 'airQualityRequestValidator',
      validateRequestBody: true,
      validateRequestParameters: true,
    });

    const airQualityIntegration = new LambdaIntegration(congitoToApiGwToLambda.lambdaFunction);

    const test = `${id.toLowerCase()}`; // "";
    const domainname = new CfnUserPoolDomain(this, `cognito domainname`, {
      domain: `airqualitybanyantree${test}`,
      userPoolId: congitoToApiGwToLambda.userPool.userPoolId
    })

    const assetApiAuthorizer = new CognitoUserPoolsAuthorizer(this, `${id}-airQuality-Authorizer`, {
      cognitoUserPools: [congitoToApiGwToLambda.userPool],
      identitySource: 'method.request.header.Authorization',
    });

    airQualityReportsResource.addMethod(HttpMethod.GET, airQualityIntegration, {
      authorizationType: AuthorizationType.COGNITO,
      authorizer: assetApiAuthorizer,
      methodResponses: [
        {
          statusCode: "200",
          responseParameters: {
            "method.response.header.Access-Control-Allow-Headers": true,
            "method.response.header.Access-Control-Allow-Methods": true,
            "method.response.header.Access-Control-Allow-Origin": true,
            "method.response.header.Access-Control-Allow-Credentials": true,
          },
        },
        { statusCode: "400" },
        { statusCode: "500" },
      ]
    });

    const airQualityReportUploadResource = airQualityReportsResource
      .addResource("upload", {
        defaultCorsPreflightOptions: {
          allowOrigins: Cors.ALL_ORIGINS,
          allowHeaders: [
            'Content-Type',
            'X-Amz-Date',
            'Authorization',
            'X-Api-Key',
            'X-Amz-Security-Token'
          ],
          allowMethods: [HttpMethod.GET, HttpMethod.POST, HttpMethod.OPTIONS],
          allowCredentials: true
        }
      });

    airQualityReportUploadResource.addMethod(HttpMethod.GET, airQualityIntegration, {
      authorizationType: AuthorizationType.COGNITO,
      authorizer: assetApiAuthorizer,
      methodResponses: [
        {
          statusCode: "200",
          responseParameters: {
            "method.response.header.Access-Control-Allow-Headers": true,
            "method.response.header.Access-Control-Allow-Methods": true,
            "method.response.header.Access-Control-Allow-Origin": true,
            "method.response.header.Access-Control-Allow-Credentials": true,
          },
        },
        { statusCode: "400" },
        { statusCode: "500" },
      ]
    });

    const airQualityReportByIdResource = airQualityReportsResource
      .addResource("{id}", {
        defaultCorsPreflightOptions: {
          allowOrigins: Cors.ALL_ORIGINS,
          allowHeaders: [
            'Content-Type',
            'X-Amz-Date',
            'Authorization',
            'X-Api-Key',
            'X-Amz-Security-Token'
          ],
          allowMethods: [HttpMethod.GET, HttpMethod.POST, HttpMethod.OPTIONS],
          allowCredentials: true
        }
      });

    airQualityReportByIdResource.addMethod(HttpMethod.GET, airQualityIntegration, {
      authorizationType: AuthorizationType.COGNITO,
      authorizer: assetApiAuthorizer,
      methodResponses: [
        {
          statusCode: "200",
          responseParameters: {
            "method.response.header.Access-Control-Allow-Headers": true,
            "method.response.header.Access-Control-Allow-Methods": true,
            "method.response.header.Access-Control-Allow-Origin": true,
            "method.response.header.Access-Control-Allow-Credentials": true,
          },
        },
        { statusCode: "400" },
        { statusCode: "500" },
      ]
    });

    congitoToApiGwToLambda.addAuthorizers();

    // This construct can only be attached to a configured API Gateway.
    new WafwebaclToApiGateway(this, `${id}-wafwebacl-apigateway`, {
      existingApiGatewayInterface: congitoToApiGwToLambda.apiGateway,
      existingWebaclObj: webacl.wafwebacl
    });

    this.userPool = congitoToApiGwToLambda.userPool;
    this.client = congitoToApiGwToLambda.userPoolClient;
    this.apigw = congitoToApiGwToLambda.apiGateway;
    this.domainUrl = domainname.domain;

    const wafwebaclToCloudFrontToS3 = new Frontend(this, 'AirQualityFrontEnd', {
      env: {
        account: props.env?.account,
        region: props.env?.region
      },
      userpool: this.userPool,
      client: this.client,
      backendApi: this.apigw.url,
    });

    new CfnOutput(this, "cloudfrontURL", { value: `${wafwebaclToCloudFrontToS3.cloudFrontWebDistribution.distributionDomainName}` });


    new CfnOutput(this, 'userPoolId', {
      value: this.userPool.userPoolId
    });
    new CfnOutput(this, 'userPoolClientId', {
      value: this.client.userPoolClientId,
    });
    new CfnOutput(this, 'region', {
      value: this.region
    });
    new CfnOutput(this, 'userPoolDomainURL', {
      value: `https://${this.domainUrl}.auth.${this.region}.amazoncognito.com/login`
    });

    NagSuppressions.addResourceSuppressions(scope, [
      { id: 'AwsSolutions-IAM5', reason: 'Suppressing IAM5 for roles generated by solution constructs' },
      { id: 'AwsSolutions-CB4', reason: 'Suppressing CB4 for roles generated by solution constructs' },
      { id: 'AwsSolutions-IAM4', reason: 'Suppressing IAM4 for roles generated by solution constructs' },
      { id: 'AwsSolutions-S1', reason: 'As W35, This S3 bucket is used as the access logging bucket for CloudFront Distribution' },
      { id: 'AwsSolutions-CFR4', reason: 'Since the distribution uses the CloudFront domain name, CloudFront automatically sets the security policy to TLSv1 regardless of the value of MinimumProtocolVersion' },
      { id: 'AwsSolutions-L1', reason: 'AWS Cloudformation custom resource creates Nodev16 version lambda instead of Node18' },
      { id: 'AwsSolutions-APIG4', reason: 'Options methods are not not behind Authorizer' },
      { id: 'AwsSolutions-COG4', reason: 'Options method are not not behind Authorizer' },
      { id: 'AwsSolutions-SMG4', reason: 'Rotation of Demo Secrets for Partner API is skipped.' },
    ], true);
  }
}
