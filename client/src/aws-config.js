export const awsConfig = {
  Auth: {
    Cognito: {
      userPoolId: "us-west-2_8hJ9rdYYz",  
      userPoolClientId: "REDACTED_CLIENT_ID", 
      signUpVerificationMethod: 'code',
      loginWith: {
        email: true
      }
    }
  }
};
