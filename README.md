# airquality-hackathon-2023-banyantree



## Getting started

Bridging the Air Quality Data Gap: Secure and Predictive Analytics for Robust Sensor Networks Across Africa

## Description

Sensors Africa operates an extensive air quality sensor network across East,  West, and South Africa. They face challenges with sensor downtimes that lead to substantial data gaps in their air quality datasets. They are looking for a technical solution that can:
- Predict and fill in missing air quality data during sensor outages, using machine learning
- Provide a secure web portal for Africa’s Scientific Researchers, Citizen Scientists and Govt. bodies/Policymakers to access complete air quality datasets for further analysis

## Installation

- To build the project run:
```bash  
sh build.sh
```

- To deploy:
```bash  
cd infrastructure
cdk deploy
```

Note: Make sure you have set up your initial AWS credentials

# Welcome to your CDK TypeScript project

You should explore the contents of this project. It demonstrates a CDK app with an instance of a stack (`InfrastureStack`)
which contains an Amazon SQS queue that is subscribed to an Amazon SNS topic.

The `cdk.json` file tells the CDK Toolkit how to execute your app.

## Useful commands

* `npm run build`   compile typescript to js
* `npm run watch`   watch for changes and compile
* `npm run test`    perform the jest unit tests
* `cdk deploy`      deploy this stack to your default AWS account/region
* `cdk diff`        compare deployed stack with current state
* `cdk synth`       emits the synthesized CloudFormation template
