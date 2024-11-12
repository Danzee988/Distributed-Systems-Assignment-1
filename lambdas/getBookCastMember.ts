import { APIGatewayProxyHandlerV2 } from "aws-lambda";
import { BookCastMemberQueryParams } from "../shared/types";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  QueryCommand,
  QueryCommandInput,
} from "@aws-sdk/lib-dynamodb";
import Ajv from "ajv";
import schema from "../shared/types.schema.json";

const ajv = new Ajv();
const isValidQueryParams = ajv.compile(
  schema.definitions["BookCastMemberQueryParams"] || {}
);
 
const ddbDocClient = createDocumentClient();

export const handler: APIGatewayProxyHandlerV2 = async (event, context) => {
  try {
    console.log("[EVENT]", JSON.stringify(event));
    const bookIdString = event.pathParameters?.bookId || "";

    const bookId = parseInt(bookIdString, 10);

    if (!bookId) {
      return {
        statusCode: 400,
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          message: `Invalid bookId: ${bookIdString}`,
        }),
      }
    }

    const queryParams = { ...event.queryStringParameters, bookId: bookIdString};

    if (!isValidQueryParams(queryParams)) {
      return {
        statusCode: 500,
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          message: `Incorrect type. Must match Query parameters schema`,
          schema: schema.definitions["BookCastMemberQueryParams"],
        }),
      };
    }
    
    let commandInput: QueryCommandInput = {
      TableName: process.env.TABLE_NAME,
    };
    if ("roleName" in queryParams) {
      commandInput = {
        ...commandInput,
        IndexName: "roleIx",
        KeyConditionExpression: "bookId = :m and begins_with(roleName, :r) ",
        ExpressionAttributeValues: {
          ":m": bookId,
          ":r": queryParams.roleName,
        },
      };
    } else if ("name" in queryParams) {
      commandInput = {
        ...commandInput,
        KeyConditionExpression: "bookId = :m and begins_with(name, :a) ",
        ExpressionAttributeValues: {
          ":m": bookId,
          ":a": queryParams.name,
        },
      };
    } else {
      commandInput = {
        ...commandInput,
        TableName: process.env.TABLE_NAME,
        KeyConditionExpression: "bookId = :m",
        ExpressionAttributeValues: {
          ":m": bookId,
        },
      };
    }
    
    const commandOutput = await ddbDocClient.send(
      new QueryCommand(commandInput)
      );
      
      return {
        statusCode: 200,
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          data: commandOutput.Items,
        }),
      };
    } catch (error: any) {
      console.log(JSON.stringify(error));
      return {
        statusCode: 500,
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({ error }),
      };
    }
  };
  
  function createDocumentClient() {
    const ddbClient = new DynamoDBClient({ region: process.env.REGION });
    const marshallOptions = {
      convertEmptyValues: true,
      removeUndefinedValues: true,
      convertClassInstanceToMap: true,
    };
    const unmarshallOptions = {
    wrapNumbers: false,
  };
  const translateConfig = { marshallOptions, unmarshallOptions };
  return DynamoDBDocumentClient.from(ddbClient, translateConfig);
}