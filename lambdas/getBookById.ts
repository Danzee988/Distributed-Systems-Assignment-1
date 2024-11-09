import { APIGatewayProxyHandlerV2 } from "aws-lambda";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, GetCommand } from "@aws-sdk/lib-dynamodb";

// Create DynamoDB Document Client
const ddbDocClient = createDDbDocClient();

export const handler: APIGatewayProxyHandlerV2 = async (event, content) => {
  try {
    console.log("[EVENT]", JSON.stringify(event));

    const parameters = event?.pathParameters;
    const bookId = parameters?.bookId ? parseInt(parameters.bookId) : undefined;

    console.log("bookId:", bookId); // Log the bookId for debugging

    if (!bookId) {
      return {
        statusCode: 400, // Changed to 400 to indicate bad request
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ message: "Missing or invalid book Id" }),
      };
    }

    // Fetch book metadata from books table
    const bookCommandOutput = await ddbDocClient.send(
      new GetCommand({
        TableName: process.env.TABLE_NAME, // books table name
        Key: { id: bookId }, // Make sure the partition key is 'id' in your DynamoDB table schema
      })
    );

    console.log("bookCommandOutput:", JSON.stringify(bookCommandOutput)); // Log the output

    if (!bookCommandOutput.Item) {
      return {
        statusCode: 404,
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ message: "No book found with the given Id" }),
      };
    }

    let responseBody = { data: bookCommandOutput.Item };

    // Return the book details
    return {
      statusCode: 200,
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ responseBody }),
    };

  } catch (error: any) {
    console.error("Error:", JSON.stringify(error)); // Log the error
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
