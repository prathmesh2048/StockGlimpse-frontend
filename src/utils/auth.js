export const setToken = (token) => localStorage.setItem('jwtToken', token);
export const getToken = () => localStorage.getItem('jwtToken');
export const clearToken = () => localStorage.removeItem('jwtToken');
