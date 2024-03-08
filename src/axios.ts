import axios from 'axios';

const axiosInstance = axios.create({
    baseURL: 'http://85.167.225.223:8000/',
    // other custom settings
});

// axiosInstance.interceptors.request.use(function (config) {
//     const token = 'YourAuthToken'; // Acquire your token from where it's stored
//     config.headers.Authorization = token ? `Bearer ${token}` : '';
//     return config;
// });

export default axiosInstance;