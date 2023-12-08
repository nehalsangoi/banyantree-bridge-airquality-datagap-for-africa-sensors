import "./App.css";
import Header from "./components/Header";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import Home from "./components/Home";
import { Amplify, Auth } from 'aws-amplify';
import '@aws-amplify/ui-react/styles.css';
import { Authenticator } from '@aws-amplify/ui-react';
import config from './config';

function App() {
  const amplifyConfig = {
    ...(true || config.userPoolId != null
      ? {
        Auth: {
          region: config.awsRegion,
          userPoolId: config.userPoolId,
          userPoolWebClientId: config.userPoolClientId,
        },
      }
      : {}),
    API: {
      endpoints: [
        {
          name: 'assets',
          endpoint: config.apiEndpoint,
          custom_header: async () => {
            return {
              Authorization: `${(await Auth.currentSession())?.getIdToken().getJwtToken()}`
            };
          },
        },
        {
          name: 'getAssets',
          endpoint: process.env.REACT_APP_API_URL + 'assets',
        },
      ],
    },
  };
  const formFields = {
    signIn: {
      username: {
        labelHidden: false,
        placeholder: 'Enter your email here',
        isRequired: true,
        label: 'Email:'
      },
    },
    signUp: {
      username: {
        labelHidden: false,
        placeholder: 'Enter your email here',
        isRequired: true,
        label: 'Email:'
      },
    },
  }
  Amplify.configure(amplifyConfig);

  return (
    <>
      {/* {authStatus !== 'authenticated' ? <>Please Login!</> : <></>} */}
      <Authenticator formFields={formFields}>
        {({ signOut }) => (
          <>
            <BrowserRouter>
              <Header signOut={signOut} />
              <div className="App">
                <Routes>
                  <Route path="/" element={<Home />} />
                </Routes>
              </div>
            </BrowserRouter>
          </>
        )}
      </Authenticator>
    </>
  );
}

export default App;
