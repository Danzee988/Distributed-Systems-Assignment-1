import { marshall } from "@aws-sdk/util-dynamodb";
import { Book, BookCharacters, } from "./types";

type Entity = Book | BookCharacters;  // NEW
export const generateItem = (entity: Entity) => {
  return {
    PutRequest: {
      Item: marshall(entity),
    },
  };
};

export const generateBatch = (data: Entity[]) => {
  return data.map((e) => {
    return generateItem(e);
  });
};