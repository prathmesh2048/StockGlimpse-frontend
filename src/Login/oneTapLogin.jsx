import { useGoogleOneTapLogin } from '@react-oauth/google';
import ENV from "../config";
import { useNavigate } from "react-router-dom";
import { setToken } from '../utils/auth';

const OneTapLogin = () => {

  const navigate = useNavigate();

  useGoogleOneTapLogin({
    onSuccess: async (credentialResponse) => {
      const idToken = credentialResponse.credential;

      try {
        const response = await fetch(`${ENV.BASE_API_URL}/auth/api/login/google/`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ token: idToken }),
        });

        if (!response.ok) {
          throw new Error('Login failed with status: ' + response.status);
        }

        const data = await response.json();
        const { jwtToken } = data; // Get the JWT token

        if (jwtToken) {
          setToken(jwtToken);
          navigate('/');
          console.log("JWT token saved:", jwtToken);
        } else {
          console.error('JWT token not found in response');
        }

      } catch (error) {
        console.error('Login request failed:', error);
      }
    },
    onError: () => {
      console.log('One Tap login failed');
    }
  });

  return null;
};

export default OneTapLogin;
