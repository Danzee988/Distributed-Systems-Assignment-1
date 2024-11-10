import { APIGatewayProxyHandlerV2 } from "aws-lambda";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, GetCommand, DeleteCommand } from "@aws-sdk/lib-dynamodb";
import jwt from "jsonwebtoken"; // Importing jwt for decoding tokens

const ddbDocClient = createDDbDocClient();

export const handler: APIGatewayProxyHandlerV2 = async (event, context) => {
  try {
    console.log("[EVENT]", JSON.stringify(event));

    // Retrieve bookId from path parameters
    const bookId = event.pathParameters?.bookId ? parseInt(event.pathParameters.bookId) : undefined;

    if (!bookId) {
      return {
        statusCode: 404,
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({ message: "Missing Book Id" }),
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

    // Decode the JWT to get the user ID
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
        body: JSON.stringify({ message: "You are not authorized to delete this book" }),
      };
    }

    // Proceed with the deletion of the book
    await ddbDocClient.send(
      new DeleteCommand({
        TableName: process.env.TABLE_NAME,
        Key: { id: bookId },
      })
    );

    return {
      statusCode: 200,
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({ message: "Book deleted" }),
    };
  } catch (error: any) {
    console.error("Error:", JSON.stringify(error));
    return {
      statusCode: 500,
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({ error }),
    };
  }
};

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
