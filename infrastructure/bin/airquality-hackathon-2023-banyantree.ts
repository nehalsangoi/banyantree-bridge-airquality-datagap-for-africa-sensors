#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib';
// import { AwsSolutionsChecks } from 'cdk-nag';
import { InfrastureStack } from '../lib/airquality-hackathon-2023-banyantree-stack';

const app = new cdk.App();
new InfrastureStack(app, 'InfrastureStackBT', {
    env: { region: process.env.CDK_DEFAULT_REGION, account: process.env.CDK_DEFAULT_ACCOUNT },
});

// cdk.Aspects.of(app).add(new AwsSolutionsChecks({ verbose: true }))