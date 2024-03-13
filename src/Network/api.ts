import axios from 'axios';
import {Preferences} from "@capacitor/preferences";

const api = axios.create({
    baseURL: 'https://www.cloudsmartcare.com'
});

export const authenticateUser = async (userId: string) => {
    try {
        const response = await api.post('/authenticate', { user_id: userId });
        if (response.data.success) {
            // noinspection JSUnresolvedReference
            const authToken = response.data.auth_token;
            await Preferences.set({
                key: 'authToken',
                value: authToken,
            });
            return {
                success: true,
                message: response.data.message || 'Authentication successful.',
                authToken,
            };
        } else {
            return {
                success: false,
                message: 'Authentication failed. No token received.',
            };
        }
    } catch (error: unknown) {
        if (axios.isAxiosError(error)) {
            console.error("An Axios error occurred during the authentication process", error);
            const message = error.response?.data?.detail || 'An error occurred. Please try again.';
            return {
                success: false,
                message: message,
            };
        } else {
            console.error("An unexpected error occurred", error);
            return {
                success: false,
                message: 'An unexpected error occurred. Please try again.',
            };
        }
    }
};


/*export const authenticateUser = async (userId: string) => {
    try {
        const response = await api.post('/authenticate', { user_id: userId });
        return {
            success: response.data.success,
            message: response.data.message || 'Authentication successful.',
        };
    } catch (error: unknown) {
        if (axios.isAxiosError(error)) {
            console.error("An Axios error occurred during the authentication process", error);
            const message = error.response?.data?.detail || 'An error occurred. Please try again.';
            return {
                success: false,
                message: message,
            };
        } else {
            console.error("An unexpected error occurred", error);
            return {
                success: false,
                message: 'An unexpected error occurred. Please try again.',
            };
        }
    }
};*/

export const reAuthenticateUser = async (authToken: string) => {
    try {
        const response = await api.post('/reauthenticate', { auth_token: authToken });
        return {
            success: response.data.success,
            message: response.data.message || 'Re-authentication successful.',
        };
    } catch (error: unknown) {
        if (axios.isAxiosError(error)) {
            console.error("An Axios error occurred during the re-authentication process", error);
            const message = error.response?.data?.detail || 'An error occurred during re-authentication. Please try again.';
            return {
                success: false,
                message: message,
            };
        } else {
            console.error("An unexpected error occurred during re-authentication", error);
            return {
                success: false,
                message: 'An unexpected error occurred. Please try again.',
            };
        }
    }
};


export default api;