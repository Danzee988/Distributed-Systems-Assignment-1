import { APIGatewayProxyHandlerV2 } from "aws-lambda";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand } from "@aws-sdk/lib-dynamodb";
import Ajv from "ajv";
import schema from "../shared/types.schema.json";
import jwt from "jsonwebtoken"; // Import jwt-decode or jsonwebtoken

const ajv = new Ajv();
const isValidBodyParams = ajv.compile(schema.definitions["Book"] || {});

const ddbDocClient = createDDbDocClient();

export const handler: APIGatewayProxyHandlerV2 = async (event, context) => {
  try {
    // Log the event for debugging
    console.log("[EVENT]", JSON.stringify(event));

    // Extract the token from the Authorization header or Cookie
    const token = event.headers.Authorization || getCookie(event.headers as { [key: string]: string }, 'token'); // Adjust this based on your header or cookie usage
    if (!token) {
      return {
        statusCode: 401,
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({ message: "Authorization token missing" }),
      };
    }

    // Decode the JWT to get the `sub` (user ID)
    let userId;
    try {
      const decodedToken = jwt.decode(token) as { sub: string }; // The 'sub' field is typically the user ID in JWTs
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

    // Parse the body
    const body = event.body ? JSON.parse(event.body) : undefined;
    if (!body) {
      return {
        statusCode: 500,
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({ message: "Missing request body" }),
      };
    }

    delete body.user_id;

    // Add userId to the body
    body.user_id = userId;

    // Validate body with the schema
    if (!isValidBodyParams(body)) {
      return {
        statusCode: 400,
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          message: `Incorrect type. Must match Book schema`,
          schema: schema.definitions["Book"],
        }),
      };
    }

    // Save the item to DynamoDB
    const commandOutput = await ddbDocClient.send(
      new PutCommand({
        TableName: process.env.TABLE_NAME,
        Item: body,
      })
    );

    // Return success response
    return {
      statusCode: 201,
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({ message: "Book added" }),
    };
  } catch (error: any) {
    console.log("Error:", JSON.stringify(error));
    return {
      statusCode: 500,
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({ error }),
    };
  }
};

// Helper function to get the token from cookies (if you're passing it via cookies)
function getCookie(headers: { [key: string]: string }, cookieName: string): string | undefined {
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

function createDDbDocClient() {
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
