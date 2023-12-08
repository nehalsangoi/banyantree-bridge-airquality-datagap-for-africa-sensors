import React, { useMemo, useState, useEffect } from 'react';
import { API } from 'aws-amplify';
import './upload.css';
import { Card, Text } from '@aws-amplify/ui-react';
import { useDropzone } from 'react-dropzone';
import '@aws-amplify/ui-react/styles.css';
import axios from 'axios';
const apiName = 'assets';

const baseStyle = {
  flex: 1,
  width: '50%',
  display: 'inline-block',
  flexDirection: 'column',
  alignItems: 'center',
  padding: '20px',
  borderWidth: 3,
  borderRadius: 8,
  borderColor: '#eeeeee',
  borderStyle: 'dashed',
  backgroundColor: '#fafafa',
  color: '#bdbdbd',
  outline: 'none',
  transition: 'border .24s ease-in-out'
};

const focusedStyle = {
  borderColor: '#2196f3'
};

const acceptStyle = {
  borderColor: '#00e676'
};

const rejectStyle = {
  borderColor: '#ff1744'
};

function StyledDropzone(props) {
  const {
    getRootProps,
    getInputProps,
    isFocused,
    isDragAccept,
    isDragReject
  } = useDropzone({ onDrop: props.onDrop });


  const style = useMemo(() => ({
    ...baseStyle,
    ...(isFocused ? focusedStyle : {}),
    ...(isDragAccept ? acceptStyle : {}),
    ...(isDragReject ? rejectStyle : {})
  }), [
    isFocused,
    isDragAccept,
    isDragReject
  ]);

  return (
    <div className="container">
      <div {...getRootProps({ style })}>
        <input {...getInputProps()} />
        <p>Drag 'n' drop some files here, or click to select files</p>
      </div>
    </div>
  );
}

function Upload() {

  const [assets, setAssets] = useState([]);

  const fetchProducts = async () => {
    await API.get('assets', 'assets').then(response => {
      if (response) {
        console.log(response)
        setAssets(response)
      }
      return response;
    }).catch(error => { console.log(`Error:  ${JSON.stringify(error)}`) });
  };

  useEffect(() => {
    fetchProducts();
  }, []);

  const [file, setFile] = useState();
  const [status, setStatus] = useState();
  const [objectKey, setObjectKey] = useState('');
  const [uploadURL, setUploadURL] = useState('');
  const [error, setError] = useState('');


  const onDrop = (files) => {
    let file = files[0];
    const contentType = file.name

    API.get(apiName, 'assets/upload', {
      queryStringParameters: {
        'contentType': contentType.split(".")[1],
        'filename': file.name,
      }
    })
      .then((response) => {
        setObjectKey(response.key);
        setUploadURL(response.uploadURL);
        axios.put(response.uploadURL, file, {
          headers: {
            'content-type': file.type
          }
        }).then((response) => {
          setFile(file);
          setStatus(response.status);
          fetchProducts();
        }).catch((error) => {
          setStatus(error.status);
          setError(error);
          console.error(error);
        });
      })
      .catch((error) => {
        setError(error);
        console.error(error);
      });
  };

  return (
    <div className="Upload">
      <div style={{ textAlign: 'center', padding: '20px' }}>
        <Card variation="elevated" style={{ width: '90%', display: 'inline-block', textAlign: 'center' }}>
          <h2>Upload Assets</h2>
          <p>Upload your assets to the cloud for processing:</p>
          <StyledDropzone onDrop={onDrop} />
          <br />
          {status && status === 200 ? (
            <div>
              <h3>Your file was successfully uploaded:</h3>
              <Text>{objectKey}</Text>
            </div>
          ) : error ? (<span style={{ 'color': 'red' }}> {error}</span>) : (<></>)
          }
        </Card>
        <div>
          <h2>Processed files:</h2><br />
          <p>Click on the file to download the asset!</p>
          <table style={{border: "4px solid black"}}>
            <thead>
              <tr style={{border: "2px solid black"}}>
                <th>Filename</th>
                <th>Size</th>
                <th>Uploaded at</th>
              </tr>
            </thead>
            <tbody>
              {assets.map((asset) => (
                <tr key={asset.filename} style={{border: "2px solid black"}}>
                  <td style={{border: "1px solid black"}}><a href={asset.signedurl} target="_blank"> {asset.filename}</a></td>
                  <td style={{border: "1px solid black"}}>{asset.size}</td>
                  <td style={{border: "1px solid black"}}>{asset.lastModified}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>


    </div>
  );
}

export default Upload;
