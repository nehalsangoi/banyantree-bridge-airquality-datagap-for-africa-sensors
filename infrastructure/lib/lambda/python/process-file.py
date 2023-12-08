import io
import boto3
import json
import codecs
import pandas as pd
from io import StringIO
        

# Initialize the clients
s3 = boto3.client('s3')
client = boto3.client("runtime.sagemaker")

def get_predicted_value(row):

    ''' for each row where value == null '''
    if pd.isna(row['value']):
        
        ''' Call sagemaker endpoint to get prediction '''
        if row['parameter'] == 'PM 1':
            model_endpoint = "canvas-banyantree-pm1"
        elif row['parameter'] == 'PM 2.5':
            model_endpoint = "canvas-banyantree-pm25"
        elif row['parameter'] == 'PM 10':
            model_endpoint = "canvas-banyantree-pm10"
        else:
            model_endpoint = "canvas-banyantree-pm1"

        month_month = pd.Timestamp(row['timestamp']).month
        day_day = pd.Timestamp(row['timestamp']).day
        hour_hour = pd.Timestamp(row['timestamp']).hour
        
        data = {
            "timestamp": [row['timestamp']],
            "parameter": [row['parameter']],
            "sensor_type": [row['sensor_type']],
            "latitude": [row['latitude']],
            "longitude": [row['longitude']],
            "month_month": [month_month],
            "hour_hour": [hour_hour],
            "day_day": [day_day]
        }

        body = pd.DataFrame(data).to_csv(header=False, index=False).encode("utf-8")
        #print("Body: {}".format(body))
        
        response = client.invoke_endpoint(
            EndpointName=model_endpoint,
            ContentType="text/csv",
            Body=body,
            Accept="application/json"
        )
        print("Response from invoke_endpoint: {}".format(response))
        response_body = json.load(codecs.getreader('utf-8')(response['Body']))
        score = (response_body['predictions'][0]['score'])
        score = round(score, 2)
        print("Predicted score returned by Model: {}".format(score))
        return score
    else:
        #print("Value exists in row: {}, Skipping prediction".format(row['value']))
        return row['value']


def lambda_handler(event, context):
    print("Event: {}".format(event))
    
    # Extract the S3 bucket and object key of the CSV file
    s3_obj = event['Records'][0]['s3']
    bucket_name = s3_obj['bucket']['name']
    file_key = s3_obj['object']['key']
    
    print("S3 bucket: {}, File uploaded: {}".format(bucket_name, file_key))
    
    try:
        # Read the CSV file from S3
        response = s3.get_object(Bucket=bucket_name, Key=file_key)
        csv_content = response['Body'].read().decode('utf-8')

        # Create a Pandas DataFrame
        
        df = pd.read_csv(io.StringIO(csv_content))
        #df[['value', 'is_predicted']] = df.apply(lambda row:get_predicted_value(row), axis=1)
        df['value'] = df.apply(lambda row:get_predicted_value(row), axis=1)

        pd.set_option('display.max_columns', None)
        print(df.head(5))
        
        out_file_key = "processed/{}".format(file_key.split("/")[1])
        csv_buffer = StringIO()
        df.to_csv(csv_buffer, header=True, index=False)
        s3_resource = boto3.resource('s3')
        s3_resource.Object(bucket_name, out_file_key).put(Body=csv_buffer.getvalue())

        return {
            'statusCode': 200,
            'body': 'File read successfully into DataFrame.'
        }

    except Exception as e:
        print("Exception: {}".format(str(e)))
        raise
    
        return {
            'statusCode': 500,
            'body': str(e)
        }
    
