import { S3Client, PutObjectCommand, GetObjectCommand, ListObjectsCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';

const client = new S3Client({
  region: process.env.AWS_REGION,
});

exports.handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  console.log(event);
  console.log(process.env.UPLOAD_BUCKET);
  const method = event.requestContext.httpMethod
  const path = event.requestContext.resourcePath
  switch (method.toLowerCase()) {
    case 'get':
      if (path === '/assets') {
        const s3key = event.queryStringParameters?.s3key;
        if (s3key) {
          console.log(`Requesting download url for : ${s3key}`);
          return await getSignedURL(s3key);
        }
        else {
          console.log(`Requesting all download urls`);
          return await getAllFiles(event);
        }
      } else if (path === '/assets/upload') {
        console.log(`Requesting upload url : with parameters: ${event.queryStringParameters}`);
        return await getUploadURL(event);

      } else {
        console.log(`Invalid request: ${path}`);
        return {
          statusCode: 400,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Headers': 'Authorization, *',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'OPTIONS,GET',
          },
          body: JSON.stringify({
            message: 'Invalid path',
          })
        }
      }
    default:
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Headers': 'Authorization, *',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'OPTIONS,GET',
        },
        body: JSON.stringify({
          message: 'Invalid request',
        })
      }
  }
};

const getUploadURL = async function (event: APIGatewayProxyEvent) {
  const body: any = event.queryStringParameters;
  if (!body || body == null) {
    return {
      statusCode: 400,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Headers': 'Authorization, *',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'OPTIONS,GET',
      },
      body: JSON.stringify({
        message: 'No body found',
      })
    }
  } else {
    console.log
    const apiRequestId = event.requestContext.requestId;
    const uploadFOlder = process.env.UPLOAD_FOLDER || "raw/";
    const filename = event.queryStringParameters?.filename || "tempfile";
    const contentType = event.queryStringParameters?.contentType;
    const timestamp = Math.floor(Date.now() / 1000);
    const s3Key = `${uploadFOlder}${timestamp}-${filename}-${apiRequestId}.${contentType}`;

    // Get signed URL from S3
    const putObjectParams = {
      Bucket: process.env.UPLOAD_BUCKET,
      Key: s3Key,
      ContentType: contentType,
    };
    const command = new PutObjectCommand(putObjectParams);

    const signedUrl = await getSignedUrl(client, command, { expiresIn: parseInt(process.env.URL_EXPIRATION_SECONDS || '300') });

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Headers': 'Authorization, *',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'OPTIONS,GET',
      },
      body: JSON.stringify({
        uploadURL: signedUrl,
        key: s3Key,
      }),
    };
  }

};

const getAllFiles = async function (event: APIGatewayProxyEvent) {
  const folder = process.env.DOWNLOAD_FOLDER || "processed/"
  const params = {
    Bucket: process.env.UPLOAD_BUCKET,
    Prefix: process.env.DOWNLOAD_FOLDER,
    Delimiter: '/',
    MaxKeys: 1000,
  }
  const assets = await client.send(new ListObjectsCommand(params));
  console.log(assets);
  if (assets.Contents === undefined || assets.Contents.length == 0) {
    return {
      statusCode: 400,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Headers': 'Authorization, *',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'OPTIONS,GET',
      },
      body: JSON.stringify({
        message: 'no files found',
      })
    }
  } else {
    const filesResponse: {
      lastModified: Date | undefined;
      size: number | undefined;
      filename: string | undefined;
      signedurl: string | undefined;
    }[] = [];
    for (let i = 0; i < assets.Contents.length; i++) {
      if (assets.Contents !== null && assets.Contents[i].Key !== undefined) {
        const lastModified = assets.Contents[i].LastModified;
        const size = assets.Contents[i].Size;
        let filename = assets.Contents[i].Key;
        console.log(`file: ${filename}`);
        if (filename !== undefined && filename !== '' && filename !== folder) {
          filename = filename.replace(folder, '');
          const signedURL = await getSignedURLString(filename);
          const fileRes = {
            lastModified: lastModified,
            size: size,
            filename: filename,
            signedurl: signedURL,
          }
          filesResponse.push(fileRes);
        }
      }
    }
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Headers': 'Authorization, *',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'OPTIONS,GET',
      },
      body: JSON.stringify(filesResponse),
    };
  }

};

const getSignedURL = async function (key: string) {

  const s3Key = `raw/${key}`;
  const getObjectParams = {
    Bucket: process.env.UPLOAD_BUCKET,
    Key: s3Key,
  };
  const command = new GetObjectCommand(getObjectParams);
  const signedUrl = await getSignedUrl(client, command, { expiresIn: parseInt(process.env.URL_EXPIRATION_SECONDS || '300') });
  return {
    statusCode: 200,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Headers': 'Authorization, *',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'OPTIONS,GET',
    },
    body: JSON.stringify(signedUrl),
  };
};

const getSignedURLString = async function (key: string) {

  const s3Key = `raw/${key}`;
  const getObjectParams = {
    Bucket: process.env.UPLOAD_BUCKET,
    Key: s3Key,
  };
  const command = new GetObjectCommand(getObjectParams);
  const signedUrl = await getSignedUrl(client, command, { expiresIn: parseInt(process.env.URL_EXPIRATION_SECONDS || '300') });
  return signedUrl
};