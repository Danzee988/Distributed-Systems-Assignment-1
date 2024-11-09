import * as cdk from "aws-cdk-lib";
import * as lambdanode from "aws-cdk-lib/aws-lambda-nodejs";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import * as custom from "aws-cdk-lib/custom-resources";
import { Construct } from "constructs";
// import * as sqs from 'aws-cdk-lib/aws-sqs';
import { generateBatch } from "../shared/util";
import { books } from "../seed/books";
import * as apig from "aws-cdk-lib/aws-apigateway";
import { get } from "http";

export class RestAPIStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // Tables 
    const booksTable = new dynamodb.Table(this, "BookTable", {
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      partitionKey: { name: "id", type: dynamodb.AttributeType.NUMBER },
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      tableName: "Books",
    });

    // Lambda functions
    new custom.AwsCustomResource(this, "booksddbInitData", {
      onCreate: {
        service: "DynamoDB",
        action: "batchWriteItem",
        parameters: {
          RequestItems: {
            [booksTable.tableName]: generateBatch(books),
          },
        },
        physicalResourceId: custom.PhysicalResourceId.of("booksddbInitData"),
      },
      policy: custom.AwsCustomResourcePolicy.fromStatements([
        new cdk.aws_iam.PolicyStatement({
          actions: ["dynamodb:BatchWriteItem"],
          resources: [booksTable.tableArn],
        }),
      ]),
    });

    const newBookFn = new lambdanode.NodejsFunction(this, "AddbookFn", {
      architecture: lambda.Architecture.ARM_64,
      runtime: lambda.Runtime.NODEJS_16_X,
      entry: `${__dirname}/../lambdas/addBook.ts`,
      timeout: cdk.Duration.seconds(10),
      memorySize: 128,
      environment: {
        TABLE_NAME: booksTable.tableName,
        REGION: "eu-west-1",
      },
    });

    const getAllBooksFn = new lambdanode.NodejsFunction(
      this,
      "GetAllBooksFn",
      {
        architecture: lambda.Architecture.ARM_64,
        runtime: lambda.Runtime.NODEJS_18_X,
        entry: `${__dirname}/../lambdas/getAllBooks.ts`,
        timeout: cdk.Duration.seconds(10),
        memorySize: 128,
        environment: {
          TABLE_NAME: booksTable.tableName,
          REGION: 'eu-west-1',
        },
      }
      );

      const getBookByIdFn = new lambdanode.NodejsFunction(
        this,
        "GetBookByIdFn",
        {
          architecture: lambda.Architecture.ARM_64,
          runtime: lambda.Runtime.NODEJS_18_X,
          entry: `${__dirname}/../lambdas/getBookById.ts`,
          timeout: cdk.Duration.seconds(10),
          memorySize: 128,
          environment: {
            TABLE_NAME: booksTable.tableName,
            REGION: 'eu-west-1',
          },
        }
        );

      const deleteBookFn = new lambdanode.NodejsFunction(this, "DeleteBookFn", {
        architecture: lambda.Architecture.ARM_64,
        runtime: lambda.Runtime.NODEJS_16_X,
        entry: `${__dirname}/../lambdas/deleteBook.ts`,
        timeout: cdk.Duration.seconds(10),
        memorySize: 128,
        environment: {
          TABLE_NAME: booksTable.tableName,
          REGION: "eu-west-1",
        },
      });

      const updateBookFn = new lambdanode.NodejsFunction(this, "updateBookFn", {
        architecture: lambda.Architecture.ARM_64,
        runtime: lambda.Runtime.NODEJS_16_X,
        entry: `${__dirname}/../lambdas/updateBook.ts`,
        timeout: cdk.Duration.seconds(10),
        memorySize: 128,
        environment: {
          TABLE_NAME: booksTable.tableName,
          REGION: "eu-west-1",
        },
      });

    // Permissions
    booksTable.grantReadWriteData(newBookFn);
    booksTable.grantReadWriteData(getAllBooksFn);
    booksTable.grantReadWriteData(deleteBookFn);
    booksTable.grantReadWriteData(getBookByIdFn);
    booksTable.grantReadWriteData(updateBookFn);
    
    // Rest API
    const api = new apig.RestApi(this, "RestAPI", {
      description: "demo api",
      deployOptions: {
        stageName: "dev",
      },
      defaultCorsPreflightOptions: {
        allowHeaders: ["Content-Type", "X-Amz-Date"],
        allowMethods: ["OPTIONS", "GET", "POST", "PUT", "PATCH", "DELETE"],
        allowCredentials: true,
        allowOrigins: ["*"],
      },
    });

    const booksEndpoint = api.root.addResource("books");

    booksEndpoint.addMethod(
      "POST",
      new apig.LambdaIntegration(newBookFn, { proxy: true })
    );

    booksEndpoint.addMethod(
      "GET",
      new apig.LambdaIntegration(getAllBooksFn, { proxy: true })
    );

    const bookEndpoint = booksEndpoint.addResource("{bookId}");
        bookEndpoint.addMethod(
          "GET",
          new apig.LambdaIntegration(getBookByIdFn, { proxy: true })
        );

        bookEndpoint.addMethod(
          "DELETE",
          new apig.LambdaIntegration(deleteBookFn, { proxy: true })
        );

        bookEndpoint.addMethod(
          "PUT",
          new apig.LambdaIntegration(updateBookFn, { proxy: true })
        );
    }
}