import { APIGatewayProxyHandlerV2 } from "aws-lambda";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import Ajv from "ajv";
import schema from "../shared/types.schema.json";

// Initialize DynamoDB Document Client and JSON Schema Validator
const ddbDocClient = createDDbDocClient();
const ajv = new Ajv();
const validateBook = ajv.compile(schema.definitions["Book"] || {});

export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  try {
    console.log("[EVENT]", JSON.stringify(event));

    const bookId = event.pathParameters?.bookId ? parseInt(event.pathParameters.bookId) : undefined;
    const body = event.body ? JSON.parse(event.body) : {};

    // Check if bookId is present
    if (!bookId) {
      return {
        statusCode: 400,
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ message: "Missing or invalid book ID" }),
      };
    }

    // Remove the 'id' field from the body to avoid updating it
    delete body.id;

    // Validate the remaining request body against schema
    if (!validateBook(body)) {
      return {
        statusCode: 400,
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ message: "Invalid request body", errors: validateBook.errors }),
      };
    }

    // Prepare update expression and attribute values
    const updateExpressionParts = [];
    const expressionAttributeValues: Record<string, any> = {};

    for (const [key, value] of Object.entries(body)) {
      updateExpressionParts.push(`#${key} = :${key}`);
      expressionAttributeValues[`:${key}`] = value;
    }

    const updateExpression = "SET " + updateExpressionParts.join(", ");

    // Send UpdateCommand to DynamoDB
    await ddbDocClient.send(
      new UpdateCommand({
        TableName: process.env.TABLE_NAME,
        Key: { id: bookId },
        UpdateExpression: updateExpression,
        ExpressionAttributeNames: Object.keys(body).reduce((acc, key) => ({ ...acc, [`#${key}`]: key }), {}),
        ExpressionAttributeValues: expressionAttributeValues,
        ReturnValues: "ALL_NEW", // Returns the updated item
      })
    );

    return {
      statusCode: 200,
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ message: "Book updated successfully" }),
    };

  } catch (error: any) {
    console.error("Error:", error);
    return {
      statusCode: 500,
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ error: error.message }),
    };
  }
};

// Helper function to create DynamoDB Document Client
function createDDbDocClient() {
  const ddbClient = new DynamoDBClient({ region: process.env.REGION });
  const marshallOptions = {
    convertEmptyValues: true,
    removeUndefinedValues: true,
    convertClassInstanceToMap: true,
  };
  const unmarshallOptions = { wrapNumbers: false };
  const translateConfig = { marshallOptions, unmarshallOptions };
  return DynamoDBDocumentClient.from(ddbClient, translateConfig);
}
