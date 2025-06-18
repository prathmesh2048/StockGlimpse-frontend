import { useState, useEffect } from 'react';
import { getToken, clearToken } from '../utils/auth';
import { useNavigate, useLocation } from 'react-router-dom';
import ENV from "../config";

const useUser = () => {

    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);

    const location = useLocation();
    const navigate = useNavigate();

    useEffect(() => {

        const fetchUser = async () => {

            const token = getToken();
            if (!token) {
                setLoading(false);
                return;
            }

            try {
                const res = await fetch(`${ENV.BASE_API_URL}/auth/api/user/`, {
                    headers: {
                        Authorization: `Bearer ${token}`,
                    },
                });

                if (!res.ok) {
                    alert('Session expired. Please log in again.');
                    clearToken();
                    navigate('/login');
                    return;
                }
                

                const data = await res.json();
                setUser(data);
            } catch (err) {
                clearToken();
                navigate('/login');
            } finally {
                setLoading(false);
            }
        };

        fetchUser();
    }, [navigate, location]);

    return { user, loading };
};

export default useUser;
