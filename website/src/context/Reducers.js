export const assetReducer = (state, action) => {
  switch (action.type) {
    case "UPLOAD_ASSET":
      return { ...state, asset: [...state.asset, { ...action.payload, qty: 1 }] };
    case "REMOVE_ASSET":
      return { ...state, asset: state.asset.filter((item) => item.id !== action.payload) };
    case "GET_ALL_ASSETS":
      return { ...state, asset: action.payload };
    case "GET_ASSET_BY_ID":
      return { ...state, asset: action.payload };
    default:
      return state;
  }
};