import { APIGatewayProxyHandlerV2 } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import * as AWS from 'aws-sdk';

const translate = new AWS.Translate();
const ddbDocClient = createDDbDocClient();

export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  const pathParameters = event.pathParameters;
  if (!pathParameters) {
    return {
      statusCode: 400,
      body: JSON.stringify({ message: "Path parameters are required" }),
    };
  }

  const bookId = pathParameters.bookId;
  const language = event.queryStringParameters?.language;
  console.log(`Language received: ${language}`);

  if (!language) {
    return {
      statusCode: 400,
      body: JSON.stringify({ message: "Language query parameter is required" }),
    };
  }

  try {
    // Fetch the book from DynamoDB
    const getItemCommand = new GetCommand({
      TableName: process.env.TABLE_NAME,
      Key: { id: Number(bookId) },
    });

    const getItemResult = await ddbDocClient.send(getItemCommand);

    if (!getItemResult.Item) {
      return {
        statusCode: 404,
        body: JSON.stringify({ message: "Book not found" }),
      };
    }

    const book = getItemResult.Item;

    // Check if translations already exist for the given language
    const translations = book.translations || {};
    if (translations[language]) {
      return {
        statusCode: 200,
        body: JSON.stringify({ data: book }),
      };
    }

    // If not, translate the title and overview
    const translatedAttributes = await translateAttributes(book, language);

    // Update the book in DynamoDB with the new translations
    const updateItemCommand = new UpdateCommand({
      TableName: process.env.TABLE_NAME,
      Key: { id: Number(bookId) },
      UpdateExpression: 'SET translations = :translations',
      ExpressionAttributeValues: {
        ':translations': { ...translations, [language]: translatedAttributes },
      },
    });

    await ddbDocClient.send(updateItemCommand);

    // Return the book with translations
    return {
      statusCode: 200,
      body: JSON.stringify({ data: { ...book, translations: { ...translations, [language]: translatedAttributes } } }),
    };
  } catch (error) {
    console.error(error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: (error as Error).message }),
    };
  }
};

// Helper function to translate text attributes
async function translateAttributes(book: any, language: string) {
  const translatedAttributes: any = {};

  // Translate text attributes (title, overview, etc.)
  for (const [key, value] of Object.entries(book)) {
    if (typeof value === 'string' && key !== 'translations') {
      const translatedValue = await translateText(value, language);
      translatedAttributes[key] = translatedValue;
    }
  }

  return translatedAttributes;
}

// Helper function to call AWS Translate API
async function translateText(text: string, targetLanguage: string) {
  const params = {
    Text: text,
    SourceLanguageCode: 'auto',
    TargetLanguageCode: targetLanguage,
  };

  try {
    const result = await translate.translateText(params).promise();
    return result.TranslatedText;
  } catch (error) {
    console.error("Translation error:", error);
    throw new Error("Error translating text");
  }
}

// DynamoDB Document Client creation
function createDDbDocClient() {
  const ddbClient = new DynamoDBClient({ region: process.env.REGION });
  const marshallOptions = {
    convertEmptyValues: true,
    removeUndefinedValues: true,
    convertClassInstanceToMap: true,
  };
  const unmarshallOptions = { wrapNumbers: false };
  return DynamoDBDocumentClient.from(ddbClient, { marshallOptions, unmarshallOptions });
}
