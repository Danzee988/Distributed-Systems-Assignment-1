import { APIGatewayProxyHandlerV2 } from "aws-lambda";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, GetCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import Ajv from "ajv";
import schema from "../shared/types.schema.json";
import jwt from "jsonwebtoken"; // Import jwt to decode the token

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

    // Validate the remaining request body against schema
    if (!validateBook(body)) {
      return {
        statusCode: 400,
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ message: "Invalid request body", errors: validateBook.errors }),
      };
    }

    // Extract the token from the Cookie header
    const token = getCookie(event.headers, 'token');
    if (!token) {
      return {
        statusCode: 401,
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({ message: "Authorization token missing" }),
      };
    }

    // Decode the JWT token to extract the user_id
    let userId;
    try {
      const decodedToken = jwt.decode(token) as { sub: string };
      userId = decodedToken?.sub;
    } catch (error) {
      console.error("Failed to decode token:", error);
      return {
        statusCode: 401,
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({ message: "Invalid token" }),
      };
    }

    // Fetch the book from DynamoDB
    const getBookOutput = await ddbDocClient.send(
      new GetCommand({
        TableName: process.env.TABLE_NAME,
        Key: { id: bookId },
      })
    );

    // If the book does not exist, return a 404
    if (!getBookOutput.Item) {
      return {
        statusCode: 404,
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({ message: "Book not found" }),
      };
    }

    // Check if the user_id in the book matches the user_id from the token
    const bookUserId = getBookOutput.Item.user_id;
    if (userId !== bookUserId) {
      return {
        statusCode: 403,
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({ message: "You are not authorized to update this book" }),
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
      body: JSON.stringify({ message: "Book updated successfully", userId: userId }),
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

// Helper function to get the token from cookies
function getCookie(headers: { [key: string]: string | undefined }, cookieName: string): string | undefined {
  const cookies = headers['Cookie'] || '';
  const cookieArray = cookies.split(';');
  for (const cookie of cookieArray) {
    const [name, value] = cookie.trim().split('=');
    if (name === cookieName) {
      return value;
    }
  }
  return undefined;
}
