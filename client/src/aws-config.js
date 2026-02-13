export const awsConfig = {
  Auth: {
    Cognito: {
      userPoolId: "us-west-2_8hJ9rdYYz",  
      userPoolClientId: "424rre660gcrdf0mjh48ossbf0", 
      signUpVerificationMethod: 'code',
      loginWith: {
        email: true
      }
    }
  }
};
  