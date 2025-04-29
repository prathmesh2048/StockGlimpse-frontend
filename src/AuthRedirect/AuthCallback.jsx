import { useEffect } from "react";
import { useNavigate } from "react-router-dom";

const AuthCallback = () => {

  const navigate = useNavigate();

  useEffect(() => {

    console.log("AuthCallback mounted");
    const token = new URLSearchParams(window.location.search).get("token");

    if (token) {
      localStorage.setItem("jwtToken", token);
      navigate("/");
    }
  }, []);

  return <p>Logging you in...</p>;
};

export default AuthCallback;
