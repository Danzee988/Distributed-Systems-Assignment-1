import * as cdk from "aws-cdk-lib";
import * as lambdanode from "aws-cdk-lib/aws-lambda-nodejs";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import * as custom from "aws-cdk-lib/custom-resources";
import { Construct } from "constructs";
import { generateBatch } from "../shared/util";
import { books, bookCharacters } from "../seed/books";
import * as apig from "aws-cdk-lib/aws-apigateway";
import { get } from "http";
import { UserPool } from "aws-cdk-lib/aws-cognito";
import { AuthApi } from './auth-api'
import {AppApi } from './app-api'
import * as node from "aws-cdk-lib/aws-lambda-nodejs";

export class RestAPIStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

      // Setup Cognito User Pool-----------------------------------------------------------
      const userPool = new UserPool(this, "UserPool", {
        signInAliases: { username: true, email: true },
        selfSignUpEnabled: true,
        removalPolicy: cdk.RemovalPolicy.DESTROY,
      });
  
      const userPoolId = userPool.userPoolId;
  
      const appClient = userPool.addClient("AppClient", {
        authFlows: { userPassword: true },
      });
  
      const userPoolClientId = appClient.userPoolClientId;
  
      // Setup Auth API
      new AuthApi(this, 'AuthServiceApi', {
        userPoolId: userPoolId,
        userPoolClientId: userPoolClientId,
      });
  
      new AppApi(this, 'AppApi', {
        userPoolId: userPoolId,
        userPoolClientId: userPoolClientId,
      });

    // Tables--------------------------------------------------------------------------------
    const booksTable = new dynamodb.Table(this, "BookTable", {
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      partitionKey: { name: "id", type: dynamodb.AttributeType.NUMBER },
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      tableName: "Books",
    });

    const bookCastsTable = new dynamodb.Table(this, "BookCastTable", {
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      partitionKey: { name: "bookId", type: dynamodb.AttributeType.NUMBER },
      sortKey: { name: "name", type: dynamodb.AttributeType.STRING },
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      tableName: "BookCast",
    });

    bookCastsTable.addLocalSecondaryIndex({
      indexName: "roleIx",
      sortKey: { name: "roleName", type: dynamodb.AttributeType.STRING },
    });

    // Lambda functions----------------------------------------------------------------------
    new custom.AwsCustomResource(this, "booksddbInitData", {
      onCreate: {
        service: "DynamoDB",
        action: "batchWriteItem",
        parameters: {
          RequestItems: {
            [booksTable.tableName]: generateBatch(books),
            [bookCastsTable.tableName]: generateBatch(bookCharacters),
          },
        },
        physicalResourceId: custom.PhysicalResourceId.of("booksddbInitData"),
      },
      policy: custom.AwsCustomResourcePolicy.fromStatements([
        new cdk.aws_iam.PolicyStatement({
          actions: ["dynamodb:BatchWriteItem"],
          resources: [booksTable.tableArn, bookCastsTable.tableArn],
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
            CAST_TABLE_NAME: bookCastsTable.tableName,
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

      const translateBookFn = new lambdanode.NodejsFunction(this, "translateBookFn", {
        architecture: lambda.Architecture.ARM_64,
        runtime: lambda.Runtime.NODEJS_16_X,
        entry: `${__dirname}/../lambdas/translateBook.ts`,
        timeout: cdk.Duration.seconds(10),
        memorySize: 128,
        environment: {
          TABLE_NAME: booksTable.tableName,
          REGION: "eu-west-1",
        },
      });

      const getBookCastMembersFn = new lambdanode.NodejsFunction(
        this,
        "GetCastMemberFn",
        {
          architecture: lambda.Architecture.ARM_64,
          runtime: lambda.Runtime.NODEJS_16_X,
          entry: `${__dirname}/../lambdas/getBookCastMember.ts`,
          timeout: cdk.Duration.seconds(10),
          memorySize: 128,
          environment: {
            TABLE_NAME: bookCastsTable.tableName,
            REGION: "eu-west-1",
          },
        }
      );

    // Permissions--------------------------------------------------------------------------
    booksTable.grantReadWriteData(newBookFn);
    booksTable.grantReadWriteData(getAllBooksFn);
    booksTable.grantReadWriteData(deleteBookFn);
    booksTable.grantReadWriteData(getBookByIdFn);
    booksTable.grantReadWriteData(updateBookFn);
    booksTable.grantReadWriteData(translateBookFn);
    booksTable.grantReadWriteData(getBookCastMembersFn);

    bookCastsTable.grantReadWriteData(getBookCastMembersFn);
    bookCastsTable.grantReadWriteData(getBookByIdFn);
    // Add permission to access AWS Translate service
    translateBookFn.addToRolePolicy(new cdk.aws_iam.PolicyStatement({
      actions: [
        "translate:TranslateText",
        "comprehend:DetectDominantLanguage"
      ],
      resources: ["*"], // Limit the resources to the Translate service
    }));

    // Add permission to access AWS Translate service
    newBookFn.addToRolePolicy(new cdk.aws_iam.PolicyStatement({
      actions: [
        "translate:TranslateText",
        "comprehend:DetectDominantLanguage"
      ],
      resources: ["*"], // Limit the resources to the Translate service
    }));


    
    // Rest API------------------------------------------------------------------------------
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

    const appCommonFnProps = {
      architecture: lambda.Architecture.ARM_64,
      timeout: cdk.Duration.seconds(10),
      memorySize: 128,
      runtime: lambda.Runtime.NODEJS_16_X,
      handler: "handler",
      environment: {
        USER_POOL_ID: userPoolId,  
        CLIENT_ID: userPoolClientId,
        REGION: cdk.Aws.REGION,
      },
    };

    const authorizerFn = new node.NodejsFunction(this, "AuthorizerFn", {
      ...appCommonFnProps,
      entry: "./lambdas/auth/authorizer.ts",
    });

    const requestAuthorizer = new apig.RequestAuthorizer(
      this,
      "RequestAuthorizer",
      {
        identitySources: [apig.IdentitySource.header("Cookie")],
        handler: authorizerFn,
        resultsCacheTtl: cdk.Duration.minutes(0),
      }
    );
    
    // Add the POST method for adding a book to the 'books' resource
    booksEndpoint.addMethod("POST", new apig.LambdaIntegration(newBookFn, { proxy: true }), {
      authorizer: requestAuthorizer, 
      authorizationType: apig.AuthorizationType.CUSTOM,
    });

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

    const bookCastEndpoint = bookEndpoint.addResource("cast");
        bookCastEndpoint.addMethod(
            "GET",
            new apig.LambdaIntegration(getBookCastMembersFn, { proxy: true })
        );

    // Add a new resource for translation-----------------------------------------------------
    const translationEndpoint = bookEndpoint.addResource("translation");

    translationEndpoint.addMethod(
      "GET",
      new apig.LambdaIntegration(translateBookFn, { proxy: true })
    );
    }
}