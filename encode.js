const { TOKEN_TYPE_SET_TIME } = require('./constants');
const { encodeBase, getTokenBase, putBaseInToken } = require('./utils');
const generateNextToken = require('./generateNextToken');

module.exports = function encode(key, startingCode, value, count, mode) {                             
  const startingCodeBase = getTokenBase(startingCode);                               
  const tokenBase = encodeBase(startingCodeBase, value);                             
  let currentToken = putBaseInToken(startingCode, tokenBase);                        
                                                                                     
  const currentCountOdd = count % 2;                                                 
                                                                                     
  let newCount;                                                                      
  if (mode === TOKEN_TYPE_SET_TIME) {                                                
    newCount = currentCountOdd ? count + 2 : count + 1;                              
  } else {                                                                           
    newCount = currentCountOdd ? count + 1 : count + 2;                              
  }                                                                                  
                                                                                     
  for (let xn = 0; xn < newCount; xn++) {                                            
    currentToken = generateNextToken(currentToken, key);                             
  }                                                                                  
                                                                                     
  // ensure that final token has 9 digits.                                           
  // the implementation can consider 15 digit tokens but that won't be necessary here
  const finalToken = putBaseInToken(currentToken, tokenBase)                         
    .toString()                                                                      
    .padStart(9, '0');                                                               
                                                                                     
  return { newCount, finalToken };                                                   
}                                                                                    
