import { JsonSchemaType } from "aws-cdk-lib/aws-apigateway";


export const GetAssetSchema = {
  type: JsonSchemaType.OBJECT,
  properties: {
    id: { type: JsonSchemaType.STRING },
  },
};

export const PostAssetSchema = {
  type: JsonSchemaType.OBJECT,
  properties: {
    filename: { type: JsonSchemaType.STRING, maxLength: 128 },
    contenttype: { type: JsonSchemaType.STRING, maxLength: 64 }
  },
};