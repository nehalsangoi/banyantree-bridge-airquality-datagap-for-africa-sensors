import { createContext, useContext, useReducer } from "react";
import { assetReducer } from "./Reducers";
const Asset = createContext();


const Context = ({ children }) => {
  const [state, dispatch] = useReducer(assetReducer, {
    asset: [],
  });


  return (
    <Asset.Provider value={{ state, dispatch, }}>
      {children}
    </Asset.Provider>
  );
};

export const AssetState = () => {
  return useContext(Asset);
};

export default Context;
